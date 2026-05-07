import { expect, test } from "vite-plus/test";
import { createElement } from "react";
import {
  createMonospaceTextMeasurer,
  type BoxNode,
  type MeasureTextInput,
  type TextMeasurer,
} from "@vasa/layout";
import { createRenderDocument } from "@vasa/renderer";
import { buildCanvasScene, createCanvasCommands } from "../../canvas/src/index.ts";
import {
  createEditorLayoutTree as createSourceEditorLayoutTree,
  type EditorJson,
} from "../../editor/src/index.ts";
import { layoutDocument as layoutSourceDocument } from "../../layout/src/index.ts";
import { extractPdfText } from "../../render-test/src/index.ts";
import {
  createRenderDocument as createSourceRenderDocument,
  type RenderDocument,
} from "../../renderer/src/index.ts";
import {
  Box,
  createPdfCommands,
  Document,
  renderDocumentToPdf,
  renderReactToLayoutTree,
  Text,
  writePdf,
} from "../src/index.ts";

const page = { width: 200, height: 120, margin: 10 };
const measurer = createMonospaceTextMeasurer({ charWidth: 10 });
const weightedMeasurer: TextMeasurer = {
  measureText(input) {
    const charWidth = input.font.startsWith("700 ") ? 11 : 10;
    const lines = wrapTestInput(input, charWidth);

    return {
      width: lines.reduce((max, line) => Math.max(max, line.text.length * charWidth), 0),
      height: lines.length * input.lineHeight,
      lineCount: lines.length,
      lines: lines.map((line) => ({
        text: line.text,
        start: line.start,
        width: line.text.length * charWidth,
      })),
    };
  },
};

test("creates deterministic PDF text commands from layout measurements", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "body",
        text: "alpha beta gamma",
        style: { lineHeight: 12 },
      },
    ],
  };

  const result = renderDocumentToPdf(document, { page, measurer });
  const pdf = new TextDecoder().decode(result.bytes);

  expect(result.commands).toEqual([
    { type: "beginPage", index: 0, rect: { x: 0, y: 0, width: 200, height: 120 } },
    { type: "text", text: "alpha beta gamma", x: 10, y: 10, fontSize: 12 },
  ]);
  expect(pdf.startsWith("%PDF-1.7\n")).toBe(true);
  expect(pdf).toContain("/Type /Catalog");
  expect(pdf).toContain("BT 0 0 0 rg /F1 12 Tf 1 0 0 1 10 101 Tm (alpha beta gamma) Tj ET");
  expect(pdf).toContain("startxref");
});

test("emits text that pdf.js can extract from native PDF text commands", async () => {
  const result = renderDocumentToPdf(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "body",
          text: "Select text",
          style: { lineHeight: 12 },
        },
      ],
    },
    { page, measurer },
  );

  await expect(extractPdfText(result.bytes)).resolves.toEqual(["Select text"]);
});

test("emits one PDF page command per layout page", () => {
  const commands = createPdfCommands(
    {
      pages: [
        {
          index: 0,
          bounds: rect(0, 0, 100, 100),
          content: rect(0, 0, 100, 100),
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          boxes: [],
        },
        {
          index: 1,
          bounds: rect(0, 0, 100, 100),
          content: rect(0, 0, 100, 100),
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          boxes: [],
        },
      ],
    },
    { width: 100, height: 100 },
  );

  expect(commands).toEqual([
    { type: "beginPage", index: 0, rect: rect(0, 0, 100, 100) },
    { type: "beginPage", index: 1, rect: rect(0, 0, 100, 100) },
  ]);
});

test("creates PDF commands from the shared render document contract", () => {
  const result = renderDocumentToPdf(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "body",
          text: "alpha beta",
          style: { lineHeight: 12 },
        },
      ],
    },
    { page, measurer },
  );

  expect(createPdfCommands(createRenderDocument(result.layout), page)).toEqual(result.commands);
});

