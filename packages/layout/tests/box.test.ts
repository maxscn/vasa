import { expect, test } from "vite-plus/test";
import {
  createMonospaceTextMeasurer,
  createPageGeometry,
  defaultLayoutExtensions,
  layoutDocument,
  layoutPage,
  updatePageMarginGuide,
  textLayoutExtension,
  type BoxNode,
  type LayoutExtension,
  type LayoutNodeBase,
} from "../src/index.ts";

const measurer = createMonospaceTextMeasurer({ charWidth: 10 });

type HorizontalRuleNode = LayoutNodeBase<"horizontalRule"> & {
  thickness: number;
};

type BreakableNode = LayoutNodeBase<"breakable"> & {
  fragments: string[];
};

declare module "../src/index.ts" {
  interface LayoutNodeByType {
    breakable: BreakableNode;
    horizontalRule: HorizontalRuleNode;
  }
}

test("uses Yoga geometry for padded flex rows", () => {
  const result = layoutPage(
    {
      type: "box",
      style: { flexDirection: "row", padding: 8, gap: 4 },
      children: [
        {
          type: "box",
          id: "left",
          style: { width: 20, height: 30 },
        },
        {
          type: "box",
          id: "right",
          style: { width: 40, height: 10 },
        },
      ],
    },
    { x: 0, y: 0, width: 120, height: 80 },
    measurer,
  );

  expect(result.boxes.map((box) => [box.id, box.rect])).toEqual([
    ["left", { x: 8, y: 8, width: 20, height: 30 }],
    ["right", { x: 32, y: 8, width: 40, height: 10 }],
  ]);
});

