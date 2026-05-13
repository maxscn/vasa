import type { CanvasRendererExtension } from "@skriva/canvas";
import {
  mergeExtensionRenderers,
  type ExtensionRendererPlacement,
  type MaybeArray,
  type SkrivaExtension,
  type SkrivaExtensionRenderers,
} from "@skriva/core";
import type { LayoutExtension, LayoutNodeBase } from "@skriva/layout";
import type { PdfRendererExtension } from "@skriva/pdf";
import type { RendererExtension } from "@skriva/renderer";
import { createElement, type DragEvent, type ReactElement, type ReactNode } from "react";
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
  renderers?: SkrivaExtensionRenderers<SvgExtensionRenderers>;
  rendererPlacement?: ExtensionRendererPlacement;
};

export type SvgImportOptions = {
  id?: string;
  title?: string;
  marginTop?: number;
};

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

declare module "@skriva/layout" {
  interface LayoutNodeByType {
    svg: SvgNode;
  }
}

export function createSvgNode(node: Omit<SvgNode, "type">): SvgNode {
  return { type: "svg", ...node };
}

export function svgFilesFromDataTransfer(dataTransfer: DataTransfer) {
  const itemFiles = Array.from(dataTransfer.items ?? []).flatMap((item) => {
    if (item.kind !== "file" || !isSvgTransferType(item.type)) return [];
    const file = item.getAsFile();
    return file === null ? [] : [file];
  });
  const files = itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files ?? []);

  return files.filter(
    (file) => isSvgTransferType(file.type) || file.name.toLowerCase().endsWith(".svg"),
  );
}

export async function readSvgFileAsNode(file: File, options: SvgImportOptions = {}) {
  return createSvgNodeFromSource(await file.text(), {
    ...options,
    title: options.title ?? file.name,
  });
}

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

export function createSvgNodeFromSource(source: string, options: SvgImportOptions = {}) {
  const svg = new DOMParser().parseFromString(source, "image/svg+xml").querySelector("svg");
  if (svg === null) throw new Error("SVG source does not contain an <svg> element.");

  return createSvgNodeFromElement(svg, options);
}

export function createSvgNodeFromElement(svg: SVGSVGElement, options: SvgImportOptions = {}) {
  const viewBox = svg.getAttribute("viewBox") ?? undefined;
  const viewBoxSize = viewBox?.split(/[\s,]+/).map(Number);
  const width = svgLength(svg.getAttribute("width")) ?? viewBoxSize?.[2] ?? 180;
  const height = svgLength(svg.getAttribute("height")) ?? viewBoxSize?.[3] ?? 92;
  const paths = Array.from(
    svg.querySelectorAll("path, rect, circle, ellipse, line, polygon, polyline"),
    (element) => svgShapeSpec(element),
  ).flat();

  if (paths.length === 0) throw new Error("SVG source does not contain supported paths.");

  return createSvgNode({
    id: options.id ?? `svg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    width,
    height,
    viewBox,
    title: options.title ?? svg.querySelector("title")?.textContent ?? undefined,
    style: { margin: { top: options.marginTop ?? 10 } },
    paths,
  });
}

export function Svg(props: SvgProps): ReactElement {
  return createElement("svg", props);
}

export function createSvgExtension(
  options: SvgExtensionOptions = {},
): SkrivaExtension<SvgExtensionRenderers> {
  return {
    name: "svg",
    layout: svgLayoutExtension,
    renderer: mergeExtensionRenderers(
      svgRenderExtension,
      options.renderer,
      options.rendererPlacement,
    ),
    renderers: {
      canvas: mergeExtensionRenderers(
        defaultSvgRenderers.canvas,
        options.renderers?.canvas,
        options.rendererPlacement,
      ),
      pdf: mergeExtensionRenderers(
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

const defaultSvgRenderers: SvgExtensionRenderers = {
  canvas: svgCanvasRenderer,
  pdf: svgPdfRenderer,
};

export const SvgExtension = createSvgExtension();

function svgShapeSpec(element: Element): SvgPathSpec[] {
  const d = svgShapePath(element);
  if (d === undefined) return [];

  return [
    {
      d,
      fill: svgPaint(element.getAttribute("fill")),
      stroke: svgPaint(element.getAttribute("stroke")),
      strokeWidth: svgLength(element.getAttribute("stroke-width")),
    },
  ];
}

function svgShapePath(element: Element) {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "path") return element.getAttribute("d") ?? undefined;
  if (tagName === "rect") return svgRectPath(element);
  if (tagName === "circle") {
    return svgEllipsePath(
      svgLength(element.getAttribute("cx")) ?? 0,
      svgLength(element.getAttribute("cy")) ?? 0,
      svgLength(element.getAttribute("r")) ?? 0,
      svgLength(element.getAttribute("r")) ?? 0,
    );
  }
  if (tagName === "ellipse") {
    return svgEllipsePath(
      svgLength(element.getAttribute("cx")) ?? 0,
      svgLength(element.getAttribute("cy")) ?? 0,
      svgLength(element.getAttribute("rx")) ?? 0,
      svgLength(element.getAttribute("ry")) ?? 0,
    );
  }
  if (tagName === "line") {
    return `M${svgLength(element.getAttribute("x1")) ?? 0} ${svgLength(element.getAttribute("y1")) ?? 0} L${svgLength(element.getAttribute("x2")) ?? 0} ${svgLength(element.getAttribute("y2")) ?? 0}`;
  }
  if (tagName === "polygon") return svgPointsPath(element, true);
  if (tagName === "polyline") return svgPointsPath(element, false);

  return undefined;
}

function svgRectPath(rect: Element) {
  const x = svgLength(rect.getAttribute("x")) ?? 0;
  const y = svgLength(rect.getAttribute("y")) ?? 0;
  const width = svgLength(rect.getAttribute("width")) ?? 0;
  const height = svgLength(rect.getAttribute("height")) ?? 0;
  if (width <= 0 || height <= 0) return undefined;

  return `M${x} ${y} L${x + width} ${y} L${x + width} ${y + height} L${x} ${y + height} Z`;
}

function svgEllipsePath(cx: number, cy: number, rx: number, ry: number) {
  if (rx <= 0 || ry <= 0) return undefined;
  const kappa = 0.5522847498307936;
  const ox = rx * kappa;
  const oy = ry * kappa;

  return [
    `M${cx - rx} ${cy}`,
    `C${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry}`,
    `C${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy}`,
    `C${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry}`,
    `C${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy}`,
    "Z",
  ].join(" ");
}

function svgPointsPath(element: Element, closed: boolean) {
  const points = element.getAttribute("points")?.trim();
  if (points === undefined || points.length === 0) return undefined;

  const values = points.split(/[\s,]+/).map(Number);
  const commands: string[] = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    commands.push(`${commands.length === 0 ? "M" : "L"}${x} ${y}`);
  }

  if (commands.length === 0) return undefined;
  return closed ? `${commands.join(" ")} Z` : commands.join(" ");
}

function isSvgTransferType(type: string) {
  return type === "image/svg+xml" || type === "text/xml" || type === "application/xml";
}

function svgLength(value: string | null) {
  if (value === null) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function svgPaint(value: string | null) {
  return value === null || value === "none" ? undefined : value;
}
