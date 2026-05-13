import {
  Canvas,
  type CanvasRendererExtension,
  type CanvasSurface,
  type CanvasTextPaint,
} from "@skriva/canvas";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import type { LayoutBox, LayoutOptions, LayoutResult } from "@skriva/layout";
import type { RenderDocument, TextOutlineFont } from "@skriva/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type RenderTestImage = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

export type RenderImageDiff = {
  mismatchCount: number;
  ratio: number;
  totalChannelDelta: number;
  maxChannelDelta: number;
};

export type FirstDifferingPixel = {
  x: number;
  y: number;
  left: number[];
  right: number[];
  mismatchCount: number;
};

export type PdfRasterizeOptions = {
  pageGap?: number;
  scale?: number;
  background?: string;
};

export type CanvasRasterizeOptions = {
  page: LayoutOptions["page"];
  pageGap?: number;
  pageBackground?: string;
  scale?: number;
  fontSize?: number;
  outlineFont?: TextOutlineFont;
  text?: CanvasTextPaint | ((box: LayoutBox, lineIndex: number) => CanvasTextPaint);
  extensions?: CanvasRendererExtension[];
};

export type RendererComparison = {
  canvas: RenderTestImage;
  pdf: RenderTestImage;
  diff: RenderImageDiff;
  artifacts?: RendererComparisonArtifacts;
};

type NativeCanvasContext = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;
type NativeCanvas = {
  width: number;
  height: number;
};

const require = createRequire(import.meta.url);
const pdfjsStandardFontDataUrl = `${dirname(
  require.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"),
)}/`;

let rendererComparisonArtifactIndex = 0;

export type RendererComparisonArtifactOptions = {
  dir: string;
  indexDir?: string;
  title?: string;
  report?: Record<string, unknown>;
};

export type RendererComparisonArtifacts = {
  dir: string;
  canvas: string;
  pdf: string;
  diff: string;
  report: string;
  index?: string;
};

export function registerRenderTestFont(bytes: Uint8Array | Buffer, family: string) {
  return GlobalFonts.register(Buffer.from(bytes), family);
}

export function createNativeMeasureText(defaultFont: string) {
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");

  return (text: string, font?: string) => {
    context.font = font ?? defaultFont;
    return context.measureText(text).width;
  };
}

export async function comparePdfAndCanvasRenderers(options: {
  pdfBytes: Uint8Array;
  document: LayoutResult | RenderDocument;
  canvas: CanvasRasterizeOptions;
  pdf?: PdfRasterizeOptions;
  artifacts?: string | RendererComparisonArtifactOptions | false;
  artifactName?: string;
}): Promise<RendererComparison> {
  const scale = options.pdf?.scale ?? options.canvas.scale ?? 1;
  const [pdfImage, canvasImage] = await Promise.all([
    rasterizePdfBytes(options.pdfBytes, {
      pageGap: (options.canvas.pageGap ?? 0) * scale,
      scale,
      ...options.pdf,
    }),
    Promise.resolve(rasterizeCanvasRenderer(options.document, options.canvas)),
  ]);
  const comparison: RendererComparison = {
    canvas: canvasImage,
    pdf: pdfImage,
    diff: imageDiff(canvasImage, pdfImage),
  };

  const artifactOptions = resolveRendererComparisonArtifactOptions(
    options.artifacts,
    options.artifactName,
  );
  if (artifactOptions !== undefined) {
    comparison.artifacts = writeRendererComparisonArtifacts(comparison, artifactOptions);
  }

  return comparison;
}

export async function rasterizePdfBytes(
  bytes: Uint8Array,
  options: PdfRasterizeOptions = {},
): Promise<RenderTestImage> {
  const pages = await rasterizePdfPages(bytes, options);
  return stackImages(pages, options.pageGap ?? 0, options.background ?? "#ffffff");
}

export async function extractPdfText(bytes: Uint8Array): Promise<string[]> {
  const loadingTask = getDocument({ data: bytes, standardFontDataUrl: pdfjsStandardFontDataUrl });
  const pdf = await loadingTask.promise;

  try {
    const pages: string[] = [];

    for (let index = 0; index < pdf.numPages; index += 1) {
      const pdfPage = await pdf.getPage(index + 1);
      const content = await pdfPage.getTextContent();
      pages.push(
        content.items
          .map((item) => {
            if (!("str" in item) || typeof item.str !== "string") return "";
            return `${item.str}${"hasEOL" in item && item.hasEOL === true ? " " : ""}`;
          })
          .join(""),
      );
    }

    return pages;
  } finally {
    await pdf.destroy();
  }
}