test("paginates top-level blocks that overflow the page content box", () => {
  const document: BoxNode = {
    type: "box",
    children: [block("one", 40), block("two", 40), block("three", 20)],
  };

  const result = layoutDocument(document, {
    page: { width: 100, height: 100, margin: { top: 10, bottom: 10 } },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes.map((box) => box.id)).toEqual(["one", "two"]);
  expect(result.pages[1].boxes.map((box) => box.id)).toEqual(["three"]);
  expect(result.pages[0].content).toEqual({
    x: 0,
    y: 10,
    width: 100,
    height: 80,
  });
  expect(result.pages[0].bounds).toEqual({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  expect(result.pages[0].margin).toEqual({
    top: 10,
    right: 0,
    bottom: 10,
    left: 0,
  });
});

test("exposes page margin geometry for asymmetric pages", () => {
  expect(
    createPageGeometry({
      width: 120,
      height: 90,
      margin: { top: 8, right: 14, bottom: 12, left: 10 },
    }),
  ).toEqual({
    bounds: { x: 0, y: 0, width: 120, height: 90 },
    content: { x: 10, y: 8, width: 96, height: 70 },
    margin: { top: 8, right: 14, bottom: 12, left: 10 },
    guides: { top: 8, right: 106, bottom: 78, left: 10 },
  });
});

test("updates margin guides while preserving a minimum content area", () => {
  const page = { width: 120, height: 90, margin: { top: 8, right: 14, bottom: 12, left: 10 } };

  expect(updatePageMarginGuide(page, "left", 30)).toEqual({
    top: 8,
    right: 14,
    bottom: 12,
    left: 30,
  });
  expect(updatePageMarginGuide(page, "right", 70, { minContentWidth: 48 })).toEqual({
    top: 8,
    right: 50,
    bottom: 12,
    left: 10,
  });
  expect(updatePageMarginGuide(page, "bottom", 20, { minContentHeight: 32 })).toEqual({
    top: 8,
    right: 14,
    bottom: 50,
    left: 10,
  });
});

test("measures extension nodes without layout engine changes", () => {
  const horizontalRuleLayoutExtension: LayoutExtension<HorizontalRuleNode> = {
    name: "horizontal-rule",
    match: (node): node is HorizontalRuleNode => node.type === "horizontalRule",
    measure({ node, maxWidth }) {
      return { width: Math.min(50, maxWidth), height: node.thickness };
    },
  };

  const result = layoutPage(
    {
      type: "box",
      style: { flexDirection: "row", gap: 4 },
      children: [
        { type: "horizontalRule", id: "rule", thickness: 3 },
        { type: "box", id: "after", style: { width: 10, height: 6 } },
      ],
    },
    { x: 0, y: 0, width: 120, height: 80 },
    measurer,
    0,
    [horizontalRuleLayoutExtension],
  );

  expect(result.boxes.map((box) => [box.id, box.type, box.rect])).toEqual([
    ["rule", "horizontalRule", { x: 0, y: 0, width: 50, height: 3 }],
    ["after", "box", { x: 54, y: 0, width: 10, height: 6 }],
  ]);
});

test("lets extensions split overflowing primitives for pagination", () => {
  const breakableExtension: LayoutExtension<BreakableNode> = {
    name: "breakable",
    match: (node): node is BreakableNode => node.type === "breakable",
    measure({ node, maxWidth }) {
      return { width: maxWidth, height: node.fragments.length * 10 };
    },
    materialize({ node, rect }) {
      return {
        id: node.id,
        type: "breakable",
        rect,
        props: { fragments: node.fragments },
        children: [],
      };
    },
    split({ node, trial, content }) {
      const box = trial.boxes.at(-1);
      const fittingCount = Math.floor((content.y + content.height - (box?.rect.y ?? 0)) / 10);

      if (fittingCount <= 0 || fittingCount >= node.fragments.length) {
        return { fitting: undefined, remaining: node };
      }

      return {
        fitting: { ...node, fragments: node.fragments.slice(0, fittingCount) },
        remaining: { ...node, fragments: node.fragments.slice(fittingCount) },
      };
    },
  };

  const result = layoutDocument(
    {
      type: "box",
      children: [{ type: "breakable", id: "story", fragments: ["a", "b", "c"] }],
    },
    {
      page: { width: 100, height: 25 },
      measurer,
      extensions: [breakableExtension],
    },
  );

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes[0].props).toEqual({ fragments: ["a", "b"] });
  expect(result.pages[1].boxes[0].props).toEqual({ fragments: ["c"] });
});

test("ships text measurement as the default layout extension", () => {
  expect(defaultLayoutExtensions).toContain(textLayoutExtension);
  expect(
    textLayoutExtension.measure?.({
      node: { type: "text", text: "abc" },
      width: 100,
      widthMode: "at-most",
      maxWidth: 100,
      measurer,
    }),
  ).toEqual({ width: 30, height: 20 });
});

test("keeps mixed inline text runs on one line with run-specific metrics", () => {
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "inlineText",
          id: "title",
          style: { font: "normal 400 16px sans-serif", lineHeight: 20, whiteSpace: "pre-wrap" },
          runs: [
            {
              id: "0.0",
              text: "Vasa editor ",
              style: { font: "normal 400 16px sans-serif", lineHeight: 20 },
            },
            {
              id: "0.1",
              text: "demo",
              style: { font: "normal 700 28px sans-serif", lineHeight: 35 },
            },
          ],
        },
      ],
    },
    { x: 0, y: 0, width: 300, height: 80 },
    {
      measureText(input) {
        const charWidth = input.font.includes("28px") ? 18 : 8;
        return {
          width: input.text.length * charWidth,
          height: input.lineHeight,
          lineCount: 1,
          lines: [{ text: input.text, start: 0, width: input.text.length * charWidth }],
        };
      },
    },
  );

  expect(result.boxes[0].lines).toEqual([
    expect.objectContaining({
      sourceId: "0.0",
      text: "Vasa editor ",
      x: 0,
      y: 0,
      width: 96,
      height: 35,
      fontSize: 16,
      fontWeight: "400",
    }),
    expect.objectContaining({
      sourceId: "0.1",
      text: "demo",
      x: 96,
      y: 0,
      width: 72,
      height: 35,
      fontSize: 28,
      fontWeight: "700",
    }),
  ]);
});

function block(id: string, height: number): BoxNode {
  return { type: "box", id, style: { height } };
}
