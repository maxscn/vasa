import type { LayoutBox, LayoutPage, LayoutResult, Rect } from "@skriva/layout";
import type { RenderDocument, RenderNode, RenderPage } from "@skriva/renderer";
import {
  CANVAS_ORIGIN,
  DEFAULT_BLOCKQUOTE_BORDER_WIDTH,
  DEFAULT_CANVAS_PAGE_GAP,
} from "../constants.js";
import { renderTextLineToCanvasNode, renderTextNodeToCanvasNodes } from "../transforms/text.js";
import { BoxNode } from "./nodes.js";
import { Rect as CanvasRect } from "./rect.js";
import type {
  CanvasNode,
  CanvasPageSize,
  CanvasRendererExtension,
  CanvasRendererOptions,
  CanvasPageNode,
  CanvasScene,
} from "./types.js";

export function Scene(
  document: LayoutResult | RenderDocument,
  options: CanvasRendererOptions = {},
): CanvasScene {
  return {
    pages: document.pages.map((page) =>
      isRenderPage(page)
        ? RenderPageCanvasNode({ page, options })
        : LayoutPageCanvasNode({ page, options }),
    ),
  };
}

function LayoutPageCanvasNode({
  page,
  options,
}: {
  page: LayoutPage;
  options: CanvasRendererOptions;
}): CanvasPageNode {
  const rect = pageRect(
    typeof options.pageSize === "function" ? options.pageSize(page) : options.pageSize,
    page.bounds,
  );
  const pageGap = options.pageGap ?? DEFAULT_CANVAS_PAGE_GAP;
  const yOffset = page.index * (rect.height + pageGap);

  return {
    key: `page:${page.index}`,
    index: page.index,
    rect: { ...rect, y: yOffset },
    children: page.boxes.flatMap((box, index) =>
      LayoutBoxCanvasNode({ box, options, path: `${index}`, yOffset }),
    ),
  };
}

function RenderPageCanvasNode({
  page,
  options,
}: {
  page: RenderPage;
  options: CanvasRendererOptions;
}): CanvasPageNode {
  const pageSize = typeof options.pageSize === "function" ? undefined : options.pageSize;
  const rect = pageRect(pageSize, page.rect);
  const pageGap = options.pageGap ?? DEFAULT_CANVAS_PAGE_GAP;
  const yOffset = page.index * (rect.height + pageGap);

  return {
    key: `page:${page.index}`,
    index: page.index,
    rect: { ...rect, y: yOffset },
    children: page.nodes.flatMap((node) => RenderNodeCanvasNodes({ node, yOffset, options })),
  };
}

type CanvasLayoutBoxTransformContext = {
  box: LayoutBox;
  options: CanvasRendererOptions;
  path: string;
  yOffset: number;
};

function LayoutBoxCanvasNode({
  box,
  options,
  path,
  yOffset,
}: CanvasLayoutBoxTransformContext): CanvasNode[] {
  if (box.type !== "box") return LayoutTextCanvasNodes({ box, options, path, yOffset });

  const paint = typeof options.box === "function" ? options.box(box) : options.box;
  const children = box.children.flatMap((child, index) =>
    LayoutBoxCanvasNode({ box: child, options, path: `${path}.${index}`, yOffset }),
  );

  if (paint === undefined) return children;

  return [
    BoxNode({
      key: `box:${box.id ?? path}`,
      kind: "box",
      rect: offsetRect(box.rect, yOffset),
      fill: paint.fill,
      stroke: paint.stroke,
      children,
    }),
  ];
}

function LayoutTextCanvasNodes({
  box,
  options,
  path,
  yOffset,
}: CanvasLayoutBoxTransformContext): CanvasNode[] {
  return (box.lines ?? []).map((line, lineIndex) =>
    renderTextLineToCanvasNode({
      key: `text:${box.id ?? path}:${lineIndex}`,
      line,
      paint:
        typeof options.text === "function" ? options.text(box, lineIndex) : (options.text ?? {}),
      yOffset,
    }),
  );
}

function RenderNodeCanvasNodes({
  node,
  yOffset,
  options,
}: {
  node: RenderNode;
  yOffset: number;
  options: CanvasRendererOptions;
}): CanvasNode[] {
  if (node.kind === "custom") {
    const extensionNodes = renderCustomNodeWithExtensions(node, yOffset, options);
    if (extensionNodes !== undefined) return extensionNodes;
  }

  if (node.kind === "box" || node.kind === "custom") {
    const children = node.children.flatMap((child) =>
      RenderNodeCanvasNodes({ node: child, yOffset, options }),
    );
    return [...decorateCanvasNode(node, yOffset, options), ...children];
  }

  return renderTextNodeToCanvasNodes(node, yOffset, options);
}

function renderCustomNodeWithExtensions(
  node: Extract<RenderNode, { kind: "custom" }>,
  yOffset: number,
  options: CanvasRendererOptions,
) {
  for (const extension of canvasRendererExtensions(options)) {
    const nodes = extension.toCanvasNodes?.({
      node,
      yOffset,
      options,
      renderNode(child: RenderNode) {
        return RenderNodeCanvasNodes({ node: child, yOffset, options });
      },
    });
    if (nodes !== undefined) return nodes;
  }

  return undefined;
}

function decorateCanvasNode(
  node: Extract<RenderNode, { kind: "box" | "custom" }>,
  yOffset: number,
  options: CanvasRendererOptions,
): CanvasNode[] {
  return [
    ...decorateBlockquoteCanvasNodes(node, yOffset),
    ...canvasRendererExtensions(options).flatMap(
      (extension) => extension.decorateCanvasNodes?.({ node, yOffset, options }) ?? [],
    ),
  ];
}

function canvasRendererExtensions(options: CanvasRendererOptions): CanvasRendererExtension[] {
  return options.extensions ?? [];
}

function decorateBlockquoteCanvasNodes(
  node: Extract<RenderNode, { kind: "box" | "custom" }>,
  yOffset: number,
): CanvasNode[] {
  const fill =
    typeof node.props?.blockquoteBorderColor === "string"
      ? node.props.blockquoteBorderColor
      : undefined;
  if (fill === undefined) return [];

  const width =
    typeof node.props?.blockquoteBorderWidth === "number"
      ? node.props.blockquoteBorderWidth
      : DEFAULT_BLOCKQUOTE_BORDER_WIDTH;

  return [
    BoxNode({
      key: `${node.key}:blockquote-border`,
      kind: "box",
      rect: {
        x: node.rect.x,
        y: node.rect.y + yOffset,
        width,
        height: node.rect.height,
      },
      fill,
      children: [],
    }),
  ];
}

function pageRect(pageSize: CanvasPageSize | undefined, fallback: Rect): Rect {
  return CanvasRect(
    CANVAS_ORIGIN,
    CANVAS_ORIGIN,
    pageSize?.width ?? fallback.width,
    pageSize?.height ?? fallback.height,
  );
}

function isRenderPage(page: LayoutPage | RenderPage): page is RenderPage {
  return "nodes" in page;
}

function offsetRect(rect: Rect, yOffset: number): Rect {
  return { ...rect, y: rect.y + yOffset };
}
