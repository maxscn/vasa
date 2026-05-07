import type { PdfRendererExtension } from "@vasa/pdf";
import { horizontalRuleColor, horizontalRuleRect } from "./shared.js";

export const horizontalRulePdfRenderer = {
  name: "horizontalRule",
  toPdfCommands({ node }) {
    if (node.name !== "horizontalRule") return undefined;

    return [
      {
        type: "rect",
        rect: horizontalRuleRect(node.rect, node.props),
        fill: horizontalRuleColor(node.props),
      },
    ];
  },
} satisfies PdfRendererExtension;
