import { buildCanvasScene, createCanvasCommands } from "@vasa/canvas";
import { getSchema } from "@vasa/core";
import { Document } from "@vasa/extension-document";
import { Paragraph } from "@vasa/extension-paragraph";
import { Text } from "@vasa/extension-text";
import { layoutDocument, type BoxNode, type LayoutOptions, type TextMeasurer } from "@vasa/layout";
import { createPdfCommands } from "@vasa/pdf";
import { createRenderDocument } from "@vasa/renderer";
import { expect, test } from "vite-plus/test";
import { createTableNode, TableExtension } from "../src/index.ts";

const page: LayoutOptions["page"] = {
  width: 220,
  height: 140,
  margin: 10,
};

const measurer: TextMeasurer = {
  measureText(input) {
    return {
      width: input.text.length * 6,
      height: input.lineHeight,
      lineCount: 1,
      lines: [{ text: input.text, width: input.text.length * 6, start: 0 }],
    };
  },
};

test("installs the Tiptap table kit next to Vasa document primitives", () => {
  const schema = getSchema(
    [Document.tiptap, Paragraph.tiptap, Text.tiptap, TableExtension.tiptap].filter(
      (extension) => extension !== undefined,
    ),
  );

  expect(schema.nodes.table).toBeDefined();
  expect(schema.nodes.tableRow).toBeDefined();
  expect(schema.nodes.tableCell).toBeDefined();
  expect(schema.nodes.tableHeader).toBeDefined();
});

test("lays out table rows and cells as custom containers with child text", () => {
  const layout = layoutDocument(fixtureTable(), { page, measurer });
  const table = layout.pages[0]?.boxes[0];
  const firstRow = table?.children[0];
  const firstCell = firstRow?.children[0];

  expect(table?.type).toBe("table");
  expect(firstRow?.type).toBe("tableRow");
  expect(firstCell?.type).toBe("tableHeader");
  expect(firstCell?.rect).toEqual({ x: 10, y: 18, width: 100, height: 34 });
  expect(firstCell?.children[0]?.lines?.[0]).toMatchObject({
    text: "Head",
    x: 18,
    y: 25,
    width: 24,
    height: 18,
  });
});

test("preserves table custom nodes in the shared render document", () => {
  const renderDocument = createRenderDocument(layoutDocument(fixtureTable(), { page, measurer }), {
    extensions: rendererExtensions(),
  });

  expect(customTree(renderDocument.pages[0]?.nodes[0])).toEqual({
    kind: "custom",
    name: "table",
    children: [
      {
        kind: "custom",
        name: "tableRow",
        children: [
          { kind: "custom", name: "tableHeader", children: [{ kind: "text", text: "Head" }] },
          { kind: "custom", name: "tableHeader", children: [{ kind: "text", text: "Qty" }] },
        ],
      },
      {
        kind: "custom",
        name: "tableRow",
        children: [
          { kind: "custom", name: "tableCell", children: [{ kind: "text", text: "Paper" }] },
          { kind: "custom", name: "tableCell", children: [{ kind: "text", text: "12" }] },
        ],
      },
    ],
  });
});

test("maps table borders and text to matching PDF and canvas geometry", () => {
  const renderDocument = createRenderDocument(layoutDocument(fixtureTable(), { page, measurer }), {
    extensions: rendererExtensions(),
  });
  const canvasCommands = createCanvasCommands(
    buildCanvasScene(renderDocument, { extensions: canvasRenderers() }),
  );
  const pdfCommands = createPdfCommands(renderDocument, page, { renderers: pdfRenderers() });

  expect(canvasTextSummary(canvasCommands)).toEqual(pdfTextSummary(pdfCommands));
  expect(canvasBorderSummary(canvasCommands)).toEqual(pdfBorderSummary(pdfCommands));
  expect(canvasBorderSummary(canvasCommands)).toEqual([
    { x: 10, y: 18, width: 100, height: 34, stroke: "#cbd5e1", strokeWidth: 1 },
    { x: 110, y: 18, width: 100, height: 34, stroke: "#cbd5e1", strokeWidth: 1 },
    { x: 10, y: 52, width: 100, height: 34, stroke: "#cbd5e1", strokeWidth: 1 },
    { x: 110, y: 52, width: 100, height: 34, stroke: "#cbd5e1", strokeWidth: 1 },
  ]);
});

