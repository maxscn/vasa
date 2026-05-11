import {
  createMonospaceTextMeasurer,
  layoutDocument,
  type BoxNode,
  type LayoutNode,
} from "@vasa/layout";
import { createRenderDocument, type TextOutlineFont } from "@vasa/renderer";
import { expect, test } from "vite-plus/test";
import {
  Box,
  buildCanvasScene,
  createCanvasCommands,
  createCanvasRenderer,
  renderReactToLayoutTree,
  Text,
  reconcileCanvasScenes,
  type CanvasCommand,
  type CanvasSurface,
} from "../src/index.ts";
import { createElement } from "react";

const measurer = createMonospaceTextMeasurer({ charWidth: 10 });

test("builds a scene from layout text lines and offsets paginated pages", () => {
  const scene = buildCanvasScene(layoutDocument(document(), page()), { pageGap: 12 });

  expect(scene.pages).toHaveLength(2);
  expect(scene.pages[0].rect).toEqual({ x: 0, y: 0, width: 120, height: 40 });
  expect(scene.pages[1].rect).toEqual({ x: 0, y: 52, width: 120, height: 40 });
  expect(scene.pages[0].children).toEqual([
    {
      key: "text:one:0",
      kind: "textLine",
      text: "alpha beta",
      x: 10,
      y: 4,
      width: 100,
      height: 10,
      font: "16px sans-serif",
      fill: "#111111",
    },
    {
      key: "text:one:1",
      kind: "textLine",
      text: "gamma",
      x: 10,
      y: 14,
      width: 50,
      height: 10,
      font: "16px sans-serif",
      fill: "#111111",
    },
  ]);
  expect(scene.pages[1].children[0]).toMatchObject({
    key: "text:two:0",
    kind: "textLine",
    text: "delta",
    x: 10,
    y: 56,
  });
});

test("builds the same scene from the shared render document contract", () => {
  const layout = layoutDocument(document(), page());
  const scene = buildCanvasScene(createRenderDocument(layout), { pageGap: 12 });

  expect(scene.pages[0]?.children[0]).toMatchObject({
    key: "text:one:0",
    kind: "textLine",
    text: "alpha beta",
    x: 10,
    y: 4,
  });
  expect(scene.pages[1]?.children[0]).toMatchObject({
    key: "text:two:0",
    kind: "textLine",
    text: "delta",
    x: 10,
    y: 56,
  });
});

