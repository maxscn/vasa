import type { CanvasNode, CanvasRendererExtension } from "@vasa/canvas";
import type { RenderCustomNode, RenderNode, RenderTextNode } from "@vasa/renderer";
import {
  isTableCellNode,
  isTableRenderNode,
  rectPath,
  tableBorderColor,
  tableBorderWidth,
  tableCellBackground,
} from "./shared.js";

export const tableCanvasRenderer = {
  name: "table",
  toCanvasNodes({ node, yOffset }) {
    if (!isTableRenderNode(node)) return undefined;
    return renderCustomNodeToCanvasNodes(node, yOffset);
  },
} satisfies CanvasRendererExtension;

function renderCustomNodeToCanvasNodes(node: RenderCustomNode, yOffset: number): CanvasNode[] {
  const children = node.children.flatMap((child) => renderNodeToCanvasNodes(child, yOffset));
  if (!isTableCellNode(node)) return children;

  return [
    ...cellFillCanvasNode(node, yOffset),
    ...children,
    {
      key: `${node.key}:border`,
      kind: "path",
      path: rectPath({ ...node.rect, y: node.rect.y + yOffset }),
      stroke: tableBorderColor(node),
      strokeWidth: tableBorderWidth(node),
    },
  ];
}

function renderNodeToCanvasNodes(node: RenderNode, yOffset: number): CanvasNode[] {
  if (node.kind === "text") return renderTextNodeToCanvasNodes(node, yOffset);
  if (node.kind === "custom") return renderCustomNodeToCanvasNodes(node, yOffset);
  return node.children.flatMap((child) => renderNodeToCanvasNodes(child, yOffset));
}

function renderTextNodeToCanvasNodes(node: RenderTextNode, yOffset: number): CanvasNode[] {
  return node.lines.map((line, index) => ({
    key: `${node.key}:${index}`,
    kind: "textLine",
    text: line.text,
    x: line.x,
    y: line.y + yOffset,
    width: line.width,
    height: line.height,
    font: canvasFontFromLine(line),
    fill: line.color ?? "#111111",
    ...(line.backgroundColor === undefined ? {} : { backgroundColor: line.backgroundColor }),
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
  }));
}

function cellFillCanvasNode(node: RenderCustomNode, yOffset: number): CanvasNode[] {
  const fill = tableCellBackground(node);
  if (fill === undefined) return [];
  return [
    {
      key: `${node.key}:background`,
      kind: "path",
      path: rectPath({ ...node.rect, y: node.rect.y + yOffset }),
      fill,
    },
  ];
}

function canvasFontFromLine(line: RenderTextNode["lines"][number]) {
  if (line.font !== undefined) return line.font;
  const fontSize = line.fontSize ?? line.height;
  const style = line.fontStyle === undefined ? "" : `${line.fontStyle} `;
  const weight = line.fontWeight === undefined ? "" : `${line.fontWeight} `;
  return `${style}${weight}${fontSize}px sans-serif`;
}
