import { expect, test } from "vite-plus/test";
import { createMonospaceTextMeasurer, layoutPage, type TextMeasurer } from "../src/index.ts";

const measurer = createMonospaceTextMeasurer({ charWidth: 10 });

test("wraps text into deterministic line boxes", () => {
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "body",
          text: "alpha beta gamma",
          style: { lineHeight: 12 },
        },
      ],
    },
    { x: 24, y: 32, width: 100, height: 300 },
    measurer,
  );

  const body = result.boxes[0];

  expect(body.rect).toEqual({ x: 24, y: 32, width: 100, height: 24 });
  expect(body.lines).toEqual([
    { text: "alpha beta", start: 0, x: 24, y: 32, width: 100, height: 12 },
    { text: "gamma", start: 11, x: 24, y: 44, width: 50, height: 12 },
  ]);
});

test("wrapped text occupies the available line width", () => {
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "body",
          text: "alpha gamma",
          style: { lineHeight: 12 },
        },
      ],
    },
    { x: 24, y: 32, width: 60, height: 300 },
    measurer,
  );

  expect(result.boxes[0].rect).toEqual({ x: 24, y: 32, width: 60, height: 24 });
  expect(result.boxes[0].lines).toEqual([
    { text: "alpha", start: 0, x: 24, y: 32, width: 50, height: 12 },
    { text: "gamma", start: 6, x: 24, y: 44, width: 50, height: 12 },
  ]);
});

test("keeps symbols with the previous word when wrapping", () => {
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "body",
          text: "alpha,beta",
          style: { lineHeight: 12 },
        },
      ],
    },
    { x: 24, y: 32, width: 50, height: 300 },
    measurer,
  );

  expect(result.boxes[0].lines).toEqual([
    { text: "alpha,", start: 0, x: 24, y: 32, width: 60, height: 12 },
    { text: "beta", start: 6, x: 24, y: 44, width: 40, height: 12 },
  ]);
});

test("materializes text into variable-width grid spaces with row-owned height", () => {
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "text",
          id: "body",
          text: "Hi",
          style: { lineHeight: 12 },
        },
      ],
    },
    { x: 24, y: 32, width: 100, height: 300 },
    measurer,
  );

  expect(result.boxes[0].textGrid).toEqual({
    rows: [
      {
        y: 32,
        height: 12,
        spaces: [
          {
            id: "body:0:0:0:0",
            sourceId: "body",
            sourceText: "Hi",
            text: "H",
            startOffset: 0,
            endOffset: 1,
            x: 24,
            width: 10,
          },
          {
            id: "body:0:0:0:1",
            sourceId: "body",
            sourceText: "Hi",
            text: "i",
            startOffset: 1,
            endOffset: 2,
            x: 34,
            width: 10,
          },
        ],
      },
    ],
    connections: [{ from: "body:0:0:0:0", to: "body:0:0:0:1", break: "forbidden" }],
  });
});

test("records allowed and forbidden grid break relationships without naming words", () => {
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
    { x: 24, y: 32, width: 300, height: 300 },
    measurer,
  );

  expect(result.boxes[0].textGrid?.connections.map((connection) => connection.break)).toEqual([
    "forbidden",
    "forbidden",
    "forbidden",
    "forbidden",
    "allowed",
    "allowed",
    "forbidden",
    "forbidden",
    "forbidden",
  ]);
});

test("inline text grid keeps subscript on the line while row owns height", () => {
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "inlineText",
          id: "formula",
          runs: [
            { id: "formula.0", text: "H" },
            { id: "formula.1", text: "2", style: { font: "10px sans-serif", lineHeight: 12 } },
            { id: "formula.2", text: "O" },
          ],
          style: { lineHeight: 20 },
        },
      ],
    },
    { x: 24, y: 32, width: 300, height: 300 },
    measurer,
  );

  expect(result.boxes[0].textGrid?.rows).toEqual([
    {
      y: 32,
      height: 20,
      spaces: [
        {
          id: "formula.0:0:0:0:0",
          sourceId: "formula.0",
          sourceText: "H",
          text: "H",
          startOffset: 0,
          endOffset: 1,
          x: 24,
          width: 10,
        },
        {
          id: "formula.1:0:1:0:0",
          sourceId: "formula.1",
          sourceText: "2",
          text: "2",
          startOffset: 0,
          endOffset: 1,
          x: 34,
          width: 10,
        },
        {
          id: "formula.2:0:2:0:0",
          sourceId: "formula.2",
          sourceText: "O",
          text: "O",
          startOffset: 0,
          endOffset: 1,
          x: 44,
          width: 10,
        },
      ],
    },
  ]);
});

test("does not add extra inline style gap when the whitespace glyph is wide enough", () => {
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "inlineText",
          id: "label",
          runs: [
            { id: "label.0", text: "Label ", style: { font: "400 16px sans-serif" } },
            { id: "label.1", text: "bold", style: { font: "700 16px sans-serif" } },
          ],
          style: { lineHeight: 20 },
        },
      ],
    },
    { x: 24, y: 32, width: 300, height: 300 },
    measurer,
  );

  expect(result.boxes[0]?.lines?.map((line) => [line.text, line.x, line.width])).toEqual([
    ["Label ", 24, 60],
    ["bold", 84, 40],
  ]);
});

test("tops up inline style gap only when the whitespace glyph is too narrow", () => {
  const narrowSpaceMeasurer = createCharacterWidthMeasurer((character) =>
    character === " " ? 1 : 10,
  );
  const result = layoutPage(
    {
      type: "box",
      children: [
        {
          type: "inlineText",
          id: "label",
          runs: [
            { id: "label.0", text: "A ", style: { font: "400 16px sans-serif" } },
            { id: "label.1", text: "B", style: { font: "700 16px sans-serif" } },
          ],
          style: { lineHeight: 20 },
        },
      ],
    },
    { x: 24, y: 32, width: 300, height: 300 },
    narrowSpaceMeasurer,
  );

  expect(result.boxes[0]?.lines?.map((line) => [line.text, line.x, line.width])).toEqual([
    ["A ", 24, 11],
    ["B", 38, 10],
  ]);
  expect(result.boxes[0]?.rect.width).toBe(24);
});

function createCharacterWidthMeasurer(
  widthForCharacter: (character: string) => number,
): TextMeasurer {
  return {
    measureText(input) {
      const width = Array.from(input.text).reduce(
        (total, character) => total + widthForCharacter(character),
        0,
      );
      return {
        width,
        height: input.lineHeight,
        lineCount: 1,
        lines: [{ text: input.text, width }],
      };
    },
  };
}