test("paints blockquote borders from shared render document boxes", () => {
  const scene = buildCanvasScene({
    pages: [
      {
        index: 0,
        rect: { x: 0, y: 0, width: 120, height: 80 },
        content: { x: 10, y: 10, width: 100, height: 60 },
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
  });

  expect(scene.pages[0]?.children[0]).toEqual({
    key: "box:quote:blockquote-border",
    kind: "box",
    rect: { x: 10, y: 12, width: 3, height: 24 },
    fill: "#d1d5db",
    children: [],
  });
});

test("creates ordered canvas commands with page clears before drawing", () => {
  const scene = buildCanvasScene(layoutDocument(document(), page()), {
    pageBackground: "#f8f8f8",
    pageGap: 12,
  });

  expect(createCanvasCommands(scene, { pageBackground: "#f8f8f8" })).toEqual([
    { type: "clearRect", rect: { x: 0, y: 0, width: 120, height: 40 } },
    { type: "fillRect", rect: { x: 0, y: 0, width: 120, height: 40 }, fill: "#f8f8f8" },
    {
      type: "fillText",
      text: "alpha beta",
      x: 10,
      y: 4,
      font: "16px sans-serif",
      fill: "#111111",
    },
    {
      type: "fillText",
      text: "gamma",
      x: 10,
      y: 14,
      font: "16px sans-serif",
      fill: "#111111",
    },
    { type: "clearRect", rect: { x: 0, y: 52, width: 120, height: 40 } },
    { type: "fillRect", rect: { x: 0, y: 52, width: 120, height: 40 }, fill: "#f8f8f8" },
    {
      type: "fillText",
      text: "delta",
      x: 10,
      y: 56,
      font: "16px sans-serif",
      fill: "#111111",
    },
  ]);
});

test("paints different text runs with distinct font size and weight commands", () => {
  const richDocument: BoxNode = {
    type: "box",
    children: [
      {
        type: "box",
        id: "paragraph",
        style: { flexDirection: "row" },
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
      },
    ],
  };
  const scene = buildCanvasScene(layoutDocument(richDocument, page()), {
    pageGap: 12,
    text: (box) => ({
      font: box.id === "bold" ? "700 22px Roboto, sans-serif" : "400 14px Roboto, sans-serif",
    }),
  });

  expect(createCanvasCommands(scene).filter((command) => command.type === "fillText")).toEqual([
    {
      type: "fillText",
      text: "Regular",
      x: 10,
      y: 4,
      font: "400 14px Roboto, sans-serif",
      fill: "#111111",
    },
    {
      type: "fillText",
      text: "Bold",
      x: 80,
      y: 4,
      font: "700 22px Roboto, sans-serif",
      fill: "#111111",
    },
  ]);
});

test("applies italic skew to canvas outline text paths", () => {
  const renderDocument = createRenderDocument(
    layoutDocument(
      {
        type: "box",
        children: [
          {
            type: "text",
            id: "italic",
            text: "A",
            style: { font: "italic 400 16px sans-serif", lineHeight: 20 },
          },
        ],
      },
      { page: { width: 80, height: 60, margin: 10 }, measurer },
    ),
  );
  const regular = buildCanvasScene(renderDocument, {
    text: { outlineFont: outlineFont(), fontSize: 16 },
  }).pages[0]?.children[0];
  const italic = buildCanvasScene(renderDocument, {
    text: { outlineFont: outlineFont(), fontSize: 16, skewX: 0.35 },
  }).pages[0]?.children[0];

  expect(regular).toMatchObject({ kind: "textLine" });
  expect(italic).toMatchObject({ kind: "textLine" });
  if (regular?.kind !== "textLine" || italic?.kind !== "textLine") return;
  expect(regular.outline?.commands[0]).toEqual({ type: "moveTo", x: 10, y: 6 });
  expect(italic.outline?.commands[0]).toEqual({ type: "moveTo", x: 15.6, y: 6 });
});

test("keeps shared render document text commands aligned with canvas text commands", () => {
  const richDocument: BoxNode = {
    type: "box",
    children: [textBlock("small", "Small", 12), textBlock("large", "Large", 24)],
  };
  const renderDocument = createRenderDocument(
    layoutDocument(richDocument, {
      page: { width: 120, height: 100, margin: { top: 4, right: 10, bottom: 4, left: 10 } },
      measurer,
    }),
  );
  const scene = buildCanvasScene(renderDocument, { pageGap: 12 });

  expect(textCommandSummary(createCanvasCommands(scene))).toEqual([
    ["Small", 10, 4],
    ["Large", 10, 16],
  ]);
});

test("preserves render document line fonts when native canvas text is used", () => {
  const richDocument: BoxNode = {
    type: "box",
    children: [
      {
        type: "inlineText",
        runs: [
          {
            id: "regular",
            text: "Vasa editor ",
            style: { font: "normal 400 16px Liberation Sans", lineHeight: 35 },
          },
          {
            id: "bold",
            text: "demo",
            style: { font: "normal 700 28px Liberation Sans", lineHeight: 35 },
          },
        ],
      },
    ],
  };
  const renderDocument = createRenderDocument(
    layoutDocument(richDocument, {
      page: { width: 220, height: 72, margin: 10 },
      measurer: {
        measureText(input) {
          const isLarge = input.font.includes("28px");
          const charWidth = isLarge ? 18 : 8;

          return {
            width: input.text.length * charWidth,
            height: input.lineHeight,
            lineCount: 1,
            lines: [{ text: input.text, start: 0, width: input.text.length * charWidth }],
          };
        },
      },
    }),
  );

  expect(
    createCanvasCommands(
      buildCanvasScene(renderDocument, {
        text: () => ({ fill: "#1f2937" }),
      }),
    ).filter((command) => command.type === "fillText"),
  ).toEqual([
    {
      type: "fillText",
      text: "Vasa editor ",
      x: 10,
      y: 10,
      font: "normal 400 16px Liberation Sans",
      fill: "#1f2937",
    },
    {
      type: "fillText",
      text: "demo",
      x: 106,
      y: 10,
      font: "normal 700 28px Liberation Sans",
      fill: "#1f2937",
    },
  ]);
});

test("applies paint font size when native canvas text has no CSS font", () => {
  const renderDocument = createRenderDocument(
    layoutDocument(
      {
        type: "box",
        children: [
          {
            type: "inlineText",
            runs: [
              {
                id: "base",
                text: "H",
                style: { lineHeight: 20 },
              },
              {
                id: "script",
                text: "2",
                style: { lineHeight: 20, verticalAlign: "sub" },
              },
            ],
          },
        ],
      },
      {
        page: { width: 80, height: 60, margin: 10 },
        measurer: {
          measureText(input) {
            const fontSize = Number(/(\d+(?:\.\d+)?)px/.exec(input.font)?.[1] ?? 16);
            return {
              width: input.text.length * fontSize * 0.5,
              height: input.lineHeight,
              lineCount: 1,
              lines: [{ text: input.text, start: 0, width: input.text.length * fontSize * 0.5 }],
            };
          },
        },
      },
    ),
  );

  const commands = createCanvasCommands(
    buildCanvasScene(renderDocument, {
      text: (box, lineIndex) => ({
        fill: "#111111",
        fontSize: box.lines?.[lineIndex]?.verticalAlign === "sub" ? 10 : 16,
      }),
    }),
  ).filter((command) => command.type === "fillText");

  expect(commands.map((command) => [command.text, command.font])).toEqual([
    ["H", "16px sans-serif"],
    ["2", "10px sans-serif"],
  ]);
});

test("applies paint font size to underline and strike decoration offsets", () => {
  const renderDocument = createRenderDocument(
    layoutDocument(
      {
        type: "box",
        children: [
          {
            type: "inlineText",
            runs: [
              {
                id: "under",
                text: "under",
                style: { lineHeight: 20, textDecorationLine: "underline" },
              },
              {
                id: "strike",
                text: "strike",
                style: { lineHeight: 20, textDecorationLine: "line-through" },
              },
            ],
          },
        ],
      },
      { page: { width: 120, height: 60, margin: 10 }, measurer },
    ),
  );

  const commands = createCanvasCommands(
    buildCanvasScene(renderDocument, {
      text: () => ({ fill: "#111111", fontSize: 10 }),
    }),
  );
  const text = commands.filter(
    (command): command is Extract<CanvasCommand, { type: "fillText" }> =>
      command.type === "fillText",
  );
  const decorations = commands.filter(
    (command): command is Extract<CanvasCommand, { type: "fillRect" }> =>
      command.type === "fillRect" && command.fill === "#111111",
  );

  expect(decorations.map((command, index) => command.rect.y - (text[index]?.y ?? 0))).toEqual([
    10, 6,
  ]);
});

test("keeps strikethrough at its font metric offset with outlined text", () => {
  const layout = layoutDocument(
    {
      type: "box",
      children: [
        {
          type: "inlineText",
          runs: [
            {
              id: "strike",
              text: "strike",
              style: {
                lineHeight: 20,
                textDecorationLine: "line-through",
                textDecorationOffset: 6,
                textDecorationThickness: 2,
              },
            },
          ],
        },
      ],
    },
    { page: { width: 120, height: 60, margin: 10 }, measurer },
  );
  const commands = createCanvasCommands(
    buildCanvasScene(createRenderDocument(layout), {
      text: () => ({ fill: "#111111", fontSize: 10, outlineFont: outlineFont() }),
    }),
  );
  const text = commands.find(
    (command): command is Extract<CanvasCommand, { type: "fillText" }> =>
      command.type === "fillText",
  );
  const decoration = commands.find(
    (command): command is Extract<CanvasCommand, { type: "fillRect" }> =>
      command.type === "fillRect" && command.fill === "#111111",
  );
  const line = layout.pages[0]?.boxes[0]?.lines?.[0];

  expect(text).toBeUndefined();
  expect(line).toBeDefined();
  expect(decoration?.rect.y).toBe(Math.round(line!.y + 6));
});

test("reconciles retained, updated, mounted, and unmounted scene nodes", () => {
  const previous = buildCanvasScene(layoutDocument(document(), page()), { pageGap: 12 });
  const nextDocument: BoxNode = {
    type: "box",
    children: [textBlock("one", "alpha beta changed"), textBlock("three", "epsilon", 20)],
  };
  const next = buildCanvasScene(layoutDocument(nextDocument, page()), { pageGap: 12 });

  expect(
    reconcileCanvasScenes(previous, next).map((operation) => [operation.type, operation.key]),
  ).toEqual([
    ["unmount", "text:two:0"],
    ["retain", "page:0"],
    ["retain", "text:one:0"],
    ["update", "text:one:1"],
    ["retain", "page:1"],
    ["mount", "text:three:0"],
  ]);
});

test("renderer skips repainting when reconciliation only retains nodes", () => {
  const surface = recordingSurface();
  const renderer = createCanvasRenderer(surface, { pageGap: 12 });
  const layout = layoutDocument(document(), page());

  const first = renderer.render(layout);
  const second = renderer.render(layout);

  expect(first.didPaint).toBe(true);
  expect(second.didPaint).toBe(false);
  expect(second.commands).toEqual([]);
  expect(surface.calls.filter((call) => call[0] === "fillText")).toHaveLength(3);
});

test("exports React primitives through the canvas reconciler", () => {
  const tree = renderReactToLayoutTree(
    createElement(
      Box,
      { id: "section", style: { padding: 8 } },
      createElement(Text, { id: "body", style: { lineHeight: 14 } }, "Hello canvas"),
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
        children: [{ type: "text", id: "body", text: "Hello canvas", style: { lineHeight: 14 } }],
      },
    ],
  });
});