test("keeps canvas and PDF text command order and positions aligned", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "regular",
        text: "Regular",
        style: { font: "400 14px Roboto, sans-serif", lineHeight: 14 },
      },
      {
        type: "text",
        id: "bold",
        text: "Bold",
        style: { font: "700 22px Roboto, sans-serif", lineHeight: 22 },
      },
    ],
  };
  const result = renderDocumentToPdf(document, { page, measurer });
  const renderDocument = createRenderDocument(result.layout);
  const canvasCommands = createCanvasCommands(buildCanvasScene(renderDocument));

  expect(textSummary(canvasCommands)).toEqual(textSummary(result.commands));
  expect(result.commands.filter((command) => command.type === "text")).toEqual([
    { type: "text", text: "Regular", x: 10, y: 10, fontSize: 14 },
    { type: "text", text: "Bold", x: 10, y: 24, fontSize: 22, fontWeight: "700" },
  ]);
});

test("emits blockquote border rects from shared render document boxes", () => {
  const commands = createPdfCommands(
    {
      pages: [
        {
          index: 0,
          rect: { x: 0, y: 0, width: 200, height: 120 },
          content: { x: 10, y: 10, width: 180, height: 100 },
          nodes: [
            {
              key: "box:quote",
              kind: "box",
              sourceId: "0",
              rect: { x: 10, y: 12, width: 100, height: 24 },
              props: { blockquoteBorderColor: "#d1d5db", blockquoteBorderWidth: 3 },
              children: [],
            },
          ],
        },
      ],
    },
    page,
  );

  expect(commands).toContainEqual({
    type: "rect",
    fill: "#d1d5db",
    rect: { x: 10, y: 12, width: 3, height: 24 },
  });
});

test("keeps canvas and PDF font sizes aligned when canvas paint only resolves fontSize", () => {
  const renderDocument: RenderDocument = {
    pages: [
      {
        index: 0,
        rect: { x: 0, y: 0, width: 200, height: 120 },
        content: { x: 10, y: 10, width: 180, height: 100 },
        nodes: [
          {
            key: "text:formula",
            kind: "text" as const,
            rect: { x: 10, y: 10, width: 30, height: 20 },
            text: "H2O",
            lines: [
              { text: "H", x: 10, y: 10, width: 10, height: 20, fontSize: 16 },
              {
                text: "2",
                x: 20,
                y: 20,
                width: 5,
                height: 20,
                fontSize: 10,
                verticalAlign: "sub" as const,
              },
              { text: "O", x: 25, y: 10, width: 10, height: 20, fontSize: 16 },
            ],
            children: [],
          },
        ],
      },
    ],
  };
  const pdfCommands = createPdfCommands(renderDocument, page);
  const canvasText = createCanvasCommands(
    buildCanvasScene(renderDocument, {
      text: (box, lineIndex) => {
        const line = box.lines?.[lineIndex];
        return { fontSize: line?.fontSize };
      },
    }),
  ).filter((command) => command.type === "fillText");

  expect(pdfCommands.filter((command) => command.type === "text")).toEqual([
    { type: "text", text: "H", x: 10, y: 10, fontSize: 16 },
    { type: "text", text: "2", x: 20, y: 20, fontSize: 10 },
    { type: "text", text: "O", x: 25, y: 10, fontSize: 16 },
  ]);
  expect(canvasText.map((command) => [command.text, command.font])).toEqual([
    ["H", "16px sans-serif"],
    ["2", "10px sans-serif"],
    ["O", "16px sans-serif"],
  ]);
});

test("uses CSS font size for PDF text commands instead of line height", () => {
  const result = renderDocumentToPdf(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "body",
          text: "Font size should not grow to line height",
          style: { font: "400 16px Helvetica, sans-serif", lineHeight: 20 },
        },
      ],
    },
    { page, measurer },
  );

  expect(result.commands.filter((command) => command.type === "text")).toEqual([
    { type: "text", text: "Font size should", x: 10, y: 10, fontSize: 16 },
    { type: "text", text: "not grow to line", x: 10, y: 30, fontSize: 16 },
    { type: "text", text: "height", x: 10, y: 50, fontSize: 16 },
  ]);
});

