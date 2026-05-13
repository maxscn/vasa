import { BoxNode, type CanvasRendererExtension } from "@skriva/canvas";
import { horizontalRuleColor, horizontalRuleRect } from "./shared.js";

export const horizontalRuleCanvasRenderer = {
  name: "horizontalRule",
  toCanvasNodes({ node, yOffset }) {
    if (node.name !== "horizontalRule") return undefined;

    return [
      BoxNode({
        key: `${node.key}:rule`,
        kind: "box",
        rect: horizontalRuleRect(node.rect, node.props, yOffset),
        fill: horizontalRuleColor(node.props),
        children: [],
      }),
    ];
  },
} satisfies CanvasRendererExtension;
