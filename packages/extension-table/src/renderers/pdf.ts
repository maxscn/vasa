import type { PdfCommand, PdfRendererExtension } from "@skriva/pdf";
import type { RenderCustomNode, RenderNode } from "@skriva/renderer";
import {
  isTableCellNode,
  isTableRenderNode,
  rectPath,
  tableBorderColor,
  tableBorderWidth,
  tableCellBackground,
} from "./shared.js";

export const tablePdfRenderer = {
  name: "table",
  toPdfCommands({ node, renderNode }) {
    if (!isTableRenderNode(node)) return undefined;
    return renderCustomNodeToPdfCommands(node, renderNode);
  },
} satisfies PdfRendererExtension;

function renderCustomNodeToPdfCommands(
  node: RenderCustomNode,
  renderNode: (node: RenderNode) => PdfCommand[],
): PdfCommand[] {
  const children = node.children.flatMap((child) => renderNode(child));
  if (!isTableCellNode(node)) return children;

  return [
    ...cellFillPdfCommand(node),
    ...children,
    {
      type: "path",
      path: rectPath(node.rect),
      stroke: tableBorderColor(node),
      strokeWidth: tableBorderWidth(node),
    },
  ];
}

function cellFillPdfCommand(node: RenderCustomNode): PdfCommand[] {
  const fill = tableCellBackground(node);
  if (fill === undefined) return [];
  return [{ type: "rect", rect: node.rect, fill }];
}