export async function rasterizePdfPages(
  bytes: Uint8Array,
  options: Omit<PdfRasterizeOptions, "pageGap"> = {},
): Promise<RenderTestImage[]> {
  const loadingTask = getDocument({ data: bytes, standardFontDataUrl: pdfjsStandardFontDataUrl });
  const pdf = await loadingTask.promise;

  try {
    const images: RenderTestImage[] = [];

    for (let index = 0; index < pdf.numPages; index += 1) {
      const pdfPage = await pdf.getPage(index + 1);
      const viewport = pdfPage.getViewport({ scale: options.scale ?? 1 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      patchPdfCanvasFill(context);

      await pdfPage.render({
        canvas: canvas as never,
        canvasContext: context as never,
        viewport,
        background: options.background ?? "#ffffff",
      }).promise;

      images.push(imageFromNativeCanvas(canvas, context));
    }

    return images;
  } finally {
    await pdf.destroy();
  }
}

export function rasterizeCanvasRenderer(
  document: LayoutResult | RenderDocument,
  options: CanvasRasterizeOptions,
): RenderTestImage {
  const pageGap = options.pageGap ?? 0;
  const scale = options.scale ?? 1;
  const canvas = createCanvas(
    Math.ceil(options.page.width * scale),
    Math.ceil(renderedCanvasHeight(document, options.page.height, pageGap) * scale),
  );
  const context = canvas.getContext("2d");
  const pageBackground = options.pageBackground ?? "#ffffff";
  const renderer = Canvas(nativeCanvasSurface(context), {
    pageGap,
    pageBackground,
    extensions: options.extensions,
    text: options.text ?? {
      fill: "#000000",
      font: `${options.fontSize ?? 12}px monospace`,
      fontSize: options.fontSize,
      outlineFont: options.outlineFont,
    },
  });

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = pageBackground;
  context.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
  renderer.render(document);
  return imageFromNativeCanvas(canvas, context);
}

export function nativeCanvasSurface(context: NativeCanvasContext): CanvasSurface {
  const surface: CanvasSurface = {
    clearRect: (x, y, width, height) => context.clearRect(x, y, width, height),
    fillRect: (x, y, width, height) => context.fillRect(x, y, width, height),
    strokeRect: (x, y, width, height) => context.strokeRect(x, y, width, height),
    fillText: (text, x, y) => context.fillText(text, x, y),
    beginPath: () => context.beginPath(),
    moveTo: (x, y) => context.moveTo(x, y),
    lineTo: (x, y) => context.lineTo(x, y),
    bezierCurveTo: (x1, y1, x2, y2, x, y) => context.bezierCurveTo(x1, y1, x2, y2, x, y),
    closePath: () => context.closePath(),
    fill: () => context.fill(),
    stroke: () => context.stroke(),
  };

  return new Proxy(surface, {
    get(target, property, receiver) {
      if (property === "fillStyle") return context.fillStyle;
      if (property === "strokeStyle") return context.strokeStyle;
      if (property === "font") return context.font;
      if (property === "lineWidth") return context.lineWidth;
      if (property === "textBaseline") return context.textBaseline;
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property === "fillStyle") {
        context.fillStyle = String(value);
        return true;
      }

      if (property === "strokeStyle") {
        context.strokeStyle = String(value);
        return true;
      }

      if (property === "font") {
        context.font = String(value);
        return true;
      }

      if (property === "lineWidth") {
        context.lineWidth = typeof value === "number" ? value : Number(value);
        return true;
      }

      if (property === "textBaseline") {
        context.textBaseline = String(value) as typeof context.textBaseline;
        return true;
      }

      return Reflect.set(target, property, value, receiver);
    },
  });
}

export function imageHash(image: RenderTestImage) {
  return createHash("sha256")
    .update(`${image.width}x${image.height}:`)
    .update(image.pixels)
    .digest("hex");
}

export function imageDiff(left: RenderTestImage, right: RenderTestImage): RenderImageDiff {
  const length = Math.min(left.pixels.length, right.pixels.length);
  const totalPixels = Math.max(left.pixels.length, right.pixels.length) / 4;
  let mismatchCount = Math.abs(left.pixels.length - right.pixels.length) / 4;
  let totalChannelDelta = 0;
  let maxChannelDelta = 0;

  for (let index = 0; index < length; index += 4) {
    const delta =
      Math.abs((left.pixels[index] ?? 0) - (right.pixels[index] ?? 0)) +
      Math.abs((left.pixels[index + 1] ?? 0) - (right.pixels[index + 1] ?? 0)) +
      Math.abs((left.pixels[index + 2] ?? 0) - (right.pixels[index + 2] ?? 0)) +
      Math.abs((left.pixels[index + 3] ?? 0) - (right.pixels[index + 3] ?? 0));

    if (delta > 0) mismatchCount += 1;
    totalChannelDelta += delta;
    maxChannelDelta = Math.max(maxChannelDelta, delta);
  }

  return {
    mismatchCount,
    ratio: totalPixels === 0 ? 0 : mismatchCount / totalPixels,
    totalChannelDelta,
    maxChannelDelta,
  };
}

export function imageDiffSummary(diff: RenderImageDiff) {
  return [
    `mismatchCount=${diff.mismatchCount}`,
    `ratio=${diff.ratio}`,
    `totalChannelDelta=${diff.totalChannelDelta}`,
    `maxChannelDelta=${diff.maxChannelDelta}`,
  ].join("; ");
}

export function imageDiffMessage(left: RenderTestImage, right: RenderTestImage) {
  const first = firstDifferingPixel(left, right);
  if (first === undefined) return "";

  return [
    `image hashes differ: mismatchCount=${first.mismatchCount}`,
    `firstPixel=(${first.x}, ${first.y})`,
    `canvas=[${first.left.join(", ")}]`,
    `pdf=[${first.right.join(", ")}]`,
  ].join("; ");
}

export function renderTestImageToPngBytes(image: RenderTestImage): Buffer {
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  const data = context.createImageData(image.width, image.height);
  data.data.set(image.pixels);
  context.putImageData(data, 0, 0);
  return canvas.toBuffer("image/png");
}

export function writeRendererComparisonArtifacts(
  comparison: RendererComparison,
  options: string | RendererComparisonArtifactOptions,
): RendererComparisonArtifacts {
  const artifactOptions = typeof options === "string" ? { dir: options } : options;
  const indexDir = artifactOptions.indexDir ?? dirname(artifactOptions.dir);
  const paths = {
    dir: artifactOptions.dir,
    canvas: join(artifactOptions.dir, "canvas.png"),
    pdf: join(artifactOptions.dir, "pdf.png"),
    diff: join(artifactOptions.dir, "diff.png"),
    report: join(artifactOptions.dir, "report.json"),
    index: join(indexDir, "index.html"),
  };

  mkdirSync(artifactOptions.dir, { recursive: true });
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(paths.canvas, renderTestImageToPngBytes(comparison.canvas));
  writeFileSync(paths.pdf, renderTestImageToPngBytes(comparison.pdf));
  writeFileSync(
    paths.diff,
    renderTestImageToPngBytes(diffImage(comparison.canvas, comparison.pdf)),
  );
  writeFileSync(
    paths.report,
    `${JSON.stringify(
      {
        title: artifactOptions.title ?? artifactOptions.dir.split(/[\\/]/).at(-1),
        canvas: {
          path: paths.canvas,
          width: comparison.canvas.width,
          height: comparison.canvas.height,
          hash: imageHash(comparison.canvas),
        },
        pdf: {
          path: paths.pdf,
          width: comparison.pdf.width,
          height: comparison.pdf.height,
          hash: imageHash(comparison.pdf),
        },
        diff: {
          path: paths.diff,
          summary: imageDiffSummary(comparison.diff),
          ...comparison.diff,
        },
        ...artifactOptions.report,
      },
      null,
      2,
    )}\n`,
  );
  writeRendererComparisonIndex(indexDir);

  return paths;
}

export function writeRendererComparisonIndex(dir: string): string {
  const reports = collectRendererComparisonReports(dir);
  const indexPath = join(dir, "index.html");
  const rows = reports
    .map((report) => {
      const title = escapeHtml(stringValue(report.data.title) ?? report.name);
      const ratio = Number(report.data.diff?.ratio ?? 0);
      const mismatchCount = Number(report.data.diff?.mismatchCount ?? 0);
      const maxChannelDelta = Number(report.data.diff?.maxChannelDelta ?? 0);
      const canvasPath = relative(dir, stringValue(report.data.canvas?.path) ?? "");
      const pdfPath = relative(dir, stringValue(report.data.pdf?.path) ?? "");
      const diffPath = relative(dir, stringValue(report.data.diff?.path) ?? "");

      return `<article class="case">
  <header>
    <h2>${title}</h2>
    <dl>
      <div><dt>Diff</dt><dd>${(ratio * 100).toFixed(4)}%</dd></div>
      <div><dt>Mismatches</dt><dd>${mismatchCount.toLocaleString()}</dd></div>
      <div><dt>Max Delta</dt><dd>${maxChannelDelta}</dd></div>
    </dl>
  </header>
  <div class="images">
    ${artifactImage("Canvas", canvasPath)}
    ${artifactImage("PDF", pdfPath)}
    ${artifactImage("Diff", diffPath)}
  </div>
</article>`;
    })
    .join("\n");

  writeFileSync(
    indexPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Skriva Renderer Comparison</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f3f4f6; }
    body { margin: 0; }
    main { max-width: 1440px; margin: 0 auto; padding: 32px; }
    h1 { margin: 0 0 24px; font-size: 28px; }
    .case { background: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; margin: 0 0 24px; overflow: hidden; }
    header { display: flex; justify-content: space-between; gap: 24px; padding: 18px 20px; border-bottom: 1px solid #e5e7eb; align-items: center; }
    h2 { margin: 0; font-size: 18px; font-weight: 650; }
    dl { display: flex; gap: 18px; margin: 0; }
    dt { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: .04em; }
    dd { margin: 3px 0 0; font-variant-numeric: tabular-nums; font-weight: 650; }
    .images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #e5e7eb; }
    figure { margin: 0; background: #ffffff; min-width: 0; }
    figcaption { padding: 10px 12px; font-size: 13px; font-weight: 650; }
    img { display: block; width: 100%; height: auto; background: #ffffff; }
    a { color: inherit; text-decoration: none; }
    a:hover figcaption { text-decoration: underline; }
    @media (max-width: 900px) { main { padding: 18px; } header, dl { display: block; } dl div { margin-top: 10px; } .images { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Skriva Renderer Comparison</h1>
    ${rows || "<p>No renderer comparison reports found.</p>"}
  </main>
</body>
</html>
`,
  );

  return indexPath;
}

function resolveRendererComparisonArtifactOptions(
  options: string | RendererComparisonArtifactOptions | false | undefined,
  artifactName: string | undefined,
): RendererComparisonArtifactOptions | undefined {
  if (options === false) return undefined;
  if (typeof options === "string") return { dir: options };
  if (options !== undefined) return options;

  const root = process.env.SKRIVA_RENDER_TEST_ARTIFACTS;
  if (root === undefined || root.length === 0) return undefined;

  rendererComparisonArtifactIndex += 1;
  const name =
    artifactName ?? `comparison-${String(rendererComparisonArtifactIndex).padStart(3, "0")}`;
  return {
    dir: join(root, sanitizeArtifactName(name)),
    indexDir: root,
    title: name,
    report: { source: rendererComparisonSource() },
  };
}

function collectRendererComparisonReports(dir: string) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .flatMap((name) => {
      const reportPath = join(dir, name, "report.json");
      if (!existsSync(reportPath) || !statSync(reportPath).isFile()) return [];

      return [
        {
          name,
          data: JSON.parse(readFileSync(reportPath, "utf8")) as {
            title?: unknown;
            canvas?: { path?: unknown };
            pdf?: { path?: unknown };
            diff?: {
              path?: unknown;
              ratio?: unknown;
              mismatchCount?: unknown;
              maxChannelDelta?: unknown;
            };
          },
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function artifactImage(label: string, path: string) {
  const safeLabel = escapeHtml(label);
  const safePath = escapeHtml(path);
  return `<a href="${safePath}"><figure><figcaption>${safeLabel}</figcaption><img src="${safePath}" alt="${safeLabel}"></figure></a>`;
}

function sanitizeArtifactName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 120);
}

function rendererComparisonSource() {
  return new Error().stack
    ?.split("\n")
    .find((line) => line.includes(".test.") || line.includes("/tests/"))
    ?.trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function diffImage(left: RenderTestImage, right: RenderTestImage): RenderTestImage {
  const width = Math.max(left.width, right.width);
  const height = Math.max(left.height, right.height);
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const outputOffset = (y * width + x) * 4;
      const leftPixel = pixelAt(left, x, y);
      const rightPixel = pixelAt(right, x, y);
      const delta =
        Math.abs(leftPixel[0] - rightPixel[0]) +
        Math.abs(leftPixel[1] - rightPixel[1]) +
        Math.abs(leftPixel[2] - rightPixel[2]) +
        Math.abs(leftPixel[3] - rightPixel[3]);

      if (delta === 0) {
        pixels[outputOffset] = 255;
        pixels[outputOffset + 1] = 255;
        pixels[outputOffset + 2] = 255;
        pixels[outputOffset + 3] = 255;
      } else {
        pixels[outputOffset] = 255;
        pixels[outputOffset + 1] = Math.max(0, 255 - delta);
        pixels[outputOffset + 2] = Math.max(0, 255 - delta);
        pixels[outputOffset + 3] = 255;
      }
    }
  }

  return { width, height, pixels };
}

function pixelAt(image: RenderTestImage, x: number, y: number) {
  if (x >= image.width || y >= image.height) return [255, 255, 255, 255] as const;
  const offset = (y * image.width + x) * 4;
  return [
    image.pixels[offset] ?? 255,
    image.pixels[offset + 1] ?? 255,
    image.pixels[offset + 2] ?? 255,
    image.pixels[offset + 3] ?? 255,
  ] as const;
}

export function firstDifferingPixel(
  left: RenderTestImage,
  right: RenderTestImage,
): FirstDifferingPixel | undefined {
  const length = Math.min(left.pixels.length, right.pixels.length);
  let mismatchCount = Math.abs(left.pixels.length - right.pixels.length) / 4;
  let first: Omit<FirstDifferingPixel, "mismatchCount"> | undefined;

  for (let offset = 0; offset < length; offset += 4) {
    const matches =
      left.pixels[offset] === right.pixels[offset] &&
      left.pixels[offset + 1] === right.pixels[offset + 1] &&
      left.pixels[offset + 2] === right.pixels[offset + 2] &&
      left.pixels[offset + 3] === right.pixels[offset + 3];

    if (matches) continue;

    mismatchCount += 1;
    first ??= {
      x: (offset / 4) % left.width,
      y: Math.floor(offset / 4 / left.width),
      left: Array.from(left.pixels.slice(offset, offset + 4)),
      right: Array.from(right.pixels.slice(offset, offset + 4)),
    };
  }

  if (first === undefined) return undefined;
  return { ...first, mismatchCount };
}

export function createFontTextMeasurer(font: TextOutlineFont, fallbackFontSize = 12) {
  return {
    measureText(input: { text: string; font?: string; lineHeight: number }) {
      const resolvedFontSize = parseCssFontSize(input.font) ?? fallbackFontSize;
      const lines = input.text.split("\n");
      const widths = lines.map((line) => measureFontText(font, line, resolvedFontSize));

      return {
        width: Math.max(0, ...widths),
        height: lines.length * input.lineHeight,
        lineCount: lines.length,
        lines: lines.map((text, index) => ({ text, width: widths[index] ?? 0 })),
      };
    },
  };
}

function renderedCanvasHeight(
  document: LayoutResult | RenderDocument,
  pageHeight: number,
  pageGap: number,
) {
  const pageCount = document.pages.length;
  if (pageCount === 0) return pageHeight;
  return pageCount * pageHeight + (pageCount - 1) * pageGap;
}

function imageFromNativeCanvas(
  canvas: NativeCanvas,
  context: NativeCanvasContext,
): RenderTestImage {
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    pixels: new Uint8ClampedArray(image.data),
  };
}

function stackImages(
  images: RenderTestImage[],
  pageGap: number,
  background: string,
): RenderTestImage {
  if (images.length === 0) {
    return { width: 0, height: 0, pixels: new Uint8ClampedArray() };
  }

  if (images.length === 1 && pageGap === 0) return images[0] as RenderTestImage;

  const width = Math.max(...images.map((image) => image.width));
  const height =
    images.reduce((total, image) => total + image.height, 0) + pageGap * (images.length - 1);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  let y = 0;

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  for (const image of images) {
    const data = context.createImageData(image.width, image.height);
    data.data.set(image.pixels);
    context.putImageData(data, 0, y);
    y += image.height + pageGap;
  }

  return imageFromNativeCanvas(canvas, context);
}

function patchPdfCanvasFill(context: NativeCanvasContext) {
  const fill = context.fill.bind(context);

  context.fill = (pathOrFillRule?: unknown, fillRule?: unknown) => {
    if (typeof pathOrFillRule !== "object" || pathOrFillRule === null) {
      fill();
      return;
    }

    fill(
      pathOrFillRule as Parameters<typeof context.fill>[0],
      fillRule as Parameters<typeof context.fill>[1],
    );
  };
}

function parseCssFontSize(font: string | undefined) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font ?? "");
  return match === null ? undefined : Number(match[1]);
}

function measureFontText(font: TextOutlineFont, text: string, fontSize: number) {
  let width = 0;

  for (const character of text) {
    width += (font.source.charToGlyph(character).advanceWidth / font.unitsPerEm) * fontSize;
  }

  return width;
}
