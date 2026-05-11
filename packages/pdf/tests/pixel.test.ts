/// <reference types="node" />

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEditorCanvasTextMeasurer,
  createEditorCanvasTextPaint,
  createEditorLayoutTree,
  createEditorParityDocument,
  createEditorPdfOutlineText,
  createEditorRenderDocument,
  createEditorRenderResolveTextStyle,
  createEditorRenderTextMeasurer,
  createEditorRenderTextStyle,
  createEditorTextStyleForFont,
  type EditorRenderDocumentContract,
  type EditorJson,
} from "@vasa/editor";
import { editorConfig } from "../../../apps/editor/src/editor-demo.ts";
import {
  createFontRegistry,
  createFontScriptStyle,
  createStandardFontMetrics,
  type VasaFont,
} from "../../font/src/index.ts";
import {
  createMonospaceTextMeasurer,
  type BoxNode,
  type LayoutBox,
  type LayoutResult,
  type Rect,
  type TextLine,
} from "@vasa/layout";
import {
  comparePdfAndCanvasRenderers,
  createNativeMeasureText,
  createFontTextMeasurer,
  extractPdfText,
  imageDiff,
  imageDiffMessage,
  imageDiffSummary,
  imageHash,
  registerRenderTestFont,
  type RenderTestImage,
} from "../../render-test/src/index.ts";
import {
  createTextLineOutline,
  createRenderDocument,
  parseTextOutlineFont,
  textOutlinePathBounds,
  type RenderDocument,
  type RenderTextNode,
} from "@vasa/renderer";
import { expect, test } from "vite-plus/test";
import { renderDocumentToPdf, type PdfCommand } from "../src/index.ts";

const page = { width: 48, height: 24, margin: 4 };
const charWidth = 4;
const fontSize = 8;
const measurer = createMonospaceTextMeasurer({ charWidth });
const fixtureDir = dirname(fileURLToPath(import.meta.url));
const outlineFont = parseTextOutlineFont(
  readFileSync(join(fixtureDir, "fixtures/fonts/LiberationSans-Regular.ttf")),
);
const liberationSansBytes = readFileSync(
  join(fixtureDir, "fixtures/fonts/LiberationSans-Regular.ttf"),
);
registerRenderTestFont(liberationSansBytes, "Vasa Liberation Sans");
const arimoBytes = readFileSync(join(fixtureDir, "fixtures/fonts/google/arimo/Arimo-Regular.ttf"));
const appEditorOutlineFont = parseTextOutlineFont(arimoBytes, { variations: { wght: 400 } });
registerRenderTestFont(arimoBytes, "Arimo");
const arimoBoldBytes = readFileSync(join(fixtureDir, "fixtures/fonts/google/arimo/Arimo-700.ttf"));
const appEditorBoldOutlineFont = parseTextOutlineFont(arimoBoldBytes, {
  variations: { wght: 700 },
});
const decorationFontFixtures = discoverDecorationFontFixtures();

test("renders PDF and canvas output to matching page image hashes", async () => {
  const document: BoxNode = {
    type: "box",
    children: [],
  };

  const pdf = renderDocumentToPdf(document, { page, measurer });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page,
      fontSize,
    },
  });

  expect(comparison.canvas.width).toBe(comparison.pdf.width);
  expect(comparison.canvas.height).toBe(comparison.pdf.height);
  expect(imageHash(comparison.canvas)).toBe(imageHash(comparison.pdf));
});

test("stacks multi-page PDF and canvas output with the same page gap", async () => {
  const pageGap = 8;
  const document: BoxNode = {
    type: "box",
    style: { gap: 4 },
    children: [
      { type: "text", id: "first", text: "first page", style: { lineHeight: 8 } },
      { type: "text", id: "second", text: "second page", style: { lineHeight: 8 } },
      { type: "text", id: "third", text: "third page", style: { lineHeight: 8 } },
      { type: "text", id: "fourth", text: "fourth page", style: { lineHeight: 8 } },
    ],
  };

  const pdf = renderDocumentToPdf(document, {
    page,
    measurer: createFontTextMeasurer(outlineFont, fontSize),
    outlineText: { font: outlineFont, fontSize, fill: "#000000" },
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page,
      pageGap,
      fontSize,
      outlineFont,
    },
  });

  expect(comparison.canvas.width).toBe(comparison.pdf.width);
  expect(comparison.canvas.height).toBe(comparison.pdf.height);
  expect(comparison.diff.ratio, imageDiffSummary(comparison.diff)).toBeLessThanOrEqual(0.0025);
  expect(comparison.diff.maxChannelDelta, imageDiffSummary(comparison.diff)).toBeLessThanOrEqual(
    24,
  );
});