test("keeps text after a bolded editor line below the wrapped bold run", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "alpha beta", marks: [{ type: "bold" }] },
          { type: "text", text: " gamma" },
        ],
      },
    ],
  };
  const layoutTree = createSourceEditorLayoutTree(doc, {
    textStyle: { font: "400 16px Helvetica, sans-serif", lineHeight: 10 },
    resolveTextStyle: (attrs) =>
      attrs.fontWeight === "700"
        ? { font: "700 16px Helvetica, sans-serif", lineHeight: 10 }
        : undefined,
  });
  const regressionPage = { width: 120, height: 120, margin: 10 };
  const renderDocument = createSourceRenderDocument(
    layoutSourceDocument(layoutTree as Parameters<typeof layoutSourceDocument>[0], {
      page: regressionPage,
      measurer: weightedMeasurer,
    }),
  );
  const pdfCommands = createPdfCommands(renderDocument, regressionPage);
  const canvasText = textSummary(createCanvasCommands(buildCanvasScene(renderDocument)));

  expect(canvasText).toEqual([
    ["alpha", 10, 10],
    ["beta", 10, 20],
    ["gamma", 10, 30],
  ]);
  expect(textSummary(pdfCommands)).toEqual(canvasText);
  expect(pdfCommands.filter((command) => command.type === "text")).toEqual([
    { type: "text", text: "alpha", x: 10, y: 10, fontSize: 16, fontWeight: "700" },
    { type: "text", text: "beta", x: 10, y: 20, fontSize: 16, fontWeight: "700" },
    { type: "text", text: "gamma", x: 10, y: 30, fontSize: 16 },
  ]);
});

test("keeps bolded editor text inline while the paragraph still fits", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "alpha " },
          { type: "text", text: "beta", marks: [{ type: "bold" }] },
          { type: "text", text: " gamma" },
        ],
      },
    ],
  };
  const layoutTree = createSourceEditorLayoutTree(doc, {
    textStyle: { font: "400 16px Helvetica, sans-serif", lineHeight: 10 },
    resolveTextStyle: (attrs) =>
      attrs.fontWeight === "700"
        ? { font: "700 16px Helvetica, sans-serif", lineHeight: 10 }
        : undefined,
  });
  const regressionPage = { width: 200, height: 120, margin: 10 };
  const renderDocument = createSourceRenderDocument(
    layoutSourceDocument(layoutTree as Parameters<typeof layoutSourceDocument>[0], {
      page: regressionPage,
      measurer: weightedMeasurer,
    }),
  );
  const pdfCommands = createPdfCommands(renderDocument, regressionPage);
  const canvasText = textSummary(createCanvasCommands(buildCanvasScene(renderDocument)));

  expect(canvasText).toEqual([
    ["alpha ", 10, 10],
    ["beta", 70, 10],
    [" gamma", 114, 10],
  ]);
  expect(textSummary(pdfCommands)).toEqual(canvasText);
  expect(pdfCommands.filter((command) => command.type === "text")).toEqual([
    { type: "text", text: "alpha ", x: 10, y: 10, fontSize: 16 },
    { type: "text", text: "beta", x: 70, y: 10, fontSize: 16, fontWeight: "700" },
    { type: "text", text: " gamma", x: 114, y: 10, fontSize: 16 },
  ]);
});

test("resets native PDF text fill after a colored inline run", () => {
  const commands = createPdfCommands(
    createSourceRenderDocument({
      pages: [
        {
          index: 0,
          bounds: rect(0, 0, 200, 120),
          content: rect(0, 0, 200, 120),
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          boxes: [
            {
              id: "paragraph",
              type: "text",
              rect: rect(10, 10, 120, 20),
              text: "blue black",
              lines: [
                {
                  sourceId: "0.0",
                  sourceText: "blue",
                  text: "blue",
                  x: 10,
                  y: 10,
                  width: 40,
                  height: 16,
                  fontSize: 16,
                  color: "#2563eb",
                },
                {
                  sourceId: "0.1",
                  sourceText: " black",
                  text: " black",
                  x: 50,
                  y: 10,
                  width: 60,
                  height: 16,
                  fontSize: 16,
                },
              ],
              children: [],
            },
          ],
        },
      ],
    }),
    page,
  );
  const pdf = new TextDecoder().decode(writePdf(commands, page));

  expect(pdf).toContain("BT 0.145098 0.388235 0.921569 rg /F1 16 Tf 1 0 0 1 10 98 Tm (blue) Tj ET");
  expect(pdf).toContain("BT 0 0 0 rg /F1 16 Tf 1 0 0 1 50 98 Tm ( black) Tj ET");
});

