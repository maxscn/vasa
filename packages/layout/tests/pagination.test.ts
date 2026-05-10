import { expect, test } from "vite-plus/test";
import { createMonospaceTextMeasurer, layoutDocument, type BoxNode } from "../src/index.ts";

const measurer = createMonospaceTextMeasurer({ charWidth: 10 });

test("splits overflowing text primitives across pages", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "body",
        text: "one two three four five six",
        style: { lineHeight: 10 },
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 30 },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes[0]?.lines?.map((line) => line.text)).toEqual([
    "one",
    "two",
    "three",
  ]);
  expect(result.pages[1].boxes[0]?.lines?.map((line) => line.text)).toEqual([
    "four",
    "five",
    "six",
  ]);
});

test("uses remaining page space when splitting text after fixed primitives", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      { type: "box", id: "heading", style: { height: 20 } },
      {
        type: "text",
        id: "body",
        text: "alpha beta gamma delta",
        style: { lineHeight: 10 },
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 40 },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes.map((box) => box.id)).toEqual(["heading", "body"]);
  expect(result.pages[0].boxes[1]?.lines?.map((line) => line.text)).toEqual(["alpha", "beta"]);
  expect(result.pages[1].boxes[0]?.lines?.map((line) => line.text)).toEqual(["gamma", "delta"]);
});

test("uses the last line when text only overflows by sub-pixel rounding", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "body",
        text: "alpha beta gamma",
        style: { lineHeight: 10.1 },
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 30 },
    measurer,
  });

  expect(result.pages).toHaveLength(1);
  expect(result.pages[0].boxes[0]?.lines?.map((line) => line.text)).toEqual([
    "alpha",
    "beta",
    "gamma",
  ]);
});

test("keeps trailing hard-break caret lines on the current page", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "body",
        text: "test\n",
        style: { lineHeight: 10, whiteSpace: "pre-wrap" },
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 15 },
    measurer,
  });

  expect(result.pages).toHaveLength(1);
  expect(result.pages[0].boxes[0]?.lines?.map((line) => line.text)).toEqual(["test", ""]);
});

test("moves trailing hard-break caret lines once they start past the page bottom", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "text",
        id: "body",
        text: "test\n\n",
        style: { lineHeight: 10, whiteSpace: "pre-wrap" },
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 15 },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes[0]?.lines?.map((line) => line.text)).toEqual(["test", ""]);
  expect(result.pages[1].boxes[0]?.lines?.map((line) => line.text)).toEqual([""]);
});

test("keeps trailing empty paragraphs when their caret starts inside the page", () => {
  const document: BoxNode = {
    type: "box",
    style: { gap: 4 },
    children: [
      block("intro", 10),
      {
        type: "box",
        id: "empty",
        children: [
          {
            type: "text",
            id: "empty.text",
            text: "",
            style: { lineHeight: 10 },
          },
        ],
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 15 },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes.map((box) => box.id)).toEqual(["intro"]);
  expect(result.pages[1].boxes.map((box) => box.id)).toEqual(["empty"]);
});

test("counts marked empty spacers when paginating", () => {
  const document: BoxNode = {
    type: "box",
    style: { gap: 4 },
    children: [
      block("intro", 10),
      {
        type: "box",
        id: "page-spacer",
        pagination: { preserveEmptyHeight: true },
        style: { height: 10, minHeight: 10 },
        children: [
          {
            type: "text",
            id: "page-spacer.text",
            text: "",
            style: { lineHeight: 10 },
          },
        ],
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 15 },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes.map((box) => box.id)).toEqual(["intro"]);
  expect(result.pages[1].boxes.map((box) => box.id)).toEqual(["page-spacer"]);
});

test("moves trailing empty paragraphs once their caret starts past the page bottom", () => {
  const document: BoxNode = {
    type: "box",
    style: { gap: 4 },
    children: [
      block("intro", 10),
      {
        type: "box",
        id: "empty-1",
        children: [
          {
            type: "text",
            id: "empty-1.text",
            text: "",
            style: { lineHeight: 10 },
          },
        ],
      },
      {
        type: "box",
        id: "empty-2",
        children: [
          {
            type: "text",
            id: "empty-2.text",
            text: "",
            style: { lineHeight: 10 },
          },
        ],
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 15 },
    measurer,
  });

  expect(result.pages).toHaveLength(3);
  expect(result.pages[0].boxes.map((box) => box.id)).toEqual(["intro"]);
  expect(result.pages[1].boxes.map((box) => box.id)).toEqual(["empty-1"]);
  expect(result.pages[2].boxes.map((box) => box.id)).toEqual(["empty-2"]);
});

test("splits overflowing text inside page-level containers", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "box",
        id: "paragraph",
        style: { flexDirection: "column" },
        children: [
          {
            type: "text",
            id: "body",
            text: "supercalifragilistic",
            style: { lineHeight: 10 },
          },
        ],
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 10 },
    measurer,
  });

  expect(result.pages).toHaveLength(4);
  expect(result.pages.map((page) => page.boxes[0]?.children[0]?.lines?.[0]?.text)).toEqual([
    "super",
    "calif",
    "ragil",
    "istic",
  ]);
  expect(result.pages.map((page) => page.boxes[0]?.children[0]?.lines?.[0]?.start)).toEqual([
    0, 5, 10, 15,
  ]);
});

test("splits overflowing inline text inside page-level containers", () => {
  const document: BoxNode = {
    type: "box",
    children: [
      {
        type: "box",
        id: "paragraph",
        style: { flexDirection: "column" },
        children: [
          {
            type: "inlineText",
            id: "body",
            runs: [
              { id: "body.0", text: "alpha beta" },
              { id: "body.1", text: " gamma delta", style: { font: "700 16px sans-serif" } },
            ],
            style: { lineHeight: 10 },
          },
        ],
      },
    ],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 30 },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes[0]?.children[0]?.visualLines?.map((line) => line.width)).toEqual([
    50, 40, 50,
  ]);
  expect(
    result.pages[1].boxes[0]?.children[0]?.visualLines?.flatMap((line) =>
      line.fragments.map((fragment) => fragment.text),
    ),
  ).toEqual(["delta"]);
  expect(
    result.pages[1].boxes[0]?.children[0]?.visualLines?.flatMap((line) =>
      line.fragments.map((fragment) => fragment.start),
    ),
  ).toEqual([7]);
});

test("keeps an oversized fixed box atomic", () => {
  const document: BoxNode = {
    type: "box",
    children: [block("oversized", 60), block("after", 10)],
  };

  const result = layoutDocument(document, {
    page: { width: 50, height: 40 },
    measurer,
  });

  expect(result.pages).toHaveLength(2);
  expect(result.pages[0].boxes.map((box) => box.id)).toEqual(["oversized"]);
  expect(result.pages[1].boxes.map((box) => box.id)).toEqual(["after"]);
});

function block(id: string, height: number): BoxNode {
  return { type: "box", id, style: { height } };
}