test("renders text primitive outlines to exact matching PDF and canvas image hashes", async () => {
  const textPage = { width: 96, height: 48, margin: 8 };
  const textFontSize = 14;
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "text-fixture",
        text: "Vasa 42",
        style: { lineHeight: 18 },
      },
    ],
  };

  const pdf = renderDocumentToPdf(document, {
    page: textPage,
    measurer: createFontTextMeasurer(outlineFont, textFontSize),
    outlineText: { font: outlineFont, fontSize: textFontSize, fill: "#000000" },
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page: textPage,
      fontSize: textFontSize,
      outlineFont,
    },
  });

  expect(comparison.canvas.width).toBe(comparison.pdf.width);
  expect(comparison.canvas.height).toBe(comparison.pdf.height);
  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("matches editor canvas and PDF font scale for the current rich-text profile", async () => {
  const editorPage = {
    width: 612,
    height: 792,
    margin: { top: 56, right: 64, bottom: 56, left: 64 },
  };
  const editorFontSize = 16;
  const document: BoxNode = {
    type: "box",
    style: { gap: 14 },
    children: [
      {
        type: "box",
        style: { flexDirection: "column" },
        children: [
          {
            type: "text",
            id: "0.0",
            text: "Vasa editor demo",
            style: { font: "400 16px/16px Vasa Liberation Sans", lineHeight: 16 },
          },
        ],
      },
      {
        type: "box",
        style: { flexDirection: "column" },
        children: [
          {
            type: "text",
            id: "1.0",
            text: "Type here to update the document model, layout tree, canvas renderer, and PDF output.",
            style: { font: "400 16px/16px Vasa Liberation Sans", lineHeight: 16 },
          },
        ],
      },
    ],
  };
  const pdf = renderDocumentToPdf(document, {
    page: editorPage,
    measurer: createFontTextMeasurer(outlineFont, editorFontSize),
    outlineText: { font: outlineFont, fontSize: editorFontSize, fill: "#1f2937" },
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page: editorPage,
      fontSize: editorFontSize,
      outlineFont,
      text: {
        fill: "#1f2937",
        fontSize: editorFontSize,
        outlineFont,
      },
    },
  });

  expect(comparison.canvas.width).toBe(comparison.pdf.width);
  expect(comparison.canvas.height).toBe(comparison.pdf.height);
  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("keeps rich canvas editor and rasterized PDF output visually aligned within threshold", async () => {
  const richPage = { width: 180, height: 96, margin: 10 };
  const document: BoxNode = {
    type: "box",
    style: { gap: 6 },
    children: [
      {
        type: "text",
        id: "title",
        text: "Vasa editor demo",
        style: { font: "700 18px Liberation Sans", lineHeight: 22 },
      },
      {
        type: "text",
        id: "body",
        text: "Canvas and PDF should match.",
        style: { font: "400 12px Liberation Sans", lineHeight: 15 },
      },
      {
        type: "text",
        id: "caption",
        text: "Small text stays aligned.",
        style: { font: "400 9px Liberation Sans", lineHeight: 12 },
      },
    ],
  };
  const measurer = createFontTextMeasurer(outlineFont);
  const pdf = renderDocumentToPdf(document, {
    page: richPage,
    measurer,
    outlineText: (node) => ({
      font: outlineFont,
      fill: "#000000",
      fontSize: fontSizeFromBox(node.sourceId),
    }),
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page: richPage,
      fontSize,
      text: (box) => ({
        fill: "#000000",
        outlineFont,
        fontSize: fontSizeFromBox(box.id),
      }),
    },
  });

  expect(comparison.canvas.width).toBe(comparison.pdf.width);
  expect(comparison.canvas.height).toBe(comparison.pdf.height);
  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("keeps bold and 28px editor text visually aligned between canvas and PDF", async () => {
  const richPage = { width: 220, height: 72, margin: 10 };
  const editorFont = {
    cssFamily: "Liberation Sans",
    style: "normal",
    weight: "400",
  };
  const document: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Vasa " },
          {
            type: "text",
            text: "editor",
            marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontSize: 28 } }],
          },
          { type: "text", text: " demo" },
        ],
      },
    ],
  };
  const layoutTree = createEditorLayoutTree(document, {
    paragraphStyle: { flexDirection: "column" },
    textStyle: createEditorTextStyleForFont(editorFont, {
      fontSize: 16,
      lineHeight: 20,
      whiteSpace: "pre-wrap",
    }),
    resolveTextStyle: (attrs) => {
      const fontSize = attrs.fontSize ?? 16;
      const fontWeight = attrs.fontWeight ?? editorFont.weight;
      return createEditorTextStyleForFont(
        { ...editorFont, weight: fontWeight },
        {
          fontSize,
          lineHeight: Math.ceil(fontSize * 1.25),
          whiteSpace: "pre-wrap",
        },
      );
    },
  });
  const measurer = createFontTextMeasurer(outlineFont);
  const pdf = renderDocumentToPdf(layoutTree, {
    page: richPage,
    measurer,
    outlineText: (node, lineIndex) => {
      const line = node.lines[lineIndex];
      return {
        font: outlineFont,
        fill: "#000000",
        fontSize: line?.fontSize ?? 16,
        embolden: line?.fontWeight === "700" ? 0.7 : undefined,
      };
    },
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page: richPage,
      text: (box, lineIndex) => {
        const line = box.lines?.[lineIndex];
        return {
          fill: "#000000",
          outlineFont,
          fontSize: line?.fontSize ?? 16,
          embolden: line?.fontWeight === "700" ? 0.7 : undefined,
        };
      },
    },
  });

  expect(comparison.canvas.width).toBe(comparison.pdf.width);
  expect(comparison.canvas.height).toBe(comparison.pdf.height);
  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("keeps DOM-style Tiptap marks aligned between canvas and PDF", async () => {
  const richPage = { width: 260, height: 150, margin: 10 };
  const editorFont = {
    cssFamily: "Liberation Sans",
    style: "normal",
    weight: "400",
  };
  const document: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bold italic ", marks: [{ type: "bold" }, { type: "italic" }] },
          {
            type: "text",
            text: "under",
            marks: [{ type: "underline" }, { type: "textStyle", attrs: { color: "#2563eb" } }],
          },
          { type: "text", text: " strike", marks: [{ type: "strike" }] },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Code", marks: [{ type: "code" }] },
          { type: "text", text: " " },
          { type: "text", text: "highlight", marks: [{ type: "highlight" }] },
          { type: "text", text: " x" },
          { type: "text", text: "2", marks: [{ type: "superscript" }] },
          { type: "text", text: " H" },
          { type: "text", text: "2", marks: [{ type: "subscript" }] },
          { type: "text", text: "O" },
        ],
      },
    ],
  };
  const layoutTree = createEditorLayoutTree(document, {
    rootStyle: { gap: 6 },
    paragraphStyle: { flexDirection: "column" },
    textStyle: createEditorTextStyleForFont(editorFont, {
      fontSize: 16,
      lineHeight: 20,
      whiteSpace: "pre-wrap",
    }),
    resolveTextStyle: (attrs) => {
      const baseFontSize = attrs.fontSize ?? 16;
      const fontSize =
        attrs.verticalAlign === "sub" || attrs.verticalAlign === "super"
          ? Math.round(baseFontSize * 0.72)
          : baseFontSize;
      const fontWeight = attrs.fontWeight ?? editorFont.weight;
      return createEditorTextStyleForFont(
        { ...editorFont, weight: fontWeight, style: attrs.fontStyle ?? editorFont.style },
        {
          fontSize,
          lineHeight: Math.ceil(fontSize * 1.25),
          whiteSpace: "pre-wrap",
          color: attrs.color,
          backgroundColor: attrs.backgroundColor,
          textDecorationLine: attrs.textDecorationLine,
          verticalAlign: attrs.verticalAlign,
        },
      );
    },
  });
  const measurer = createFontTextMeasurer(outlineFont);
  const pdf = renderDocumentToPdf(layoutTree, {
    page: richPage,
    measurer,
    outlineText: (node, lineIndex) => {
      const line = node.lines[lineIndex];
      return {
        font: outlineFont,
        fill: line?.color ?? "#000000",
        fontSize: line?.fontSize ?? 16,
        embolden: line?.fontWeight === "700" ? 0.7 : undefined,
        skewX: line?.font?.startsWith("italic") ? 0.35 : undefined,
      };
    },
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page: richPage,
      text: (box, lineIndex) => {
        const line = box.lines?.[lineIndex];
        return {
          fill: line?.color ?? "#000000",
          outlineFont,
          fontSize: line?.fontSize ?? 16,
          embolden: line?.fontWeight === "700" ? 0.7 : undefined,
          skewX: line?.font?.startsWith("italic") ? 0.35 : undefined,
        };
      },
    },
  });

  expect(comparison.canvas.width).toBe(comparison.pdf.width);
  expect(comparison.canvas.height).toBe(comparison.pdf.height);
  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("renders mixed editor marks identically between canvas and PDF", async () => {
  const mixedPage = { width: 520, height: 96, margin: 10 };
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Type here to update the document model, " },
          { type: "text", text: "layout", marks: [{ type: "highlight" }] },
          { type: "text", text: " tree, " },
          { type: "text", text: "canvas", marks: [{ type: "superscript" }] },
          { type: "text", text: " renderer," },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "and " },
          { type: "text", text: "PDF output.", marks: [{ type: "strike" }] },
        ],
      },
    ],
  };
  const layoutTree = createMarkedFixtureLayoutTree(doc);
  const pdf = renderDocumentToPdf(layoutTree, {
    page: mixedPage,
    measurer: createFontTextMeasurer(outlineFont),
    outlineText: markedFixtureOutlineText,
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: pdf.layout,
    canvas: {
      page: mixedPage,
      text: markedFixtureCanvasText,
    },
  });

  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("renders WebGL text parity cases identically between canvas and PDF", async () => {
  const comparison = await compareMarkedEditorDoc(
    {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Heading" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Under", marks: [{ type: "underline" }] },
            { type: "text", text: " " },
            { type: "text", text: "Strike", marks: [{ type: "strike" }] },
            { type: "text", text: " H" },
            { type: "text", text: "2", marks: [{ type: "subscript" }] },
            { type: "text", text: " O" },
            { type: "text", text: "2", marks: [{ type: "superscript" }] },
          ],
        },
      ],
    },
    { width: 320, height: 110, margin: 10 },
  );

  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("renders the apps/editor rich-text page contract identically between canvas and PDF", async () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    extensions: appEditorFixtureLayoutExtensions,
    outlineText: contract.pdfOutlineText,
    renderers: appEditorFixturePdfRenderers,
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: contract.renderDocument,
    artifacts:
      process.env.VASA_RENDER_TEST_ARTIFACTS === undefined
        ? {
            dir: join(fixtureDir, "artifacts/app-editor-parity"),
            title: "app-editor-parity",
            report: { fixture: "app-editor-parity" },
          }
        : undefined,
    artifactName: "app-editor-parity",
    canvas: {
      page: appEditorFixturePage,
      pageBackground: "#fffdfa",
      scale: 2,
      text: contract.canvasTextPaint,
      extensions: appEditorFixtureCanvasRenderers,
    },
    pdf: {
      background: "#fffdfa",
      scale: 2,
    },
  });

  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("apps/editor outline PDF is not selectable through pdf.js text extraction", async () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    extensions: appEditorFixtureLayoutExtensions,
    outlineText: contract.pdfOutlineText,
    renderers: appEditorFixturePdfRenderers,
  });

  expect(normalizeExtractedPdfText(await extractPdfText(pdf.bytes))).toBe("");
});

