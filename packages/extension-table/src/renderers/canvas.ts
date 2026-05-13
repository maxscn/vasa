import { PathNode, type CanvasNode, type CanvasRendererExtension } from "@skriva/canvas";
import type { RenderCustomNode, RenderNode } from "@skriva/renderer";
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
  toCanvasNodes({ node, yOffset, renderNode }) {
    if (!isTableRenderNode(node)) return undefined;
    return renderCustomNodeToCanvasNodes(node, yOffset, renderNode);
  },
} satisfies CanvasRendererExtension;

function renderCustomNodeToCanvasNodes(
  node: RenderCustomNode,
  yOffset: number,
  renderNode: (node: RenderNode) => CanvasNode[],
): CanvasNode[] {
  const children = node.children.flatMap((child) => renderNode(child));
  if (!isTableCellNode(node)) return children;

  return [
    ...cellFillCanvasNode(node, yOffset),
    ...children,
    PathNode({
      key: `${node.key}:border`,
      kind: "path",
      path: rectPath({ ...node.rect, y: node.rect.y + yOffset }),
      stroke: tableBorderColor(node),
      strokeWidth: tableBorderWidth(node),
    }),
  ];
}

function cellFillCanvasNode(node: RenderCustomNode, yOffset: number): CanvasNode[] {
  const fill = tableCellBackground(node);
  if (fill === undefined) return [];
  return [
    PathNode({
      key: `${node.key}:background`,
      kind: "path",
      path: rectPath({ ...node.rect, y: node.rect.y + yOffset }),
      fill,
    }),
  ];
}
