import {
  readSvgFileAsNode,
  SvgExtension as SvgEnrichment,
  svgFilesFromDataTransfer,
  type SvgNode,
} from "@skriva/extension-svg";
import { Extension } from "@skriva/core";
import type { DragEvent } from "react";
import { createSkrivaTiptapExtension } from "../enrichment.ts";

export {
  createSvgExtension,
  createSvgNode,
  createSvgNodeFromElement,
  createSvgNodeFromSource,
  readSvgFileAsNode,
  svgFilesFromDataTransfer,
  type SvgExtensionOptions,
  type SvgExtensionRenderers,
  type SvgImportOptions,
  type SvgNode,
  type SvgPathSpec,
  type SvgProps,
} from "@skriva/extension-svg";

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

export const Svg = createSkrivaTiptapExtension(
  Extension.create({
    name: "svg",
  }),
  { skriva: [SvgEnrichment] },
);

export const SvgExtension = Svg;