test("apps/editor selectable outline PDF exposes text through pdf.js text extraction", async () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    extensions: appEditorFixtureLayoutExtensions,
    outlineText: contract.pdfOutlineText,
    renderers: appEditorFixturePdfRenderers,
    defaultTextFill: editorConfig.textColor,
    selectableText: true,
  });
  const extractedText = normalizeExtractedPdfText(await extractPdfText(pdf.bytes));

  expect(extractedText).toContain(
    "Vasa editor parity sheet Combined marks should stay glued together",
  );
  expect(extractedText).toContain(
    "Highlight, color, and code: yellow note, blue text, and inline code.",
  );
});

test("apps/editor selectable outline PDF visually matches canvas through pdf.js", async () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    extensions: appEditorFixtureLayoutExtensions,
    outlineText: contract.pdfOutlineText,
    renderers: appEditorFixturePdfRenderers,
    defaultTextFill: editorConfig.textColor,
    selectableText: true,
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: contract.renderDocument,
    artifacts:
      process.env.VASA_RENDER_TEST_ARTIFACTS === undefined
        ? {
            dir: join(fixtureDir, "artifacts/app-editor-native-text-parity"),
            title: "app-editor-native-text-parity",
            report: { fixture: "app-editor-native-text-parity" },
          }
        : undefined,
    artifactName: "app-editor-native-text-parity",
    canvas: {
      page: appEditorFixturePage,
      pageBackground: "#fffdfa",
      scale: 2,
      text: contract.canvasTextPaint,
      extensions: appEditorFixtureCanvasRenderers,
    },
    pdf: {
      background: "#fffdfa",
      scale: 2,
    },
  });

  expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
});

test("apps/editor native PDF keeps selectable text exports compact", async () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    extensions: appEditorFixtureLayoutExtensions,
    renderers: appEditorFixturePdfRenderers,
    defaultTextFill: editorConfig.textColor,
  });
  const extractedText = normalizeExtractedPdfText(await extractPdfText(pdf.bytes));

  expect(pdf.bytes.byteLength).toBeLessThan(16_000);
  expect(extractedText).toContain(
    "Vasa editor parity sheet Combined marks should stay glued together",
  );
  expect(extractedText).toContain(
    "Highlight, color, and code: yellow note, blue text, and inline code.",
  );
});

