import { createTextLineOutline, type TextOutlineFont } from "@vasa/renderer";
import { expect, test } from "vite-plus/test";
import { analyzeWebGlScene } from "../src/index.ts";

const outlineFont = {
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
        advanceWidth: 600,
        getPath(x: number, y: number, fontSize: number) {
          return {
            commands: [
              { type: "M", x, y },
              { type: "L", x: x + fontSize * 0.5, y },
              { type: "L", x: x + fontSize * 0.5, y: y - fontSize },
              { type: "L", x, y: y - fontSize },
              { type: "Z" },
            ],
          };
        },
      };
    },
  },
} satisfies TextOutlineFont;

test("analyzes outlined text as renderable WebGL text geometry", () => {
  const scene = textScene({ outline: true });

  expect(analyzeWebGlScene(scene)).toMatchObject({
    textLineCount: 1,
    textLineWithOutlineCount: 1,
  });
  expect(analyzeWebGlScene(scene).textTriangleCount).toBeGreaterThan(0);
});

test("detects text lines that would need a non-WebGL fallback", () => {
  const scene = textScene({ outline: false });

  expect(analyzeWebGlScene(scene)).toMatchObject({
    textLineCount: 1,
    textLineWithOutlineCount: 0,
    textTriangleCount: 0,
  });
});

test("uses the same outline path primitive as the canvas and PDF parity path", () => {
  const line = { text: "A", x: 10, y: 20 };
  const outline = createTextLineOutline(line, { font: outlineFont, fontSize: 16 });

  expect(analyzeWebGlScene(textScene({ outline })).textTriangleCount).toBeGreaterThan(0);
});

test("keeps strikethrough at its font metric offset with outlined glyphs", () => {
  const scene = textScene({ outline: true, textDecorationLine: "line-through" });
  const analysis = analyzeWebGlScene(scene);
  const decoration = analysis.decorationPrimitives.at(0);

  expect(decoration).toMatchObject({ text: "A", line: "line-through" });
  expect(decoration!.rect.y).toBe(26);
});

function textScene({
  outline,
  textDecorationLine,
}: {
  outline: boolean | ReturnType<typeof createTextLineOutline>;
  textDecorationLine?: "underline" | "line-through";
}) {
  const line = { text: "A", x: 10, y: 20 };
  return {
    pages: [
      {
        key: "page:0",
        index: 0,
        rect: { x: 0, y: 0, width: 100, height: 100 },
        children: [
          {
            key: "text:0",
            kind: "textLine" as const,
            text: line.text,
            x: line.x,
            y: line.y,
            width: 10,
            height: 16,
            font: "400 16px Test, sans-serif",
            fill: "#111111",
            ...(textDecorationLine === undefined
              ? {}
              : { textDecorationLine, textDecorationOffset: 6, textDecorationThickness: 2 }),
            ...(outline === false
              ? {}
              : {
                  outline:
                    outline === true
                      ? createTextLineOutline(line, { font: outlineFont, fontSize: 16 })
                      : outline,
                }),
          },
        ],
      },
    ],
  };
}
