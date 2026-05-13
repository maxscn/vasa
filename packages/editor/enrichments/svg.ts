export * from "@skriva/extension-svg";

import { readSvgFileAsNode, svgFilesFromDataTransfer, type SvgNode } from "@skriva/extension-svg";
import type { DragEvent } from "react";

export type SvgDropHandlerOptions = {
  addNodes: (nodes: SvgNode[]) => void;
};

export type SvgSurfaceDropHandler = {
  canDrop: (event: DragEvent<HTMLElement>) => boolean;
  drop: (
    event: DragEvent<HTMLElement>,
    context: { focusEditor: () => void },
  ) => boolean | Promise<boolean>;
};

export function createSvgDropHandler(options: SvgDropHandlerOptions): SvgSurfaceDropHandler {
  return {
    canDrop: (event) => svgFilesFromDataTransfer(event.dataTransfer).length > 0,
    async drop(event, context) {
      const files = svgFilesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) return false;

      const nodes = await Promise.all(files.map((file) => readSvgFileAsNode(file)));
      options.addNodes(nodes);
      context.focusEditor();
      return true;
    },
  };
}