test("apps/editor selectable outline PDF compresses below raw outline size", async () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    extensions: appEditorFixtureLayoutExtensions,
    outlineText: contract.pdfOutlineText,
    renderers: appEditorFixturePdfRenderers,
    defaultTextFill: editorConfig.textColor,
    selectableText: true,
  });
  const compressedBytes = await pdf.compressedBytes();

  expect(compressedBytes.byteLength).toBeLessThan(pdf.bytes.byteLength * 0.45);
  expect(compressedBytes.byteLength).toBeLessThan(256_000);
  expect(normalizeExtractedPdfText(await extractPdfText(compressedBytes))).toContain(
    "Vasa editor parity sheet Combined marks should stay glued together",
  );
});

test("apps/editor embedded PDF subsets font glyphs for compact selectable text", async () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    extensions: appEditorFixtureLayoutExtensions,
    outlineText: contract.pdfOutlineText,
    renderers: appEditorFixturePdfRenderers,
    defaultTextFill: editorConfig.textColor,
    textMode: "embedded",
  });
  const extractedText = normalizeExtractedPdfText(await extractPdfText(pdf.bytes));

  expect(pdf.bytes.byteLength).toBeLessThan(80_000);
  expect(extractedText).toContain(
    "Vasa editor parity sheet Combined marks should stay glued together",
  );
});

test("embedded PDF size grows sublinearly for repeated characters", async () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        text: "a".repeat(1500),
        style: { font: "400 16px Vasa Liberation Sans", lineHeight: 16 },
      },
    ],
  };
  const pdf = renderDocumentToPdf(document, {
    page: { width: 8000, height: 100, margin: 10 },
    measurer: createFontTextMeasurer(outlineFont),
    outlineText: { font: outlineFont, fontSize: 16, fill: "#111111" },
    textMode: "embedded",
  });
  const text = normalizeExtractedPdfText(await extractPdfText(pdf.bytes));

  expect(pdf.bytes.byteLength).toBeLessThan(40_000);
  expect(text).toContain("a".repeat(200));
});

test("uses the apps/editor fixture to keep script marks visibly small and offset", () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const layout = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    outlineText: contract.pdfOutlineText,
  }).layout;
  const lines = collectTextLines(layout.pages[0]?.boxes ?? []);
  const hydrogen = lines.find((line) => line.text.endsWith("H"));
  const subscript = lines.find((line) => line.text === "2" && line.verticalAlign === "sub");
  const oxygen = lines.find((line) => line.text.startsWith("O and"));
  const superscript = lines.find((line) => line.text === "2" && line.verticalAlign === "super");

  expect(hydrogen).toBeDefined();
  expect(subscript).toBeDefined();
  expect(oxygen).toBeDefined();
  expect(superscript).toBeDefined();
  expect(subscript?.fontSize).toBe(
    createFontScriptStyle(editorConfig.bundledFont, {
      fontSize: editorConfig.textFontSize,
      kind: "sub",
    }).fontSize,
  );
  expect(superscript?.fontSize).toBe(
    createFontScriptStyle(editorConfig.bundledFont, {
      fontSize: editorConfig.textFontSize,
      kind: "super",
    }).fontSize,
  );
  expect(subscript!.y - hydrogen!.y).toBeCloseTo(
    createFontScriptStyle(editorConfig.bundledFont, {
      fontSize: editorConfig.textFontSize,
      kind: "sub",
    }).baselineShift,
  );
  expect(superscript!.y - hydrogen!.y).toBeCloseTo(
    createFontScriptStyle(editorConfig.bundledFont, {
      fontSize: editorConfig.textFontSize,
      kind: "super",
    }).baselineShift,
  );
  expect(oxygen?.y).toBe(hydrogen?.y);
});

test("sizes apps/editor decorations and code backgrounds to the rendered glyph outlines", () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    outlineText: contract.pdfOutlineText,
  });
  const lines = collectTextLines(pdf.layout.pages[0]?.boxes ?? []);
  const underlined = lineByText(lines, "underlined");
  const struck = lineByText(lines, "struck text");
  const code = lineByText(lines, "inline code");

  expect(underlined.width).toBeCloseTo(outlineAdvance(underlined, contract), 1);
  expect(struck.width).toBeCloseTo(outlineAdvance(struck, contract), 1);
  expect(code.width).toBeCloseTo(outlineAdvance(code, contract), 1);
  expect(rectsByFill(pdf.commands, "#eef2f7").map((command) => command.rect.width)).toEqual([
    snappedOutlineWidth(code, contract),
  ]);
  expect(decorationRects(pdf.commands, underlined).at(0)?.rect.width).toBeCloseTo(
    snappedOutlineWidth(underlined, contract),
    0,
  );
  expect(decorationRects(pdf.commands, struck).at(0)?.rect.width).toBeCloseTo(
    snappedOutlineWidth(struck, contract),
    0,
  );
});

test("places apps/editor PDF underline and strike decorations at DOM-like vertical offsets", () => {
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    outlineText: contract.pdfOutlineText,
  });
  const lines = collectTextLines(pdf.layout.pages[0]?.boxes ?? []);
  const underlined = lineByText(lines, "underlined");
  const struck = lineByText(lines, "struck text");
  const underlineBounds = outlineBounds(underlined, contract);
  const strikeBounds = outlineBounds(struck, contract);
  const underlineRect = decorationRectForLine(pdf.commands, underlined, underlineBounds);
  const strikeRect = decorationRectForLine(pdf.commands, struck, strikeBounds);

  expect(underlineRect).toBeDefined();
  expect(strikeRect).toBeDefined();
  expect(underlineRect!.y).toBeGreaterThanOrEqual(
    Math.floor(underlineBounds.y + underlineBounds.height),
  );
  expect(strikeRect!.y + strikeRect!.height / 2).toBeCloseTo(
    strikeBounds.y + strikeBounds.height / 2,
    0,
  );
});