test("breaks overflowing tables between rows during pagination", () => {
  const table = createTableNode({
    id: "paged-table",
    rows: [
      { cells: [{ children: [cellText("One")] }, { children: [cellText("A")] }] },
      { cells: [{ children: [cellText("Two")] }, { children: [cellText("B")] }] },
      { cells: [{ children: [cellText("Three")] }, { children: [cellText("C")] }] },
    ],
  });

  const layout = layoutDocument(
    {
      type: "box",
      style: { flexDirection: "column" },
      children: [table],
    },
    {
      page: { width: 220, height: 122, margin: 10 },
      measurer,
      extensions: asArray(TableExtension.layout),
    },
  );

  expect(layout.pages).toHaveLength(2);
  expect(layout.pages[0]?.boxes[0]?.children).toHaveLength(2);
  expect(layout.pages[1]?.boxes[0]?.children).toHaveLength(1);
  expect(layout.pages[1]?.boxes[0]?.children[0]?.children[0]?.children[0]?.text).toBe("Three");
});

function fixtureTable(): BoxNode {
  return {
    type: "box",
    style: { flexDirection: "column" as const },
    children: [
      createTableNode({
        id: "table",
        rows: [
          {
            cells: [
              { type: "tableHeader", children: [cellText("Head")] },
              { type: "tableHeader", children: [cellText("Qty")] },
            ],
          },
          {
            cells: [{ children: [cellText("Paper")] }, { children: [cellText("12")] }],
          },
        ],
      }),
    ],
  };
}

function cellText(text: string) {
  return { type: "text" as const, text, style: { lineHeight: 18, font: "16px sans-serif" } };
}

function rendererExtensions() {
  return asArray(TableExtension.renderer);
}

function canvasRenderers() {
  return asArray(TableExtension.renderers?.canvas);
}

function pdfRenderers() {
  return asArray(TableExtension.renderers?.pdf);
}

function canvasTextSummary(commands: ReturnType<typeof createCanvasCommands>) {
  return commands
    .filter((command) => command.type === "fillText")
    .map((command) => [command.text, command.x, command.y]);
}

function pdfTextSummary(commands: ReturnType<typeof createPdfCommands>) {
  return commands
    .filter((command) => command.type === "text")
    .map((command) => [command.text, command.x, command.y]);
}

function canvasBorderSummary(commands: ReturnType<typeof createCanvasCommands>) {
  return commands.filter(isCanvasPathCommandWithStroke).map((command) => ({
    ...rectFromPath(command.path),
    stroke: command.stroke,
    strokeWidth: command.strokeWidth,
  }));
}

function pdfBorderSummary(commands: ReturnType<typeof createPdfCommands>) {
  return commands.filter(isPdfPathCommandWithStroke).map((command) => ({
    ...rectFromPath(command.path),
    stroke: command.stroke,
    strokeWidth: command.strokeWidth,
  }));
}

function isCanvasPathCommandWithStroke(
  command: ReturnType<typeof createCanvasCommands>[number],
): command is Extract<ReturnType<typeof createCanvasCommands>[number], { type: "path" }> & {
  stroke: string;
} {
  return command.type === "path" && command.stroke !== undefined;
}

function isPdfPathCommandWithStroke(
  command: ReturnType<typeof createPdfCommands>[number],
): command is Extract<ReturnType<typeof createPdfCommands>[number], { type: "path" }> & {
  stroke: string;
} {
  return command.type === "path" && command.stroke !== undefined;
}

function customTree(
  node: ReturnType<typeof createRenderDocument>["pages"][number]["nodes"][number] | undefined,
): unknown {
  if (node === undefined) return undefined;
  if (node.kind === "text") return { kind: "text", text: node.text };
  return {
    kind: node.kind,
    ...(node.kind === "custom" ? { name: node.name } : {}),
    children: node.children.map((child) => customTree(child)),
  };
}

function rectFromPath(path: { commands: Array<{ type: string; x?: number; y?: number }> }) {
  const points = path.commands.flatMap((command) =>
    command.x === undefined || command.y === undefined ? [] : [{ x: command.x, y: command.y }],
  );
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
