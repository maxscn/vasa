import { expect, test } from "vite-plus/test";
import {
  createMonospaceTextMeasurer,
  layoutDocument,
  layoutPage,
  type BoxNode,
  type LayoutBox,
  type LayoutExtension,
  type LayoutNode,
  type LayoutNodeBase,
  type LayoutPage,
  type LayoutStyle,
} from "../src/index.ts";

const measurer = createMonospaceTextMeasurer({ charWidth: 10 });

type AtomicWidgetNode = LayoutNodeBase<"atomicWidget"> & {
  width: number;
  height: number;
  label: string;
};

type TestTableNode = LayoutNodeBase<"testTable"> & {
  style?: LayoutStyle;
  children: TestTableRowNode[];
};

type TestTableRowNode = LayoutNodeBase<"testTableRow"> & {
  style?: LayoutStyle;
  children: LayoutNode[];
};

declare module "../src/index.ts" {
  interface LayoutNodeByType {
    atomicWidget: AtomicWidgetNode;
    testTable: TestTableNode;
    testTableRow: TestTableRowNode;
  }
}

test("keeps semantic document state separate from derived layout artifacts", () => {
  const document: BoxNode = {
    type: "box",
    style: { flexDirection: "column" },
    children: [
      {
        type: "text",
        id: "body",
        text: "alpha beta",
        style: { lineHeight: 12 },
      },
    ],
  };
  const before = structuredClone(document);

  const withCaretMap = layoutDocument(document, {
    page: { width: 120, height: 80, margin: 10 },
    measurer,
  });
  const withoutCaretMap = layoutDocument(document, {
    page: { width: 120, height: 80, margin: 10 },
    measurer,
    textGrid: false,
  });

  expect(document).toEqual(before);
  expect(withCaretMap.pages[0]?.boxes[0]).toMatchObject({
    id: "body",
    rect: { x: 10, y: 10, width: 100, height: 12 },
    lines: [{ text: "alpha beta", x: 10, y: 10 }],
  });
  expect(withCaretMap.pages[0]?.boxes[0]?.textGrid?.rows[0]?.spaces).toHaveLength(10);
  expect(withoutCaretMap.pages[0]?.boxes[0]?.textGrid).toBeUndefined();
});

test("recomputes wrapping from layout context while preserving source positions", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "body",
        text: "alpha beta gamma",
        style: { lineHeight: 10 },
      },
    ],
  };

  const narrow = layoutDocument(document, {
    page: { width: 60, height: 80 },
    measurer,
  });
  const wide = layoutDocument(document, {
    page: { width: 160, height: 80 },
    measurer,
  });

  expect(narrow.pages[0]?.boxes[0]?.lines?.map((line) => [line.text, line.start])).toEqual([
    ["alpha", 0],
    ["beta", 6],
    ["gamma", 11],
  ]);
  expect(wide.pages[0]?.boxes[0]?.lines?.map((line) => [line.text, line.start])).toEqual([
    ["alpha beta gamma", 0],
  ]);
  expect(document.children?.[0]).toMatchObject({ text: "alpha beta gamma" });
});

test("uses grapheme clusters as caret and hit-test spaces", () => {
  const text = "e\u0301👨‍👩‍👧‍👦🇸🇪";
  const result = layoutPage(
    {
      type: "box",
      children: [{ type: "text", id: "unicode", text, style: { lineHeight: 12 } }],
    },
    { x: 0, y: 0, width: 400, height: 80 },
    measurer,
  );

  expect(result.boxes[0]?.textGrid?.rows[0]?.spaces).toMatchObject([
    { text: "e\u0301", startOffset: 0, endOffset: 2 },
    { text: "👨‍👩‍👧‍👦", startOffset: 2, endOffset: 13 },
    { text: "🇸🇪", startOffset: 13, endOffset: 17 },
  ]);
});

test("derives caret stops and visual line bounds from the same line snapshot", () => {
  const result = layoutPage(
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
    { x: 24, y: 32, width: 300, height: 80 },
    measurer,
  );
  const textBox = result.boxes[0];
  const visualLine = textBox?.visualLines?.[0];
  const row = textBox?.textGrid?.rows[0];
  const spaces = row?.spaces ?? [];

  expect(row).toMatchObject({ y: visualLine?.y, height: visualLine?.height });
  expect(spaces[0]).toMatchObject({ x: visualLine?.x, startOffset: 0 });
  expect(spaces.at(-1)).toMatchObject({
    endOffset: "alpha beta".length,
    x: 24 + 90,
    width: 10,
  });
  expect(spaces.reduce((total, space) => total + space.width, 0)).toBe(visualLine?.width);
});

test("keeps inline widgets atomic through measurement, materialization, and pagination", () => {
  const result = layoutDocument(
    {
      type: "box",
      style: { flexDirection: "column" },
      children: [
        { type: "atomicWidget", id: "chart", width: 40, height: 25, label: "Revenue chart" },
        { type: "text", id: "caption", text: "caption", style: { lineHeight: 10 } },
      ],
    },
    {
      page: { width: 80, height: 30 },
      measurer,
      extensions: [atomicWidgetExtension],
    },
  );

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0]?.boxes[0]).toMatchObject({
    id: "chart",
    type: "atomicWidget",
    rect: { x: 0, y: 0, width: 40, height: 25 },
    props: { label: "Revenue chart" },
    children: [],
  });
  expect(result.pages[1]?.boxes[0]).toMatchObject({ id: "caption", text: "caption" });
});