test("centers Arimo PDF strikethrough over struck text", async () => {
  const font = await createDecorationFixtureFont("Arimo", "google/arimo/Arimo-Regular.ttf");
  const fixture = createFontDecorationContract(font, {
    text: "struck text",
    mark: "strike",
  });
  const strikeLine = decoratedLine(fixture.pdf.layout, "struck text", "line-through");
  const strikeBounds = outlineBounds(strikeLine, fixture.contract);
  const strikeRect = decorationRectForLine(fixture.pdf.commands, strikeLine, strikeBounds);

  expect(strikeRect, "Arimo struck text strike decoration").toBeDefined();
  expect(strikeRect!.y + strikeRect!.height / 2, "Arimo struck text strike center").toBeCloseTo(
    strikeBounds.y + strikeBounds.height / 2,
    0,
  );
});

test.each(decorationFontFixtures)(
  "keeps PDF decorations aligned for $family",
  async ({ family, file }) => {
    const font = await createDecorationFixtureFont(family, file);
    const strike = createFontDecorationContract(font, {
      text: "struck text",
      mark: "strike",
    });
    const underline = createFontDecorationContract(font, {
      text: "Hag",
      mark: "underline",
    });
    const strikeLine = decoratedLine(strike.pdf.layout, "struck text", "line-through");
    const strikeBounds = outlineBounds(strikeLine, strike.contract);
    const strikeRect = decorationRectForLine(strike.pdf.commands, strikeLine, strikeBounds);
    const underlineLine = decoratedLine(underline.pdf.layout, "Hag", "underline");
    const underlineBounds = outlineBounds(underlineLine, underline.contract);
    const underlineRect = decorationRectForLine(
      underline.pdf.commands,
      underlineLine,
      underlineBounds,
    );

    expect.soft(strikeRect, `${family} strike decoration`).toBeDefined();
    if (strikeRect !== undefined) {
      expect
        .soft(strikeRect.y + strikeRect.height / 2, `${family} strike center`)
        .toBeCloseTo(strikeBounds.y + strikeBounds.height / 2, 0);
    }
    expect.soft(underlineRect, `${family} underline decoration`).toBeDefined();
    if (underlineRect !== undefined) {
      expect
        .soft(underlineRect.y, `${family} underline top`)
        .toBeGreaterThanOrEqual(Math.floor(underlineBounds.y + underlineBounds.height));
    }
  },
);

test("matches cropped apps/editor script glyph shapes between canvas and PDF", async () => {
  const scale = 2;
  const contract = createAppEditorFixtureContract(createEditorParityDocument());
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    outlineText: contract.pdfOutlineText,
  });
  const comparison = await comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: contract.renderDocument,
    canvas: {
      page: appEditorFixturePage,
      pageBackground: "#fffdfa",
      scale,
      text: contract.canvasTextPaint,
    },
    pdf: {
      background: "#fffdfa",
      scale,
    },
  });
  const scriptLines = collectTextLines(pdf.layout.pages[0]?.boxes ?? []);
  const subscript = lineByTextAndAlign(scriptLines, "2", "sub");
  const superscript = lineByTextAndAlign(scriptLines, "2", "super");

  for (const line of [subscript, superscript]) {
    const rect = scaleRect(tightLineRect(line), scale);
    const canvasCrop = cropImage(comparison.canvas, rect);
    const pdfCrop = cropImage(comparison.pdf, rect);
    const canvasBounds = inkBounds(canvasCrop);
    const pdfBounds = inkBounds(pdfCrop);

    expect(canvasBounds).toBeDefined();
    expect(pdfBounds).toBeDefined();
    expect(canvasBounds!.width).toBeLessThanOrEqual(8 * scale);
    expect(pdfBounds!.width).toBeLessThanOrEqual(8 * scale);
    expect(canvasBounds!.height).toBeLessThanOrEqual(9 * scale);
    expect(pdfBounds!.height).toBeLessThanOrEqual(9 * scale);
    expect(Math.abs(canvasBounds!.height - pdfBounds!.height)).toBeLessThanOrEqual(scale);
    expectPixelPerfectImageDiff(canvasCrop, pdfCrop);
  }
});

test("renders highlighted layout text identically inside a mixed editor line", async () => {
  const comparison = await compareMarkedEditorDoc(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Type here to update the document model, " },
            { type: "text", text: "layout", marks: [{ type: "highlight" }] },
            { type: "text", text: " tree," },
          ],
        },
      ],
    },
    { width: 420, height: 64, margin: 10 },
  );

  expect(imageHash(comparison.canvas), imageDiffMessage(comparison.canvas, comparison.pdf)).toBe(
    imageHash(comparison.pdf),
  );
});

test("keeps superscript canvas text aligned with its neighboring editor runs", async () => {
  const comparison = await compareMarkedEditorDoc(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Type here to update the document model, layout tree, " },
            { type: "text", text: "canvas", marks: [{ type: "superscript" }] },
            { type: "text", text: " renderer," },
          ],
        },
      ],
    },
    { width: 520, height: 64, margin: 10 },
  );

  expect(imageHash(comparison.canvas), imageDiffMessage(comparison.canvas, comparison.pdf)).toBe(
    imageHash(comparison.pdf),
  );
});

test("keeps renderer text aligned after a superscript editor run", async () => {
  const comparison = await compareMarkedEditorDoc(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Type here to update the document model, layout tree, " },
            { type: "text", text: "canvas", marks: [{ type: "superscript" }] },
            { type: "text", text: " renderer," },
          ],
        },
      ],
    },
    { width: 520, height: 64, margin: 10 },
  );

  expect(imageHash(comparison.canvas), imageDiffMessage(comparison.canvas, comparison.pdf)).toBe(
    imageHash(comparison.pdf),
  );
});

test("renders struck PDF output text identically inside a mixed editor line", async () => {
  const comparison = await compareMarkedEditorDoc(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "and " },
            { type: "text", text: "PDF output.", marks: [{ type: "strike" }] },
          ],
        },
      ],
    },
    { width: 190, height: 64, margin: 10 },
  );

  expect(imageHash(comparison.canvas), imageDiffMessage(comparison.canvas, comparison.pdf)).toBe(
    imageHash(comparison.pdf),
  );
});

