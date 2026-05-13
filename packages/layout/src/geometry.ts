import { LAYOUT_ORIGIN, MIN_CONTENT_SIZE } from "./constants.js";
import type {
  BoxEdges,
  PageGeometry,
  PageMarginGuide,
  Rect,
  ResolvedBoxEdges,
  UpdatePageMarginGuideOptions,
} from "./types.js";

export function createPageGeometry(page: {
  width: number;
  height: number;
  margin?: BoxEdges;
}): PageGeometry {
  const margin = resolveEdges(page.margin);
  const bounds = {
    x: LAYOUT_ORIGIN,
    y: LAYOUT_ORIGIN,
    width: page.width,
    height: page.height,
  };
  const content = contentRectForPage(bounds, margin);

  return {
    bounds,
    content,
    margin,
    guides: pageMarginGuides(bounds, margin),
  };
}

export function resolvePageMargin(margin: BoxEdges | undefined): ResolvedBoxEdges {
  return resolveEdges(margin);
}

export function updatePageMarginGuide(
  page: { width: number; height: number; margin?: BoxEdges },
  guide: PageMarginGuide,
  position: number,
  options: UpdatePageMarginGuideOptions = {},
): ResolvedBoxEdges {
  const margin = resolveEdges(page.margin);
  const minContentWidth = options.minContentWidth ?? MIN_CONTENT_SIZE;
  const minContentHeight = options.minContentHeight ?? MIN_CONTENT_SIZE;

  if (guide === "left") {
    return {
      ...margin,
      left: clamp(position, LAYOUT_ORIGIN, page.width - margin.right - minContentWidth),
    };
  }

  if (guide === "right") {
    return {
      ...margin,
      right: clamp(
        page.width - position,
        LAYOUT_ORIGIN,
        page.width - margin.left - minContentWidth,
      ),
    };
  }

  if (guide === "top") {
    return {
      ...margin,
      top: clamp(position, LAYOUT_ORIGIN, page.height - margin.bottom - minContentHeight),
    };
  }

  return {
    ...margin,
    bottom: clamp(
      page.height - position,
      LAYOUT_ORIGIN,
      page.height - margin.top - minContentHeight,
    ),
  };
}

export function pageGeometryFromContent(content: Rect): PageGeometry {
  return {
    bounds: {
      x: LAYOUT_ORIGIN,
      y: LAYOUT_ORIGIN,
      width: content.x + content.width,
      height: content.y + content.height,
    },
    content,
    margin: {
      top: content.y,
      right: LAYOUT_ORIGIN,
      bottom: LAYOUT_ORIGIN,
      left: content.x,
    },
    guides: {
      top: content.y,
      right: content.x + content.width,
      bottom: content.y + content.height,
      left: content.x,
    },
  };
}

export function isPageGeometry(value: Rect | PageGeometry): value is PageGeometry {
  return "margin" in value && "content" in value && "guides" in value;
}

export function resolveEdges(edges: BoxEdges | undefined) {
  if (typeof edges === "number") {
    return { top: edges, right: edges, bottom: edges, left: edges };
  }

  return {
    top: edges?.top ?? edges?.vertical ?? LAYOUT_ORIGIN,
    right: edges?.right ?? edges?.horizontal ?? LAYOUT_ORIGIN,
    bottom: edges?.bottom ?? edges?.vertical ?? LAYOUT_ORIGIN,
    left: edges?.left ?? edges?.horizontal ?? LAYOUT_ORIGIN,
  };
}

function contentRectForPage(bounds: Rect, margin: ResolvedBoxEdges): Rect {
  return {
    x: bounds.x + margin.left,
    y: bounds.y + margin.top,
    width: Math.max(LAYOUT_ORIGIN, bounds.width - margin.left - margin.right),
    height: Math.max(LAYOUT_ORIGIN, bounds.height - margin.top - margin.bottom),
  };
}

function pageMarginGuides(bounds: Rect, margin: ResolvedBoxEdges) {
  return {
    top: bounds.y + margin.top,
    right: bounds.x + bounds.width - margin.right,
    bottom: bounds.y + bounds.height - margin.bottom,
    left: bounds.x + margin.left,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