test("preserves custom canvas primitives for renderer extensions", () => {
  const Badge = createElement("badge", {
    id: "brand",
    label: "Vasa",
    style: { width: 32, height: 12 },
  });

  expect(renderReactToLayoutTree(Badge).children?.[0]).toEqual({
    type: "badge",
    id: "brand",
    label: "Vasa",
    style: { width: 32, height: 12 },
    children: [],
  });
});

function document(): BoxNode {
  return {
    type: "box",
    children: [textBlock("one", "alpha beta gamma"), textBlock("two", "delta", 20)],
  };
}

function page() {
  return {
    page: { width: 120, height: 40, margin: { top: 4, right: 10, bottom: 4, left: 10 } },
    measurer,
  };
}

function textBlock(id: string, text: string, height?: number): LayoutNode {
  return {
    type: "text",
    id,
    text,
    style: { lineHeight: 10, height },
  };
}

function recordingSurface(): CanvasSurface & { calls: Array<[string, ...unknown[]]> } {
  const calls: Array<[string, ...unknown[]]> = [];

  return {
    calls,
    clearRect: (...args) => calls.push(["clearRect", ...args]),
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    strokeRect: (...args) => calls.push(["strokeRect", ...args]),
    fillText: (...args) => calls.push(["fillText", ...args]),
  };
}

function textCommandSummary(commands: ReturnType<typeof createCanvasCommands>) {
  return commands
    .filter((command) => command.type === "fillText")
    .map((command) => [command.text, command.x, command.y]);
}

function outlineFont(): TextOutlineFont {
  return {
    unitsPerEm: 1000,
    ascender: 750,
    source: {
      charToGlyph() {
        return {
          advanceWidth: 500,
          getPath(x: number, y: number, fontSize: number) {
            return {
              commands: [{ type: "M", x, y: y - fontSize }, { type: "L", x, y }, { type: "Z" }],
            };
          },
        };
      },
    } as TextOutlineFont["source"],
  };
}