test("raises superscript using the editor app render profile baseline", () => {
  const layoutTree = createMarkedFixtureLayoutTree({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "tree, " },
          { type: "text", text: "canvas", marks: [{ type: "superscript" }] },
          { type: "text", text: " renderer" },
        ],
      },
    ],
  });
  const layout = createMarkedFixtureAppLayout(layoutTree);
  const lines = layout.pages[0]?.boxes[0]?.children[0]?.lines ?? [];
  const before = lines.find((line) => line.text === "tree, ");
  const script = lines.find((line) => line.text === "canvas");
  const after = lines.find((line) => line.text === " renderer");

  expect(before).toBeDefined();
  expect(script).toBeDefined();
  expect(after).toBeDefined();
  expect(script?.verticalAlign).toBe("super");
  expect(script?.fontSize).toBe(10);
  expect(script!.y - before!.y).toBeCloseTo(
    createFontScriptStyle(markedFixtureRenderProfile().fallbackFont, {
      fontSize: 20,
      kind: "super",
    }).baselineShift,
  );
  expect(after?.y).toBe(before?.y);
});

test("lowers subscript using the editor app render profile baseline", () => {
  const layoutTree = createMarkedFixtureLayoutTree({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "H" },
          { type: "text", text: "2", marks: [{ type: "subscript" }] },
          { type: "text", text: "O" },
        ],
      },
    ],
  });
  const layout = createMarkedFixtureAppLayout(layoutTree);
  const lines = layout.pages[0]?.boxes[0]?.children[0]?.lines ?? [];
  const before = lines.find((line) => line.text === "H");
  const script = lines.find((line) => line.text === "2");
  const after = lines.find((line) => line.text === "O");

  expect(before).toBeDefined();
  expect(script).toBeDefined();
  expect(after).toBeDefined();
  expect(script?.verticalAlign).toBe("sub");
  expect(script?.fontSize).toBe(10);
  expect(script!.y - before!.y).toBeCloseTo(
    createFontScriptStyle(markedFixtureRenderProfile().fallbackFont, {
      fontSize: 20,
      kind: "sub",
    }).baselineShift,
  );
  expect(after?.y).toBe(before?.y);
});

for (const fixture of [
  { name: "italic", marks: [{ type: "italic" }] },
  { name: "underline", marks: [{ type: "underline" }] },
  { name: "strike", marks: [{ type: "strike" }] },
  {
    name: "superscript",
    prefix: "x",
    text: "2",
    marks: [{ type: "superscript" }],
  },
  {
    name: "subscript",
    prefix: "H",
    text: "2",
    suffix: "O",
    marks: [{ type: "subscript" }],
  },
] satisfies Array<{
  name: string;
  prefix?: string;
  text?: string;
  suffix?: string;
  marks: EditorJson["marks"];
}>) {
  test(`keeps ${fixture.name} editor mark visually aligned between canvas and PDF`, async () => {
    const markPage = { width: 160, height: 64, margin: 10 };
    const doc: EditorJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            ...(fixture.prefix === undefined ? [] : [{ type: "text", text: fixture.prefix }]),
            { type: "text", text: fixture.text ?? "Vasa", marks: fixture.marks },
            ...(fixture.suffix === undefined ? [] : [{ type: "text", text: fixture.suffix }]),
          ],
        },
      ],
    };
    const layoutTree = createMarkedFixtureLayoutTree(doc);
    const measurer = createFontTextMeasurer(outlineFont);
    const pdf = renderDocumentToPdf(layoutTree, {
      page: markPage,
      measurer,
      outlineText: markedFixtureOutlineText,
    });
    const comparison = await comparePdfAndCanvasRenderers({
      pdfBytes: pdf.bytes,
      document: pdf.layout,
      canvas: {
        page: markPage,
        scale: 2,
        text: markedFixtureCanvasText,
      },
      pdf: { scale: 2 },
    });

    expect(comparison.canvas.width).toBe(comparison.pdf.width);
    expect(comparison.canvas.height).toBe(comparison.pdf.height);
    if (fixture.name === "strike") {
      expectNearPixelImageDiff(comparison.canvas, comparison.pdf);
    } else {
      expectPixelPerfectImageDiff(comparison.canvas, comparison.pdf);
    }
  });
}

function fontSizeFromBox(id: string | undefined) {
  if (id === "title") return 18;
  if (id === "body") return 12;
  if (id === "caption") return 9;
  return fontSize;
}

async function compareMarkedEditorDoc(
  document: EditorJson,
  page: { width: number; height: number; margin: number },
) {
  const layoutTree = createMarkedFixtureLayoutTree(document);
  const pdf = renderDocumentToPdf(layoutTree, {
    page,
    measurer: createFontTextMeasurer(outlineFont),
    outlineText: markedFixtureOutlineText,
  });

  return comparePdfAndCanvasRenderers({
    pdfBytes: pdf.bytes,
    document: createRenderDocument(pdf.layout),
    canvas: {
      page,
      text: markedFixtureCanvasText,
    },
  });
}

function createMarkedFixtureAppLayout(document: BoxNode) {
  return renderDocumentToPdf(document, {
    page: { width: 520, height: 96, margin: 10 },
    measurer: createEditorCanvasTextMeasurer((text, font) => {
      const fontSize = Number(/(\d+(?:\.\d+)?)px/.exec(font ?? "")?.[1] ?? 20);
      return text.length * fontSize * 0.5;
    }),
    outlineText: markedFixtureOutlineText,
  }).layout;
}

const appEditorFixturePage = editorConfig.page;
const appEditorFixtureExtraChildren = editorConfig.extraChildren ?? [];
const appEditorFixtureExtensions = editorConfig.extensions ?? [];
const appEditorFixtureLayoutExtensions = appEditorFixtureExtensions.flatMap((extension) =>
  asArray(extension.layout),
);
const appEditorFixtureRendererExtensions = appEditorFixtureExtensions.flatMap((extension) =>
  asArray(extension.renderer),
);
const appEditorFixtureCanvasRenderers = appEditorFixtureExtensions.flatMap((extension) =>
  asArray(extension.renderers?.canvas),
);
const appEditorFixturePdfRenderers = appEditorFixtureExtensions.flatMap((extension) =>
  asArray(extension.renderers?.pdf),
);

const appEditorFixtureMeasurer = createEditorRenderTextMeasurer(
  appEditorFixtureRenderProfile(),
  createNativeMeasureText("normal 400 16px Arimo, Arial, sans-serif"),
);

