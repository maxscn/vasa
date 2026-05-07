import type { Rect } from "@vasa/layout";
import type { RenderCustomNode, SvgPath } from "@vasa/renderer";

export function rectPath(rect: Rect): SvgPath {
  return {
    commands: [
      { type: "moveTo", x: rect.x, y: rect.y },
      { type: "lineTo", x: rect.x + rect.width, y: rect.y },
      { type: "lineTo", x: rect.x + rect.width, y: rect.y + rect.height },
      { type: "lineTo", x: rect.x, y: rect.y + rect.height },
      { type: "closePath" },
    ],
  };
}

export function tableBorderColor(node: RenderCustomNode) {
  return typeof node.props?.borderColor === "string" ? node.props.borderColor : "#cbd5e1";
}

export function tableBorderWidth(node: RenderCustomNode) {
  return typeof node.props?.borderWidth === "number" ? Math.max(0.5, node.props.borderWidth) : 1;
}

export function tableCellBackground(node: RenderCustomNode) {
  if (typeof node.props?.backgroundColor === "string") return node.props.backgroundColor;
  if (node.name === "tableHeader") return "#f8fafc";
  return undefined;
}

export function isTableRenderNode(node: RenderCustomNode) {
  return node.name === "table" || node.name === "tableRow" || isTableCellNode(node);
}

export function isTableCellNode(node: RenderCustomNode) {
  return node.name === "tableCell" || node.name === "tableHeader";
}
