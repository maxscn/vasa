import { expect, test } from "vite-plus/test";
import type { LayoutBox, LayoutResult } from "@vasa/layout";
import { readFileSync } from "node:fs";
import {
  createTextLineOutline,
  createRenderDocument,
  createRenderRegistry,
  createRenderer,
  parseTextOutlineFont,
  textOutlinePathBounds,
  type RenderNode,
  type Renderer,
  type TextOutlineFont,
} from "../src/index.ts";

test("creates a deterministic render document from layout pages", () => {
  const document = createRenderDocument(layoutResult());

  expect(document).toEqual({
    pages: [
      {
        index: 0,
        rect: { x: 0, y: 0, width: 100, height: 120 },
        content: { x: 10, y: 12, width: 80, height: 96 },
        nodes: [
          {
            key: "box:section",
            kind: "box",
            sourceId: "section",
            rect: { x: 10, y: 12, width: 80, height: 20 },
            children: [
              {
                key: "text:body",
                kind: "text",
                sourceId: "body",
                rect: { x: 10, y: 12, width: 80, height: 20 },
                text: "Hello world",
                lines: [
                  {
                    text: "Hello",
                    x: 10,
                    y: 12,
                    width: 50,
                    height: 10,
                  },
                  {
                    text: "world",
                    x: 10,
                    y: 22,
                    width: 50,
                    height: 10,
                  },
                ],
                children: [],
              },
            ],
          },
        ],
      },
    ],
  });
});

test("lets renderer extensions replace layout boxes with custom render nodes", () => {
  const document = createRenderDocument(layoutResult(), {
    extensions: [
      {
        name: "horizontal-rule",
        toRenderNode({ box, key }) {
          if (box.id !== "section") return undefined;

          return {
            key,
            kind: "custom",
            sourceId: box.id,
            name: "horizontalRule",
            rect: box.rect,
            props: { thickness: 2 },
            children: [],
          };
        },
      },
    ],
  });

  expect(document.pages[0]?.nodes).toEqual([
    {
      key: "box:section",
      kind: "custom",
      sourceId: "section",
      name: "horizontalRule",
      rect: { x: 10, y: 12, width: 80, height: 20 },
      props: { thickness: 2 },
      children: [],
    },
  ]);
});

test("dispatches layout boxes through registered render components", () => {
  const registry = createRenderRegistry();
  registry.register({
    name: "callout",
    match: ({ box }) => box.id === "section",
    render: ({ box, children, key }) => ({
      key,
      kind: "custom",
      sourceId: box.id,
      name: "callout",
      rect: box.rect,
      props: { tone: "info" },
      children,
    }),
  });

  const document = createRenderDocument(layoutResult(), { registry });

  expect(document.pages[0]?.nodes[0]).toEqual({
    key: "box:section",
    kind: "custom",
    sourceId: "section",
    name: "callout",
    rect: { x: 10, y: 12, width: 80, height: 20 },
    props: { tone: "info" },
    children: [
      {
        key: "text:body",
        kind: "text",
        sourceId: "body",
        rect: { x: 10, y: 12, width: 80, height: 20 },
        text: "Hello world",
        lines: [
          { text: "Hello", x: 10, y: 12, width: 50, height: 10 },
          { text: "world", x: 10, y: 22, width: 50, height: 10 },
        ],
        children: [],
      },
    ],
  });
});

test("applies variable font coordinates to outline glyph paths", () => {
  const bytes = readFileSync(
    new URL("../../pdf/tests/fixtures/fonts/google/inter/Inter-Regular.ttf", import.meta.url),
  );
  const regular = parseTextOutlineFont(bytes, { variations: { wght: 400 } });
  const bold = parseTextOutlineFont(bytes, { variations: { wght: 700 } });
  const regularBounds = textOutlinePathBounds(
    createTextLineOutline({ text: "bold", x: 0, y: 0 }, { font: regular, fontSize: 32 }),
  );
  const boldBounds = textOutlinePathBounds(
    createTextLineOutline({ text: "bold", x: 0, y: 0 }, { font: bold, fontSize: 32 }),
  );

  expect(regularBounds).toBeDefined();
  expect(boldBounds).toBeDefined();
  expect(boldBounds!.width).toBeGreaterThan(regularBounds!.width);
});

