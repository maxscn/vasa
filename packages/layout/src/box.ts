import Yoga, {
  Align,
  Direction,
  Edge,
  FlexDirection,
  Gutter,
  MeasureMode as YogaMeasureMode,
  type Node as YogaNode,
} from "yoga-layout";
import { EMPTY_BOX_SIZE, UNBOUNDED_MEASURE_WIDTH } from "./constants.js";
import {
  createPageGeometry,
  isPageGeometry,
  pageGeometryFromContent,
  resolveEdges,
} from "./geometry.js";
import { paginatePrimitives } from "./pagination.ts";
import { createPretextTextMeasurer, defaultLayoutExtensions } from "./text.ts";
import type {
  BoxEdges,
  BoxNode,
  DefiniteLength,
  AnyLayoutExtension,
  LayoutExtension,
  LayoutBox,
  LayoutNode,
  LayoutOptions,
  LayoutPage,
  LayoutResult,
  LayoutStyle,
  Length,
  MeasureMode,
  MeasurableStyle,
  PageGeometry,
  Rect,
  TextMeasurer,
} from "./types.ts";

type BuiltNode = {
  source: LayoutNode;
  yoga: YogaNode;
  children: BuiltNode[];
};

type LayoutRegistry = {
  measure(
    node: LayoutNode,
    input: {
      width: number;
      widthMode: MeasureMode;
      maxWidth: number;
      measurer: TextMeasurer;
    },
  ): { width: number; height: number };
  materialize(
    node: LayoutNode,
    input: {
      rect: Rect;
      measurer: TextMeasurer;
      textGrid?: boolean;
    },
  ): LayoutBox | undefined;
};

export function layoutDocument(root: BoxNode, options: LayoutOptions): LayoutResult {
  const measurer = options.measurer ?? createPretextTextMeasurer();
  const geometry = createPageGeometry(options.page);
  const { content } = geometry;

  const pages: LayoutPage[] = [];

  const pagination = paginatePrimitives({
    root,
    content,
    extensions: options.extensions,
    layoutPage: (pageRoot, pageIndex) =>
      layoutPage(pageRoot, geometry, measurer, pageIndex, options.extensions, {
        textGrid: options.textGrid,
      }),
  });

  for (const page of pagination.pages) {
    pages.push(
      layoutPage(
        { ...root, children: page.primitives },
        geometry,
        measurer,
        page.index,
        options.extensions,
        { textGrid: options.textGrid },
      ),
    );
  }

  return { pages };
}

export function layoutPage(
  root: BoxNode,
  geometry: Rect | PageGeometry,
  measurer: TextMeasurer = createPretextTextMeasurer(),
  pageIndex = 0,
  extensions: AnyLayoutExtension[] = [],
  options: { textGrid?: boolean } = {},
): LayoutPage {
  const pageGeometry = isPageGeometry(geometry) ? geometry : pageGeometryFromContent(geometry);
  const { content } = pageGeometry;
  const registry = createLayoutRegistry(extensions);
  const built = buildYogaTree(root, measurer, registry);
  built.yoga.setWidth(content.width);
  built.yoga.setHeight(content.height);
  built.yoga.calculateLayout(content.width, content.height, Direction.LTR);

  try {
    return {
      index: pageIndex,
      bounds: pageGeometry.bounds,
      content,
      margin: pageGeometry.margin,
      boxes: built.children.map((child) =>
        materializeBox(child, content.x, content.y, measurer, registry, options),
      ),
    };
  } finally {
    built.yoga.freeRecursive();
  }
}

function buildYogaTree(
  source: LayoutNode,
  measurer: TextMeasurer,
  registry: LayoutRegistry,
): BuiltNode {
  const yoga = Yoga.Node.create();
  const children: BuiltNode[] = [];

  if (isLayoutContainerNode(source)) {
    applyLayoutStyle(yoga, source.style);

    for (const child of source.children) {
      const builtChild = buildYogaTree(child, measurer, registry);
      yoga.insertChild(builtChild.yoga, children.length);
      children.push(builtChild);
    }
  } else {
    applyMeasurableStyle(yoga, source.style);
    yoga.setMeasureFunc((width, widthMode) => {
      const maxWidth =
        widthMode === YogaMeasureMode.Undefined
          ? UNBOUNDED_MEASURE_WIDTH
          : Math.max(EMPTY_BOX_SIZE, width);
      const measurement = registry.measure(source, {
        width,
        widthMode: toLayoutMeasureMode(widthMode),
        maxWidth,
        measurer,
      });

      return {
        width: shouldUseExactMeasuredWidth(source, widthMode)
          ? width
          : Math.min(measurement.width, maxWidth),
        height: measurement.height,
      };
    });
  }

  return { source, yoga, children };
}

function shouldUseExactMeasuredWidth(source: LayoutNode, widthMode: YogaMeasureMode) {
  return widthMode === YogaMeasureMode.Exactly && source.style?.width !== undefined;
}