test("uses oblique PDF fonts for native italic text fallback", () => {
  const pdf = new TextDecoder().decode(
    writePdf(
      [
        { type: "beginPage", index: 0, rect: { x: 0, y: 0, width: 200, height: 120 } },
        { type: "text", text: "italic", x: 10, y: 10, fontSize: 16, fontStyle: "italic" },
        {
          type: "text",
          text: "bold italic",
          x: 10,
          y: 30,
          fontSize: 16,
          fontWeight: "700",
          fontStyle: "italic",
        },
      ],
      page,
    ),
  );

  expect(pdf).toContain("/F3 16 Tf 1 0 0 1 10 98 Tm (italic)");
  expect(pdf).toContain("/F4 16 Tf 1 0 0 1 10 78 Tm (bold italic)");
  expect(pdf).toContain("/BaseFont /Helvetica-Oblique");
  expect(pdf).toContain("/BaseFont /Helvetica-BoldOblique");
});

test("reconciles React primitives into a layout tree", () => {
  const tree = renderReactToLayoutTree(
    createElement(
      "document",
      null,
      createElement(
        "view",
        { id: "section", style: { padding: 8 } },
        createElement("text", { id: "body", style: { lineHeight: 14 } }, "Hello PDF"),
      ),
    ),
  );

  expect(tree).toEqual({
    type: "box",
    style: undefined,
    children: [
      {
        type: "box",
        id: "section",
        style: { padding: 8 },
        children: [{ type: "text", id: "body", text: "Hello PDF", style: { lineHeight: 14 } }],
      },
    ],
  });
});

test("exports named React primitives through the PDF reconciler", () => {
  const tree = renderReactToLayoutTree(
    createElement(
      Document,
      null,
      createElement(
        Box,
        { id: "section", style: { padding: 8 } },
        createElement(Text, { id: "body", style: { lineHeight: 14 } }, "Hello PDF"),
      ),
    ),
  );

  expect(tree).toEqual({
    type: "box",
    style: undefined,
    children: [
      {
        type: "box",
        id: "section",
        style: { padding: 8 },
        children: [{ type: "text", id: "body", text: "Hello PDF", style: { lineHeight: 14 } }],
      },
    ],
  });
});

test("preserves custom PDF primitives for renderer extensions", () => {
  const tree = renderReactToLayoutTree(
    createElement("badge", { id: "brand", label: "Vasa", style: { width: 32, height: 12 } }),
  );

  expect(tree.children?.[0]).toEqual({
    type: "badge",
    id: "brand",
    label: "Vasa",
    style: { width: 32, height: 12 },
    children: [],
  });
});

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height };
}

function textSummary(
  commands: ReturnType<typeof createCanvasCommands> | ReturnType<typeof createPdfCommands>,
) {
  return commands
    .filter((command) => command.type === "fillText" || command.type === "text")
    .map((command) => [command.text, command.x, command.y]);
}

function wrapTestInput(input: MeasureTextInput, charWidth: number) {
  if (input.text.length * charWidth <= input.maxWidth) {
    return [{ text: input.text, start: 0 }];
  }

  const maxCharacters = Math.max(1, Math.floor(input.maxWidth / charWidth));
  const rawLines =
    input.whiteSpace === "pre-wrap"
      ? input.text.split("\n")
      : [input.text.replaceAll(/\s+/g, " ").trim()];

  return rawLines.flatMap((line, lineIndex) => {
    const baseOffset = rawLines
      .slice(0, lineIndex)
      .reduce((offset, rawLine) => offset + rawLine.length + 1, 0);
    const wrapped: Array<{ text: string; start: number }> = [];
    const words = line.split(" ");
    let current = "";
    let cursor = 0;

    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (candidate.length <= maxCharacters) {
        current = candidate;
        continue;
      }

      if (current.length > 0) {
        const start = line.indexOf(current, cursor);
        wrapped.push({ text: current, start: baseOffset + start });
        cursor = start + current.length + 1;
      }
      current = word;
    }

    if (current.length > 0) {
      wrapped.push({ text: current, start: baseOffset + line.indexOf(current, cursor) });
    }

    return wrapped.length === 0 ? [{ text: "", start: baseOffset }] : wrapped;
  });
}