test("splits table-like structures between rows, not through cell content", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "testTable",
        id: "table",
        children: [row("row-1", "One"), row("row-2", "Two"), row("row-3", "Three")],
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 120, height: 50 },
    measurer,
    extensions: [testTableExtension],
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0]?.boxes[0]?.children.map((child) => child.id)).toEqual(["row-1", "row-2"]);
  expect(result.pages[1]?.boxes[0]?.children.map((child) => child.id)).toEqual(["row-3"]);
  expect(result.pages[1]?.boxes[0]?.children[0]?.children[0]?.lines?.[0]?.text).toBe("Three");
});

test("preserves canonical source ranges across soft page breaks", () => {
  const result = layoutDocument(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "story",
          text: "one two three four five six",
          style: { lineHeight: 10 },
        },
      ],
    },
    { page: { width: 50, height: 30 }, measurer },
  );

  expect(result.pages).toHaveLength(2);
  expect(textLines(result.pages[0])).toEqual([
    ["one", 0, "one two three four five six"],
    ["two", 4, "one two three four five six"],
    ["three", 8, "one two three four five six"],
  ]);
  expect(textLines(result.pages[1])).toEqual([
    ["four", 14, "one two three four five six"],
    ["five", 19, "one two three four five six"],
    ["six", 24, "one two three four five six"],
  ]);
});

test("produces deterministic layout snapshots for a fixed document and layout context", () => {
  const document: BoxNode = {
    type: "box",
    style: { flexDirection: "column", gap: 2 },
    children: [
      { type: "text", id: "title", text: "Title", style: { lineHeight: 12 } },
      { type: "text", id: "body", text: "alpha beta gamma", style: { lineHeight: 10 } },
    ],
  };
  const options = { page: { width: 80, height: 80, margin: 8 }, measurer };

  expect(layoutDocument(document, options)).toEqual(layoutDocument(document, options));
});

test("lets canvas and PDF projections consume the same layout snapshot", () => {
  const layout = layoutDocument(
    {
      type: "box",
      children: [{ type: "text", id: "body", text: "alpha beta gamma", style: { lineHeight: 10 } }],
    },
    { page: { width: 60, height: 80, margin: 5 }, measurer },
  );

  expect(canvasProjection(layout.pages)).toEqual(pdfProjection(layout.pages));
  expect(canvasProjection(layout.pages)).toEqual([
    { page: 0, text: "alpha", x: 5, y: 5, width: 50, height: 10 },
    { page: 0, text: "beta", x: 5, y: 15, width: 40, height: 10 },
    { page: 0, text: "gamma", x: 5, y: 25, width: 50, height: 10 },
  ]);
});

const atomicWidgetExtension = {
  name: "atomic-widget",
  match: (node): node is AtomicWidgetNode => node.type === "atomicWidget",
  measure({ node }) {
    return { width: node.width, height: node.height };
  },
  materialize({ node, rect }) {
    return {
      id: node.id,
      type: "atomicWidget",
      rect,
      props: { label: node.label },
      children: [],
    };
  },
} satisfies LayoutExtension<AtomicWidgetNode>;

const testTableExtension = {
  name: "test-table",
  match: (node): node is TestTableNode => node.type === "testTable",
  split({ node, trial, content }) {
    const tableBox = trial.boxes.find((box) => box.id === node.id);
    if (tableBox === undefined) return undefined;

    const splitIndex = tableBox.children.findIndex(
      (child) => child.rect.y + child.rect.height > content.y + content.height,
    );
    if (splitIndex <= 0 || splitIndex >= node.children.length) return undefined;

    return {
      fitting: { ...node, children: node.children.slice(0, splitIndex) },
      remaining: { ...node, children: node.children.slice(splitIndex) },
    };
  },
} satisfies LayoutExtension<TestTableNode>;

function row(id: string, text: string): TestTableRowNode {
  return {
    type: "testTableRow",
    id,
    style: { height: 20, flexDirection: "column" },
    children: [{ type: "text", id: `${id}.text`, text, style: { lineHeight: 10 } }],
  };
}

function textLines(page: LayoutPage) {
  return page.boxes.flatMap((box) =>
    textBoxes(box).flatMap((textBox) =>
      (textBox.lines ?? []).map((line) => [line.text, line.start, line.sourceText]),
    ),
  );
}

function textBoxes(box: LayoutBox): LayoutBox[] {
  return [
    ...(box.lines === undefined ? [] : [box]),
    ...box.children.flatMap((child) => textBoxes(child)),
  ];
}

function canvasProjection(pages: LayoutPage[]) {
  return renderProjection(pages);
}

function pdfProjection(pages: LayoutPage[]) {
  return renderProjection(pages);
}

function renderProjection(pages: LayoutPage[]) {
  return pages.flatMap((page) =>
    page.boxes.flatMap((box) =>
      textBoxes(box).flatMap((textBox) =>
        (textBox.lines ?? []).map((line) => ({
          page: page.index,
          text: line.text,
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
        })),
      ),
    ),
  );
}
