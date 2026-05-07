import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  imageDiff,
  renderTestImageToPngBytes,
  writeRendererComparisonArtifacts,
  type RenderTestImage,
} from "../../../../packages/render-test/src/index.ts";

const artifactRoot = resolve("tests/artifacts/browser-renderer-comparisons");

test("displayed editor canvas matches displayed PDF preview canvas", async ({ page }, testInfo) => {
  const browserLogs: string[] = [];
  page.on("console", (message) => {
    browserLogs.push(`[${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    browserLogs.push(`[pageerror] ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    browserLogs.push(
      `[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
    );
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForCanvases(page);
  await page.waitForSelector('canvas[aria-label="Document body"][data-font-ready="true"]', {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('canvas[aria-label="Document body"]')).toHaveAttribute(
    "data-active-font-family",
    "Vasa Liberation Sans",
  );
  await expect(page.locator('canvas[aria-label="Document body"]')).toHaveAttribute(
    "data-outline-font-ready",
    "true",
  );
  expect(await page.evaluate(() => document.fonts.check('16px "Vasa Liberation Sans"'))).toBe(true);
  await expect(page.locator('select[aria-label="Font family"]')).toContainText("Arimo");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await waitForPaintedCanvases(page);
  await waitForStableCanvasPixels(page);

  const images = await renderedCanvasImages(page);
  const canvasImage = browserImage(images.canvas);
  const pdfImage = browserImage(images.pdf);
  const comparison = {
    canvas: canvasImage,
    pdf: pdfImage,
    diff: imageDiff(canvasImage, pdfImage),
  };
  const artifacts = writeRendererComparisonArtifacts(comparison, {
    dir: join(artifactRoot, testInfo.project.name, "app-editor-displayed"),
    indexDir: join(artifactRoot, testInfo.project.name),
    title: `${testInfo.project.name} displayed app parity`,
    report: { browserName: testInfo.project.name, browserLogs },
  });

  mkdirSync(testInfo.outputDir, { recursive: true });
  writeFileSync(join(testInfo.outputDir, "canvas.png"), renderTestImageToPngBytes(canvasImage));
  writeFileSync(join(testInfo.outputDir, "pdf.png"), renderTestImageToPngBytes(pdfImage));
  testInfo.attachments.push(
    { name: "canvas", path: artifacts.canvas, contentType: "image/png" },
    { name: "pdf", path: artifacts.pdf, contentType: "image/png" },
    { name: "diff", path: artifacts.diff, contentType: "image/png" },
    { name: "report", path: artifacts.report, contentType: "application/json" },
  );

  expect(canvasImage.width).toBe(pdfImage.width);
  expect(canvasImage.height).toBe(pdfImage.height);
  await expectPanelSizesToMatch(page);
  expect(hasInk(canvasImage)).toBe(true);
  expect(hasInk(pdfImage)).toBe(true);
  expect(comparison.diff.mismatchCount).toBe(0);
  expect(browserLogs.filter((log) => log.startsWith("[pageerror]"))).toEqual([]);

  const beforeSvgDropHashes = await canvasHashes(page);
  await dropSvgOnEditor(page);
  await waitForCanvasHashesToChange(page, beforeSvgDropHashes);
  await waitForStableCanvasPixels(page);

  const svgDropImages = await renderedCanvasImages(page);
  expect(
    imageDiff(browserImage(svgDropImages.canvas), browserImage(svgDropImages.pdf)).mismatchCount,
  ).toBe(0);

  const previousHashes = await canvasHashes(page);
  await page.locator('select[aria-label="Font family"]').selectOption("arimo");
  await expect(page.locator('canvas[aria-label="Document body"]')).toHaveAttribute(
    "data-active-font-family",
    "Arimo",
  );
  await expect(page.locator('canvas[aria-label="Document body"]')).toHaveAttribute(
    "data-outline-font-ready",
    "true",
  );
  expect(await page.evaluate(() => document.fonts.check("16px Arimo"))).toBe(true);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await waitForPaintedCanvases(page);
  await waitForCanvasHashesToChange(page, previousHashes);
  await waitForStableCanvasPixels(page);

  const arimoImages = await renderedCanvasImages(page);
  const arimoCanvasImage = browserImage(arimoImages.canvas);
  const arimoPdfImage = browserImage(arimoImages.pdf);
  expect(imageDiff(arimoCanvasImage, arimoPdfImage).mismatchCount).toBe(0);
});

async function dropSvgOnEditor(page: Page) {
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    const svg = `
      <svg width="180" height="92" viewBox="0 0 180 92" xmlns="http://www.w3.org/2000/svg">
        <title>Dropped badge</title>
        <path d="M12 46 C12 23 31 8 54 8 L126 8 C149 8 168 23 168 46 C168 69 149 84 126 84 L54 84 C31 84 12 69 12 46 Z" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
        <path d="M44 58 L70 24 L96 58 Z" fill="#14b8a6" />
        <path d="M84 58 L110 24 L136 58 Z" fill="#f97316" />
        <path d="M70 66 L136 66" stroke="#334155" stroke-width="4" />
      </svg>
    `;
    transfer.items.add(new File([svg], "dropped.svg", { type: "image/svg+xml" }));
    return transfer;
  });

  await page.locator(".editor-canvas-frame").dispatchEvent("dragover", { dataTransfer });
  await page.locator(".editor-canvas-frame").dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
}

async function expectPanelSizesToMatch(page: Page) {
  const sizes = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>(".editor-panel");
    const preview = document.querySelector<HTMLElement>(".preview-panel");
    if (editor === null || preview === null) {
      throw new Error("Expected editor and PDF preview panels to exist.");
    }

    const editorRect = editor.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    return {
      editor: { width: editorRect.width, height: editorRect.height },
      preview: { width: previewRect.width, height: previewRect.height },
    };
  });

  expect(Math.abs(sizes.editor.width - sizes.preview.width)).toBeLessThan(1);
  expect(Math.abs(sizes.editor.height - sizes.preview.height)).toBeLessThan(1);
}

async function renderedCanvasImages(page: Page) {
  return page.evaluate(() => {
    const canvases = renderedCanvases();
    return {
      canvas: canvasSnapshot(canvases.editor),
      pdf: canvasSnapshot(canvases.pdf),
    };

    function renderedCanvases() {
      const editor = document.querySelector<HTMLCanvasElement>(
        'canvas[aria-label="Document body"]',
      );
      const pdf = document.querySelector<HTMLCanvasElement>(
        'canvas[aria-label="Rendered PDF preview"]',
      );

      if (editor === null || pdf === null) {
        throw new Error("Expected editor and PDF preview canvases to exist.");
      }

      return { editor, pdf };
    }

    function canvasSnapshot(canvas: HTMLCanvasElement) {
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("Expected a 2D canvas context.");

      return {
        width: canvas.width,
        height: canvas.height,
        pixels: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data),
      };
    }
  });
}

async function canvasHashes(page: Page) {
  return page.evaluate(() => {
    return {
      editor: canvasHash('canvas[aria-label="Document body"]'),
      pdf: canvasHash('canvas[aria-label="Rendered PDF preview"]'),
    };

    function canvasHash(selector: string) {
      const canvas = document.querySelector<HTMLCanvasElement>(selector);
      if (canvas === null) return "";
      const context = canvas.getContext("2d");
      if (context === null) return "";
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let hash = 2166136261;

      for (let index = 0; index < data.length; index += 1) {
        hash ^= data[index] ?? 0;
        hash = Math.imul(hash, 16777619);
      }

      return `${canvas.width}x${canvas.height}:${hash >>> 0}`;
    }
  });
}

async function waitForCanvasHashesToChange(page: Page, previous: { editor: string; pdf: string }) {
  await page.waitForFunction(
    (hashes) => {
      return (
        canvasHash('canvas[aria-label="Document body"]') !== hashes.editor &&
        canvasHash('canvas[aria-label="Rendered PDF preview"]') !== hashes.pdf
      );

      function canvasHash(selector: string) {
        const canvas = document.querySelector<HTMLCanvasElement>(selector);
        if (canvas === null) return "";
        const context = canvas.getContext("2d");
        if (context === null) return "";
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let hash = 2166136261;

        for (let index = 0; index < data.length; index += 1) {
          hash ^= data[index] ?? 0;
          hash = Math.imul(hash, 16777619);
        }

        return `${canvas.width}x${canvas.height}:${hash >>> 0}`;
      }
    },
    previous,
    { timeout: 60_000 },
  );
}

async function waitForCanvases(page: Page) {
  await page.waitForFunction(
    () => {
      const editor = document.querySelector<HTMLCanvasElement>(
        'canvas[aria-label="Document body"]',
      );
      const pdf = document.querySelector<HTMLCanvasElement>(
        'canvas[aria-label="Rendered PDF preview"]',
      );
      return (
        editor !== null &&
        pdf !== null &&
        editor.width > 0 &&
        editor.height > 0 &&
        pdf.width > 0 &&
        pdf.height > 0
      );
    },
    { timeout: 30_000 },
  );
}

async function waitForPaintedCanvases(page: Page) {
  await page.waitForFunction(
    () => {
      return (
        canvasHasInk('canvas[aria-label="Document body"]') &&
        canvasHasInk('canvas[aria-label="Rendered PDF preview"]')
      );

      function canvasHasInk(selector: string) {
        const canvas = document.querySelector<HTMLCanvasElement>(selector);
        if (canvas === null) return false;
        const context = canvas.getContext("2d");
        if (context === null) return false;
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index] ?? 255;
          const green = data[index + 1] ?? 255;
          const blue = data[index + 2] ?? 255;
          const alpha = data[index + 3] ?? 255;
          if (alpha > 0 && red + green + blue < 730) return true;
        }

        return false;
      }
    },
    { timeout: 60_000 },
  );
}

async function waitForStableCanvasPixels(page: Page) {
  await page.waitForFunction(
    async () => {
      const first = snapshots();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const second = snapshots();
      return first.editor === second.editor && first.pdf === second.pdf;

      function snapshots() {
        return {
          editor: canvasHash('canvas[aria-label="Document body"]'),
          pdf: canvasHash('canvas[aria-label="Rendered PDF preview"]'),
        };
      }

      function canvasHash(selector: string) {
        const canvas = document.querySelector<HTMLCanvasElement>(selector);
        if (canvas === null) return "";
        const context = canvas.getContext("2d");
        if (context === null) return "";
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let hash = 2166136261;

        for (let index = 0; index < data.length; index += 1) {
          hash ^= data[index] ?? 0;
          hash = Math.imul(hash, 16777619);
        }

        return `${canvas.width}x${canvas.height}:${hash >>> 0}`;
      }
    },
    { timeout: 30_000 },
  );
}

function browserImage(image: { width: number; height: number; pixels: number[] }): RenderTestImage {
  return {
    width: image.width,
    height: image.height,
    pixels: new Uint8ClampedArray(image.pixels),
  };
}

function hasInk(image: RenderTestImage) {
  for (let index = 0; index < image.pixels.length; index += 4) {
    const red = image.pixels[index] ?? 255;
    const green = image.pixels[index + 1] ?? 255;
    const blue = image.pixels[index + 2] ?? 255;
    const alpha = image.pixels[index + 3] ?? 255;
    if (alpha > 0 && red + green + blue < 730) return true;
  }

  return false;
}
