import { DEFAULT_FONT, type LayoutBox } from "@skriva/layout";
import { createTextLineOutline, type RenderTextNode } from "@skriva/renderer";
import { CSS_NUMBER_PRECISION, DEFAULT_CANVAS_TEXT_FILL } from "../constants.js";
import type {
  CanvasRendererOptions,
  CanvasSerializableTextLineNode,
  CanvasTextLineNode,
  CanvasTextPaint,
} from "../canvas/index.js";
import { TextLineNode } from "../canvas/nodes.js";

export function renderTextNodeToCanvasNodes(
  node: RenderTextNode,
  yOffset: number,
  options: Pick<CanvasRendererOptions, "text">,
): CanvasSerializableTextLineNode[] {
  return node.lines.map((line, lineIndex) =>
    renderTextLineToCanvasNode({
      key: `${node.key}:${lineIndex}`,
      line,
      paint: resolveRenderTextPaint(node, lineIndex, options.text),
      yOffset,
    }),
  );
}

export function renderTextLineToCanvasNode({
  key,
  line,
  paint,
  yOffset,
}: {
  key: string;
  line: RenderTextNode["lines"][number];
  paint: CanvasTextPaint;
  yOffset: number;
}): CanvasSerializableTextLineNode {
  const y = line.y + yOffset;
  const context = { line, paint, y };
  const node: CanvasTextLineNode = {
    key,
    kind: "textLine",
    text: line.text,
    x: line.x,
    y,
    width: line.width,
    height: line.height,
    font: canvasFontForTextLine(paint, line),
    fill: paint.fill ?? line.color ?? DEFAULT_CANVAS_TEXT_FILL,
  };

  return TextLineNode(
    textLineTransforms.reduce((current, transform) => transform(current, context), node),
  );
}

type TextLineTransformContext = {
  line: RenderTextNode["lines"][number];
  paint: CanvasTextPaint;
  y: number;
};

type TextLineTransform = (
  node: CanvasTextLineNode,
  context: TextLineTransformContext,
) => CanvasTextLineNode;

const textLineTransforms: TextLineTransform[] = [
  withTextBackground,
  withTextDecoration,
  withPixelSnap,
  withTextOutline,
];

function withTextBackground(
  node: CanvasTextLineNode,
  { line }: TextLineTransformContext,
): CanvasTextLineNode {
  if (line.backgroundColor === undefined) return node;
  return { ...node, backgroundColor: line.backgroundColor };
}

function withTextDecoration(
  node: CanvasTextLineNode,
  { line }: TextLineTransformContext,
): CanvasTextLineNode {
  return {
    ...node,
    ...(line.textDecorationLine === undefined
      ? {}
      : { textDecorationLine: line.textDecorationLine }),
    ...(line.textDecorationColor === undefined
      ? {}
      : { textDecorationColor: line.textDecorationColor }),
    ...(line.textDecorationOffset === undefined
      ? {}
      : { textDecorationOffset: line.textDecorationOffset }),
    ...(line.textDecorationThickness === undefined
      ? {}
      : { textDecorationThickness: line.textDecorationThickness }),
  };
}

function withPixelSnap(
  node: CanvasTextLineNode,
  { paint }: TextLineTransformContext,
): CanvasTextLineNode {
  if (paint.pixelSnap === undefined) return node;
  return { ...node, pixelSnap: paint.pixelSnap };
}

function withTextOutline(
  node: CanvasTextLineNode,
  { line, paint, y }: TextLineTransformContext,
): CanvasTextLineNode {
  if (paint.outlineFont === undefined) return node;

  return {
    ...node,
    outline: createTextLineOutline(
      { ...line, y },
      {
        font: paint.outlineFont,
        fontSize: paint.fontSize ?? line.fontSize ?? line.height,
        letterSpacing: paint.letterSpacing,
        embolden: paint.embolden,
        skewX: paint.skewX,
      },
    ),
  };
}

export function resolveRenderTextPaint(
  node: RenderTextNode,
  lineIndex: number,
  paint: CanvasRendererOptions["text"],
): CanvasTextPaint {
  if (typeof paint !== "function") return paint ?? {};
  const line = node.lines[lineIndex];

  return paint(
    {
      id: line?.sourceId ?? node.sourceId,
      type: "text",
      rect: node.rect,
      text: line?.sourceText ?? node.text,
      lines: node.lines,
      children: [],
    } satisfies LayoutBox,
    lineIndex,
  );
}

export function canvasFontForTextLine(
  paint: CanvasTextPaint,
  line: RenderTextNode["lines"][number],
) {
  const font = paint.font ?? line.font ?? DEFAULT_FONT;
  const fontSize = paint.fontSize ?? line.fontSize;
  if (fontSize === undefined) return font;
  return font.replace(/(\d+(?:\.\d+)?)px/, `${formatCssNumber(fontSize)}px`);
}

function formatCssNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(CSS_NUMBER_PRECISION)));
}
