import { buildCanvasScene, createCanvasCommands } from "@vasa/canvas";
import { layoutDocument, type LayoutOptions } from "@vasa/layout";
import { createPdfCommands } from "@vasa/pdf";
import { createRenderDocument } from "@vasa/renderer";
import { expect, test } from "vite-plus/test";
import { createHorizontalRuleNode, HorizontalRule } from "../src/index.ts";

const page: LayoutOptions["page"] = {
  width: 220,
  height: 120,
  margin: 10,
};

test("renders horizontal rules as matching canvas and PDF rectangles", () => {
  const layout = layoutDocument(
    {
      type: "box",
      style: { flexDirection: "column" },
      children: [
        createHorizontalRuleNode({
          id: "rule",
          color: "#64748b",
          thickness: 3,
          style: { height: 15 },
        }),
      ],
    },
    {
      page,
      extensions: asArray(HorizontalRule.layout),
    },
  );
  const renderDocument = createRenderDocument(layout);
  const canvasCommands = createCanvasCommands(
    buildCanvasScene(renderDocument, { extensions: asArray(HorizontalRule.renderers?.canvas) }),
  );
  const pdfCommands = createPdfCommands(renderDocument, page, {
    renderers: asArray(HorizontalRule.renderers?.pdf),
  });

  const expectedRect = { x: 10, y: 16, width: 200, height: 3 };

  expect(canvasCommands).toContainEqual({
    type: "fillRect",
    rect: expectedRect,
    fill: "#64748b",
  });
  expect(pdfCommands).toContainEqual({
    type: "rect",
    rect: expectedRect,
    fill: "#64748b",
  });
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
