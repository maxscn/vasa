import type { CanvasRendererExtension } from "@skriva/canvas";
import { Node, type SkrivaExtension } from "@skriva/core";
import type { LayoutExtension, LayoutNodeBase } from "@skriva/layout";
import type { PdfRendererExtension } from "@skriva/pdf";
import { horizontalRuleCanvasRenderer } from "./renderers/canvas.js";
import { horizontalRulePdfRenderer } from "./renderers/pdf.js";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type HorizontalRuleNode = LayoutNodeBase<"horizontalRule"> & {
  color?: string;
  thickness?: number;
};

export type HorizontalRuleRenderers = {
  canvas: CanvasRendererExtension;
  pdf: PdfRendererExtension;
};

declare module "@skriva/layout" {
  interface LayoutNodeByType {
    horizontalRule: HorizontalRuleNode;
  }
}

export function createHorizontalRuleNode(
  node: Omit<HorizontalRuleNode, "type"> = {},
): HorizontalRuleNode {
  return { type: "horizontalRule", ...node };
}

export const HorizontalRule: SkrivaExtension<HorizontalRuleRenderers> = {
  name: "horizontalRule",
  tiptap: Node.create({
    name: "horizontalRule",
    group: "block",
    parseHTML() {
      return [{ tag: "hr" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["hr", HTMLAttributes];
    },
    addCommands() {
      return {
        setHorizontalRule:
          () =>
          ({ commands }: CommandProps) =>
            commands.insertContent({ type: this.name }),
      };
    },
  } as Parameters<typeof Node.create>[0]),
  layout: {
    name: "horizontalRule",
    match: (node): node is HorizontalRuleNode => node.type === "horizontalRule",
    measure({ node, maxWidth }) {
      const height = typeof node.style?.height === "number" ? node.style.height : 12;
      return {
        width: maxWidth,
        height,
      };
    },
  } satisfies LayoutExtension<HorizontalRuleNode>,
  renderers: {
    canvas: horizontalRuleCanvasRenderer,
    pdf: horizontalRulePdfRenderer,
  },
};
