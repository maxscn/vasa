import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Scene } from "../packages/canvas/dist/index.mjs";
import {
  createEditorLayoutTree,
  createEditorTextStyleForFont,
} from "../packages/editor/dist/index.mjs";
import { createCanvasFontValue } from "../packages/font/dist/index.mjs";
import { layoutDocument } from "../packages/layout/dist/index.mjs";
import { renderDocumentToPdf } from "../packages/pdf/dist/index.mjs";
import {
  comparePdfAndCanvasRenderers,
  createFontTextMeasurer,
  diffImage,
  imageDiffSummary,
  imageHash,
  renderTestImageToPngBytes,
} from "../packages/render-test/dist/index.mjs";
import { createRenderDocument, parseTextOutlineFont } from "../packages/renderer/dist/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = join(root, "llm/artifacts/editor-feedback");
const fontBytes = await readFile(
  join(root, "apps/editor/src/assets/fonts/LiberationSans-Regular.ttf"),
);
const outlineFont = parseTextOutlineFont(fontBytes);
const page = {
  width: 612,
  height: 220,
  margin: { top: 56, right: 64, bottom: 56, left: 64 },
};
const font = {
  id: "liberation-sans",
  family: "Skriva Liberation Sans",
  displayName: "Liberation Sans",
  weight: "400",
  style: "normal",
  fallbackFamilies: ["Arial", "sans-serif"],
  cssFamily: '"Skriva Liberation Sans", Arial, sans-serif',
  outlineFont,
};
const textFontSize = 16;
const fill = "#1f2937";
const editorDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Skriva " },
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
const baseTextStyle = createEditorTextStyleForFont(font, {
  fontSize: textFontSize,
  lineHeight: textFontSize,
  whiteSpace: "pre-wrap",
  wordBreak: "normal",
});
const layoutTree = createEditorLayoutTree(editorDocument, {
  rootStyle: { gap: 14 },
  paragraphStyle: { flexDirection: "column" },
  textStyle: baseTextStyle,
  resolveTextStyle: (attrs) => {
    const fontSize = attrs.fontSize ?? textFontSize;
    const fontWeight = attrs.fontWeight ?? font.weight;
    return createEditorTextStyleForFont(
      { ...font, weight: fontWeight },
      {
        fontSize,
        lineHeight: Math.ceil(fontSize * 1.25),
        whiteSpace: "pre-wrap",
        wordBreak: "normal",
      },
    );
  },
});
const measurer = createFontTextMeasurer(outlineFont);
const layout = layoutDocument(layoutTree, { page, measurer });
const renderDocument = createRenderDocument(layout);
const pdf = renderDocumentToPdf(layoutTree, {
  page,
  measurer,
  outlineText: (node, lineIndex) => {
    const line = node.lines[lineIndex];
    return {
      font: outlineFont,
      fontSize: line?.fontSize ?? textFontSize,
      fill,
      embolden: isBoldFontWeight(line?.fontWeight) ? 0.7 : undefined,
    };
  },
});
const comparison = await comparePdfAndCanvasRenderers({
  pdfBytes: pdf.bytes,
  document: renderDocument,
  canvas: {
    page,
    text: (box, lineIndex) => {
      const line = box.lines?.[lineIndex];
      return {
        fill,
        font: line?.font ?? createCanvasFontValue(font, { fontSize: textFontSize }),
        fontSize: line?.fontSize ?? textFontSize,
        outlineFont,
        embolden: isBoldFontWeight(line?.fontWeight) ? 0.7 : undefined,
      };
    },
  },
});
const scene = Scene(renderDocument, {
  text: (box, lineIndex) => {
    const line = box.lines?.[lineIndex];
    return {
      fill,
      font: line?.font ?? createCanvasFontValue(font, { fontSize: textFontSize }),
      fontSize: line?.fontSize ?? textFontSize,
      outlineFont,
      embolden: isBoldFontWeight(line?.fontWeight) ? 0.7 : undefined,
    };
  },
});

await mkdir(artifactDir, { recursive: true });
await writeFile(join(artifactDir, "canvas.png"), renderTestImageToPngBytes(comparison.canvas));
await writeFile(join(artifactDir, "pdf.png"), renderTestImageToPngBytes(comparison.pdf));
await writeFile(
  join(artifactDir, "diff.png"),
  renderTestImageToPngBytes(diffImage(comparison.canvas, comparison.pdf)),
);
await writeFile(
  join(artifactDir, "report.json"),
  `${JSON.stringify(
    {
      canvas: {
        path: "llm/artifacts/editor-feedback/canvas.png",
        hash: imageHash(comparison.canvas),
      },
      pdf: { path: "llm/artifacts/editor-feedback/pdf.png", hash: imageHash(comparison.pdf) },
      diff: {
        path: "llm/artifacts/editor-feedback/diff.png",
        summary: imageDiffSummary(comparison.diff),
        ...comparison.diff,
      },
      scene,
    },
    null,
    2,
  )}\n`,
);

console.log(`Wrote ${artifactDir}`);
console.log(imageDiffSummary(comparison.diff));

function isBoldFontWeight(fontWeight) {
  if (fontWeight === undefined) return false;
  if (fontWeight.toLowerCase() === "bold") return true;
  const parsed = Number.parseInt(fontWeight, 10);
  return Number.isFinite(parsed) && parsed >= 600;
}