test("falls through registered components before using default render components", () => {
  const registry = createRenderRegistry();
  registry.register({
    name: "miss",
    match: ({ box }) => box.id === "missing",
    render: ({ box, key }) => ({
      key,
      kind: "custom",
      sourceId: box.id,
      name: "miss",
      rect: box.rect,
      children: [],
    }),
  });

  expect(createRenderDocument(layoutResult(), { registry })).toEqual(
    createRenderDocument(layoutResult()),
  );
});

test("creates small reusable renderers over the shared render document contract", () => {
  const renderer: Renderer<{ keys: string[] }, { prefix: string }> = createRenderer({
    render(document, options) {
      return {
        keys: document.pages.flatMap((page) =>
          page.nodes.map((node) => `${options?.prefix ?? ""}${node.key}`),
        ),
      };
    },
  });

  expect(renderer.render(createRenderDocument(layoutResult()), { prefix: "node:" })).toEqual({
    keys: ["node:box:section"],
  });
});

test("can embolden text outlines without changing layout metrics", () => {
  const path = createTextLineOutline(
    { text: "A", x: 10, y: 20 },
    { font: outlineFont(), fontSize: 16, embolden: 0.5 },
  );

  expect(path.commands).toEqual([
    { type: "moveTo", x: 10, y: 32 },
    { type: "lineTo", x: 18, y: 32 },
    { type: "closePath" },
    { type: "moveTo", x: 10.5, y: 32 },
    { type: "lineTo", x: 18.5, y: 32 },
    { type: "closePath" },
  ]);
});

test("can skew text outlines for faux italic rendering", () => {
  const font = outlineFont({
    getPath(x: number, y: number, fontSize: number) {
      return {
        commands: [{ type: "M", x, y: y - fontSize }, { type: "L", x, y }, { type: "Z" }],
      };
    },
  });
  const path = createTextLineOutline(
    { text: "A", x: 10, y: 20 },
    { font, fontSize: 16, skewX: 0.25 },
  );

  expect(path.commands).toEqual([
    { type: "moveTo", x: 14, y: 16 },
    { type: "lineTo", x: 10, y: 32 },
    { type: "closePath" },
  ]);
});

test("exposes enough context for extensions to preserve default children", () => {
  const seen: Array<{ box: LayoutBox; children: RenderNode[] }> = [];

  createRenderDocument(layoutResult(), {
    extensions: [
      {
        name: "observe",
        toRenderNode(context) {
          seen.push({ box: context.box, children: context.children });
          return undefined;
        },
      },
    ],
  });

  const section = seen.find((entry) => entry.box.id === "section");

  expect(section?.children[0]?.key).toBe("text:body");
});

function layoutResult(): LayoutResult {
  return {
    pages: [
      {
        index: 0,
        bounds: { x: 0, y: 0, width: 100, height: 120 },
        content: { x: 10, y: 12, width: 80, height: 96 },
        margin: { top: 12, right: 10, bottom: 12, left: 10 },
        boxes: [
          {
            id: "section",
            type: "box",
            rect: { x: 10, y: 12, width: 80, height: 20 },
            children: [
              {
                id: "body",
                type: "text",
                rect: { x: 10, y: 12, width: 80, height: 20 },
                text: "Hello world",
                lines: [
                  { text: "Hello", x: 10, y: 12, width: 50, height: 10 },
                  { text: "world", x: 10, y: 22, width: 50, height: 10 },
                ],
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function outlineFont(
  glyph: {
    getPath?: (x: number, y: number, fontSize: number) => { commands: unknown[] };
  } = {},
): TextOutlineFont {
  return {
    unitsPerEm: 1000,
    ascender: 750,
    descender: -250,
    source: {
      unitsPerEm: 1000,
      ascender: 750,
      descender: -250,
      charToGlyph(_character: string) {
        return {
          index: 0,
          advanceWidth: 500,
          getPath(x: number, y: number, fontSize: number) {
            if (glyph.getPath !== undefined) return glyph.getPath(x, y, fontSize);
            return {
              commands: [{ type: "M", x, y }, { type: "L", x: x + fontSize / 2, y }, { type: "Z" }],
            };
          },
        } as ReturnType<TextOutlineFont["source"]["charToGlyph"]>;
      },
    },
  };
}
