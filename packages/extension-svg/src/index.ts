import type { CanvasRendererExtension } from "@vasa/canvas";
import type { MaybeArray, VasaExtension, VasaExtensionRenderers } from "@vasa/core";
import type { LayoutExtension, LayoutNodeBase } from "@vasa/layout";
import type { PdfRendererExtension } from "@vasa/pdf";
import type { RendererExtension } from "@vasa/renderer";
import { createElement, type ReactElement, type ReactNode } from "react";
import { svgCanvasRenderer } from "./renderers/canvas.js";
import { svgPdfRenderer } from "./renderers/pdf.js";
import type { SvgPathSpec } from "./renderers/shared.js";

export type { SvgPathSpec } from "./renderers/shared.js";

export type SvgNode = LayoutNodeBase<"svg"> & {
  width: number;
  height: number;
  viewBox?: string;
  paths: SvgPathSpec[];
  title?: string;
};

export type SvgExtensionRenderers = {
  canvas: CanvasRendererExtension;
  pdf: PdfRendererExtension;
};

export type SvgProps = Omit<SvgNode, "type"> & {
  children?: ReactNode;
};

export type SvgExtensionOptions = {
  renderer?: MaybeArray<RendererExtension>;
  renderers?: VasaExtensionRenderers<SvgExtensionRenderers>;
  rendererPlacement?: "before" | "after";
};

declare module "@vasa/layout" {
  interface LayoutNodeByType {
    svg: SvgNode;
  }
}

export function createSvgNode(node: Omit<SvgNode, "type">): SvgNode {
  return { type: "svg", ...node };
}

export function Svg(props: SvgProps): ReactElement {
  return createElement("svg", props);
}

export function createSvgExtension(
  options: SvgExtensionOptions = {},
): VasaExtension<SvgExtensionRenderers> {
  return {
    name: "svg",
    layout: svgLayoutExtension,
    renderer: mergeRenderers(svgRenderExtension, options.renderer, options.rendererPlacement),
    renderers: {
      canvas: mergeRenderers(
        defaultSvgRenderers.canvas,
        options.renderers?.canvas,
        options.rendererPlacement,
      ),
      pdf: mergeRenderers(
        defaultSvgRenderers.pdf,
        options.renderers?.pdf,
        options.rendererPlacement,
      ),
    },
  };
}

const svgLayoutExtension = {
  name: "svg",
  match: (node): node is SvgNode => node.type === "svg",
  measure({ node, width, widthMode, maxWidth }) {
    const naturalWidth = Math.max(0, node.width);
    const naturalHeight = Math.max(0, node.height);
    const measuredWidth =
      widthMode === "exactly"
        ? width
        : Math.min(naturalWidth, Number.isFinite(maxWidth) ? maxWidth : naturalWidth);
    const scale = naturalWidth === 0 ? 1 : measuredWidth / naturalWidth;

    return {
      width: measuredWidth,
      height: naturalHeight * scale,
    };
  },
} satisfies LayoutExtension<SvgNode>;

const svgRenderExtension = {
  name: "svg",
  toRenderNode({ box, key }) {
    if (box.type !== "svg") return undefined;

    return {
      key,
      kind: "custom",
      sourceId: box.id,
      name: "svg",
      rect: box.rect,
      props: box.props,
      children: [],
    };
  },
} satisfies RendererExtension;

const defaultSvgRenderers = {
  canvas: svgCanvasRenderer,
  pdf: svgPdfRenderer,
} satisfies SvgExtensionRenderers;

function mergeRenderers<T>(
  defaultRenderer: T,
  renderer: MaybeArray<T> | undefined,
  placement: SvgExtensionOptions["rendererPlacement"] = "after",
): MaybeArray<T> {
  if (renderer === undefined) return defaultRenderer;

  const renderers = Array.isArray(renderer) ? renderer : [renderer];
  return placement === "before" ? [...renderers, defaultRenderer] : [defaultRenderer, ...renderers];
}

export const SvgExtension = createSvgExtension();
