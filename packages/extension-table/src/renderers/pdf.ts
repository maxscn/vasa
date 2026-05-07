import type { PdfCommand, PdfRendererExtension } from "@vasa/pdf";
import type { RenderCustomNode, RenderNode, RenderTextNode } from "@vasa/renderer";
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
  toPdfCommands({ node }) {
    if (!isTableRenderNode(node)) return undefined;
    return renderCustomNodeToPdfCommands(node);
  },
} satisfies PdfRendererExtension;

function renderCustomNodeToPdfCommands(node: RenderCustomNode): PdfCommand[] {
  const children = node.children.flatMap((child) => renderNodeToPdfCommands(child));
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

function renderNodeToPdfCommands(node: RenderNode): PdfCommand[] {
  if (node.kind === "text") return renderTextNodeToPdfCommands(node);
  if (node.kind === "custom") return renderCustomNodeToPdfCommands(node);
  return node.children.flatMap((child) => renderNodeToPdfCommands(child));
}

function renderTextNodeToPdfCommands(node: RenderTextNode): PdfCommand[] {
  return node.lines.map((line) => ({
    type: "text",
    text: line.text,
    x: line.x,
    y: line.y,
    fontSize: Math.max(1, Math.min(line.fontSize ?? line.height, 72)),
    ...(line.fontWeight === undefined ? {} : { fontWeight: line.fontWeight }),
    ...(line.fontStyle === undefined ? {} : { fontStyle: line.fontStyle }),
    ...(line.color === undefined ? {} : { fill: line.color }),
  }));
}

function cellFillPdfCommand(node: RenderCustomNode): PdfCommand[] {
  const fill = tableCellBackground(node);
  if (fill === undefined) return [];
  return [{ type: "rect", rect: node.rect, fill }];
}