function createAppEditorFixtureContract(document: EditorJson) {
  return createEditorRenderDocument({
    doc: document,
    page: appEditorFixturePage,
    measurer: appEditorFixtureMeasurer,
    profile: appEditorFixtureRenderProfile(),
    rootStyle: { gap: 14 },
    paragraphStyle: { flexDirection: "column" },
    extraChildren: appEditorFixtureExtraChildren,
    layoutExtensions: appEditorFixtureLayoutExtensions,
    rendererExtensions: appEditorFixtureRendererExtensions,
    createRenderDocument,
  });
}

async function createDecorationFixtureFont(family: string, file: string) {
  const bytes = readFileSync(join(fixtureDir, "fixtures/fonts", file));
  const registry = createFontRegistry();
  const font = await registry.register({
    id: fontFixtureId(family),
    family,
    displayName: family,
    source: bytes,
    fallbackFamilies: ["Arial", "sans-serif"],
  });

  expect(font.outlineFont, `${family} outline font`).toBeDefined();
  return font as VasaFont & { outlineFont: NonNullable<VasaFont["outlineFont"]> };
}

function discoverDecorationFontFixtures() {
  const fontRoot = join(fixtureDir, "fixtures/fonts");
  return regularFontFixtureFiles(fontRoot)
    .map((file) => {
      return {
        family: familyNameFromRegularFontFile(file),
        file,
      };
    })
    .sort((left, right) => left.family.localeCompare(right.family));
}

function familyNameFromRegularFontFile(file: string) {
  const filename = file.split("/").at(-1) ?? file;
  return filename
    .replace(/-Regular\.ttf$/, "")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2");
}

function regularFontFixtureFiles(root: string, dir = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return regularFontFixtureFiles(root, path);
    if (!entry.isFile() || !entry.name.endsWith("Regular.ttf")) return [];
    return [relative(root, path)];
  });
}

function createFontDecorationContract(
  font: VasaFont & { outlineFont: NonNullable<VasaFont["outlineFont"]> },
  fixture: { text: string; mark: "strike" | "underline" },
) {
  const document: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: fixture.text, marks: [{ type: fixture.mark }] }],
      },
    ],
  };
  const profile = {
    fonts: [font],
    defaultFontId: font.id,
    fallbackFont: font,
    fontSize: editorConfig.textFontSize,
    lineHeight: 24,
    textColor: editorConfig.textColor,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "normal" as const,
  };
  const contract = createEditorRenderDocument({
    doc: document,
    page: appEditorFixturePage,
    measurer: createEditorRenderTextMeasurer(profile),
    profile,
    paragraphStyle: { flexDirection: "column" },
    createRenderDocument,
  });
  const pdf = renderDocumentToPdf(contract.layoutTree, {
    page: appEditorFixturePage,
    measurer: createEditorRenderTextMeasurer(profile),
    outlineText: contract.pdfOutlineText,
  });

  return { contract, pdf };
}

function normalizeExtractedPdfText(pages: string[]) {
  return pages.join(" ").replaceAll(/\s+/g, " ").trim();
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function fontFixtureId(family: string) {
  return family
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}

function collectTextLines(boxes: LayoutBox[]): TextLine[] {
  return boxes.flatMap((box) => [...(box.lines ?? []), ...collectTextLines(box.children)]);
}

function lineByText(lines: TextLine[], text: string) {
  const line = lines.find((candidate) => candidate.text === text);
  expect(
    line,
    `Expected a line matching ${text}; saw ${lines.map((candidate) => JSON.stringify(candidate.text)).join(", ")}`,
  ).toBeDefined();
  return line!;
}

function decoratedLine(
  layout: LayoutResult,
  text: string,
  textDecorationLine: NonNullable<TextLine["textDecorationLine"]>,
) {
  const lines = collectTextLines(layout.pages[0]?.boxes ?? []);
  const line = lines.find(
    (candidate) => candidate.text === text && candidate.textDecorationLine === textDecorationLine,
  );

  expect(
    line,
    `Expected ${textDecorationLine} line matching ${text}; saw ${lines
      .map((candidate) => `${JSON.stringify(candidate.text)}:${candidate.textDecorationLine}`)
      .join(", ")}`,
  ).toBeDefined();
  return line!;
}

function outlineAdvance(line: TextLine, contract: EditorRenderDocumentContract<RenderDocument>) {
  const paint = contract.pdfOutlineText({ sourceId: line.sourceId, lines: [line] }, 0);
  expect(paint).toBeDefined();
  return Array.from(line.text).reduce((width, character) => {
    const glyph = paint!.font.source.charToGlyph(character);
    return width + (glyph.advanceWidth / paint!.font.unitsPerEm) * paint!.fontSize;
  }, 0);
}

function snappedOutlineWidth(
  line: TextLine,
  contract: EditorRenderDocumentContract<RenderDocument>,
) {
  const bounds = outlineBounds(line, contract);
  const x = Math.floor(bounds.x);
  return Math.max(1, Math.ceil(bounds.x + bounds.width) - x);
}

function outlineBounds(line: TextLine, contract: EditorRenderDocumentContract<RenderDocument>) {
  const paint = contract.pdfOutlineText({ sourceId: line.sourceId, lines: [line] }, 0);
  expect(paint).toBeDefined();
  const bounds = textOutlinePathBounds(
    createTextLineOutline(line, {
      font: paint!.font,
      fontSize: paint!.fontSize,
      embolden: paint!.embolden,
      skewX: paint!.skewX,
    }),
  );
  expect(bounds).toBeDefined();
  return bounds!;
}

function lineByTextAndAlign(
  lines: TextLine[],
  text: string,
  verticalAlign: TextLine["verticalAlign"],
) {
  const line = lines.find(
    (candidate) => candidate.text === text && candidate.verticalAlign === verticalAlign,
  );
  expect(line).toBeDefined();
  return line!;
}

function rectsByFill(commands: PdfCommand[], fill: string) {
  return commands.filter(
    (command): command is Extract<PdfCommand, { type: "rect" }> =>
      command.type === "rect" && command.fill === fill,
  );
}

function decorationRects(commands: PdfCommand[], line: TextLine) {
  return commands.filter(
    (command): command is Extract<PdfCommand, { type: "rect" }> =>
      command.type === "rect" &&
      command.fill === (line.textDecorationColor ?? line.color ?? "#1f2937") &&
      Math.abs(command.rect.x - Math.round(line.x)) <= 1,
  );
}

function decorationRectForLine(commands: PdfCommand[], line: TextLine, bounds: Rect) {
  const expectedX = Math.floor(bounds.x);
  return commands.find(
    (command): command is Extract<PdfCommand, { type: "rect" }> =>
      command.type === "rect" &&
      command.fill === (line.textDecorationColor ?? line.color ?? "#1f2937") &&
      Math.abs(command.rect.x - expectedX) <= 1,
  )?.rect;
}

function tightLineRect(line: TextLine): Rect {
  return {
    x: Math.max(0, Math.round(line.x)),
    y: Math.max(0, Math.floor(line.y)),
    width: Math.max(1, Math.ceil(line.width)),
    height: Math.max(1, Math.ceil(line.height)),
  };
}

function scaleRect(rect: Rect, scale: number): Rect {
  return {
    x: Math.round(rect.x * scale),
    y: Math.round(rect.y * scale),
    width: Math.ceil(rect.width * scale),
    height: Math.ceil(rect.height * scale),
  };
}

function cropImage(image: RenderTestImage, rect: Rect): RenderTestImage {
  const width = Math.max(1, Math.min(image.width - rect.x, rect.width));
  const height = Math.max(1, Math.min(image.height - rect.y, rect.height));
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = ((rect.y + y) * image.width + rect.x + x) * 4;
      const target = (y * width + x) * 4;
      pixels[target] = image.pixels[source] ?? 255;
      pixels[target + 1] = image.pixels[source + 1] ?? 255;
      pixels[target + 2] = image.pixels[source + 2] ?? 255;
      pixels[target + 3] = image.pixels[source + 3] ?? 255;
    }
  }

  return { width, height, pixels };
}