function isLayoutContainerNode(node: LayoutNode): node is LayoutNode & { children: LayoutNode[] } {
  return Array.isArray((node as { children?: unknown }).children);
}

function createLayoutRegistry(extensions: AnyLayoutExtension[] = []): LayoutRegistry {
  const registered = [...extensions, ...defaultLayoutExtensions];

  return {
    measure(node, input) {
      for (const extension of registered) {
        const measurement = measureWithExtension(extension, node, input);
        if (measurement !== undefined) return measurement;
      }

      return { width: EMPTY_BOX_SIZE, height: EMPTY_BOX_SIZE };
    },
    materialize(node, input) {
      for (const extension of registered) {
        const box = materializeWithExtension(extension, node, input);
        if (box !== undefined) return box;
      }

      return undefined;
    },
  };
}

function measureWithExtension<TNode extends LayoutNode>(
  extension: LayoutExtension<TNode>,
  node: LayoutNode,
  input: {
    width: number;
    widthMode: MeasureMode;
    maxWidth: number;
    measurer: TextMeasurer;
  },
) {
  if (!extension.match(node)) return undefined;
  return extension.measure?.({ node, ...input });
}

function materializeWithExtension<TNode extends LayoutNode>(
  extension: LayoutExtension<TNode>,
  node: LayoutNode,
  input: {
    rect: Rect;
    measurer: TextMeasurer;
    textGrid?: boolean;
  },
) {
  if (!extension.match(node)) return undefined;
  return extension.materialize?.({ node, ...input });
}

function toLayoutMeasureMode(mode: YogaMeasureMode): MeasureMode {
  if (mode === YogaMeasureMode.Exactly) return "exactly";
  if (mode === YogaMeasureMode.AtMost) return "at-most";
  return "undefined";
}

function materializeBox(
  built: BuiltNode,
  offsetX: number,
  offsetY: number,
  measurer: TextMeasurer,
  registry: LayoutRegistry,
  options: { textGrid?: boolean } = {},
): LayoutBox {
  const computed = built.yoga.getComputedLayout();
  const rect = {
    x: offsetX + computed.left,
    y: offsetY + computed.top,
    width: computed.width,
    height: computed.height,
  };

  const extensionBox = registry.materialize(built.source, { rect, measurer, ...options });
  if (extensionBox !== undefined) return extensionBox;

  return {
    id: built.source.id,
    type: built.source.type,
    rect,
    props: layoutBoxProps(built.source),
    children: built.children.map((child) =>
      materializeBox(child, rect.x, rect.y, measurer, registry, options),
    ),
  };
}

function layoutBoxProps(node: LayoutNode): Record<string, unknown> | undefined {
  const props = Object.fromEntries(
    Object.entries(node).filter(([key]) => key !== "type" && key !== "id" && key !== "style"),
  );

  return Object.keys(props).length === 0 ? undefined : props;
}

function applyLayoutStyle(yoga: YogaNode, style: LayoutStyle = {}) {
  setLength(style.width, (value) => yoga.setWidth(value));
  setLength(style.height, (value) => yoga.setHeight(value));
  setLength(style.minWidth, (value) => yoga.setMinWidth(value));
  setLength(style.minHeight, (value) => yoga.setMinHeight(value));
  setLength(style.maxWidth, (value) => yoga.setMaxWidth(value));
  setLength(style.maxHeight, (value) => yoga.setMaxHeight(value));

  yoga.setFlexDirection(style.flexDirection === "row" ? FlexDirection.Row : FlexDirection.Column);
  yoga.setAlignItems(Align.FlexStart);

  if (style.flexGrow !== undefined) yoga.setFlexGrow(style.flexGrow);
  if (style.flexShrink !== undefined) yoga.setFlexShrink(style.flexShrink);
  if (style.gap !== undefined) yoga.setGap(Gutter.All, style.gap);

  applyEdges(style.padding, (edge, value) => yoga.setPadding(edge, value));
  applyEdges(style.margin, (edge, value) => yoga.setMargin(edge, value));
}

function applyMeasurableStyle(yoga: YogaNode, style: MeasurableStyle = {}) {
  setLength(style.width, (value) => yoga.setWidth(value));
  setLength(style.height, (value) => yoga.setHeight(value));
  applyEdges(style.margin, (edge, value) => yoga.setMargin(edge, value));
}

function setLength<T extends Length | DefiniteLength>(
  value: T | undefined,
  setter: (value: T | undefined) => void,
) {
  if (value !== undefined) setter(value);
}

function applyEdges(edges: BoxEdges | undefined, apply: (edge: Edge, value: number) => void) {
  const resolved = resolveEdges(edges);
  apply(Edge.Top, resolved.top);
  apply(Edge.Right, resolved.right);
  apply(Edge.Bottom, resolved.bottom);
  apply(Edge.Left, resolved.left);
}