function inkBounds(image: RenderTestImage) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (!isInkPixel(image, offset)) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return undefined;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function expectPixelPerfectImageDiff(left: RenderTestImage, right: RenderTestImage) {
  const diff = imageDiff(left, right);

  expect(
    diff.mismatchCount,
    `${imageDiffSummary(diff)}; allowedMismatchCount=${scaledPixelMismatchBudget(left, right)}`,
  ).toBeLessThanOrEqual(scaledPixelMismatchBudget(left, right));
}

function expectNearPixelImageDiff(left: RenderTestImage, right: RenderTestImage) {
  const diff = imageDiff(left, right);

  expect(diff.ratio, imageDiffSummary(diff)).toBeLessThanOrEqual(0.01);
}

function scaledPixelMismatchBudget(left: RenderTestImage, right: RenderTestImage) {
  const pixels = Math.max(left.width * left.height, right.width * right.height);
  return Math.ceil((pixels / (2048 * 2048)) * 10);
}

function isInkPixel(image: RenderTestImage, offset: number) {
  const red = image.pixels[offset] ?? 255;
  const green = image.pixels[offset + 1] ?? 255;
  const blue = image.pixels[offset + 2] ?? 255;
  const alpha = image.pixels[offset + 3] ?? 255;
  return alpha > 0 && red + green + blue < 650;
}

function appEditorFixtureRenderProfile() {
  const font = {
    ...editorConfig.bundledFont,
    outlineFont: appEditorOutlineFont,
    data: {
      kind: "outline" as const,
      bytes: arimoBytes,
      metrics: {
        ...createStandardFontMetrics({ family: "Arimo" }),
        unitsPerEm: appEditorOutlineFont.unitsPerEm,
        ascender: appEditorOutlineFont.ascender,
      },
      outlineFont: appEditorOutlineFont,
    },
  };
  const boldFont = {
    ...font,
    id: "arimo-700",
    weight: "700",
    outlineFont: appEditorBoldOutlineFont,
    data: {
      kind: "outline" as const,
      bytes: arimoBoldBytes,
      metrics: {
        ...createStandardFontMetrics({ family: "Arimo" }),
        unitsPerEm: appEditorBoldOutlineFont.unitsPerEm,
        ascender: appEditorBoldOutlineFont.ascender,
      },
      outlineFont: appEditorBoldOutlineFont,
    },
  };

  return {
    fonts: [font, boldFont],
    defaultFontId: font.id,
    fallbackFont: editorConfig.fallbackFont,
    fontSize: editorConfig.textFontSize,
    lineHeight: editorConfig.textLineHeight,
    textColor: editorConfig.textColor,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "normal" as const,
  };
}

function createMarkedFixtureLayoutTree(document: EditorJson) {
  markedFixtureDoc = document;

  return createEditorLayoutTree(document, {
    paragraphStyle: { flexDirection: "column" },
    textStyle: createEditorRenderTextStyle(markedFixtureRenderProfile()),
    resolveTextStyle: createEditorRenderResolveTextStyle(markedFixtureRenderProfile()),
  });
}

function markedFixtureOutlineText(node: RenderTextNode, lineIndex: number) {
  return createEditorPdfOutlineText(
    markedFixtureDoc,
    markedFixtureRenderProfile(),
    node,
    lineIndex,
  );
}

function markedFixtureCanvasText(box: LayoutBox, lineIndex: number) {
  return createEditorCanvasTextPaint(
    markedFixtureDoc,
    markedFixtureRenderProfile(),
    box,
    lineIndex,
  );
}

let markedFixtureDoc: EditorJson = { type: "doc" };

function markedFixtureRenderProfile() {
  const font = {
    id: "liberation-sans",
    family: "Liberation Sans",
    displayName: "Liberation Sans",
    weight: "400",
    style: "normal",
    fallbackFamilies: ["Arial", "sans-serif"],
    cssFamily: "Liberation Sans",
    outlineFont,
    data: {
      kind: "outline" as const,
      bytes: new Uint8Array(),
      metrics: {
        unitsPerEm: outlineFont.unitsPerEm,
        ascender: outlineFont.ascender,
        descender: 0,
        lineGap: 0,
      },
      outlineFont,
    },
  };

  return {
    fonts: [font],
    defaultFontId: font.id,
    fallbackFont: font,
    fontSize: 20,
    lineHeight: 26,
    textColor: "#000000",
    whiteSpace: "pre-wrap" as const,
  };
}
