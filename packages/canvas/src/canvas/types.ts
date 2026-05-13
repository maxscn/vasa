import type { LayoutBox, LayoutPage, LayoutResult, Rect } from "@skriva/layout";
import type {
  RenderCustomNode,
  RenderDocument,
  RenderNode,
  SvgPath,
  TextOutlineFont,
  TextOutlinePath,
} from "@skriva/renderer";
import type { CanvasCommand } from "../commands/index.js";

export type CanvasScene = {
  pages: CanvasPageNode[];
};

export type CanvasPageNode = {
  key: string;
  index: number;
  rect: Rect;
  children: CanvasNode[];
};

export type CanvasNode = CanvasSerializableNode;

export type CanvasSerializableNode =
  | CanvasSerializableBoxNode
  | CanvasSerializableTextLineNode
  | CanvasSerializablePathNode;

type CanvasNodeSerializer = {
  serialize(): SceneNodeSnapshot;
};

export type CanvasBoxNode = {
  key: string;
  kind: "box";
  rect: Rect;
  fill?: string;
  stroke?: string;
  children: CanvasNode[];
};

export type CanvasTextLineNode = {
  key: string;
  kind: "textLine";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font: string;
  fill: string;
  backgroundColor?: string;
  textDecorationLine?: "underline" | "line-through";
  textDecorationColor?: string;
  textDecorationOffset?: number;
  textDecorationThickness?: number;
  outline?: TextOutlinePath;
  pixelSnap?: number;
};

export type CanvasPathNode = {
  key: string;
  kind: "path";
  path: SvgPath;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type CanvasSerializableBoxNode = CanvasBoxNode & CanvasNodeSerializer;
export type CanvasSerializableTextLineNode = CanvasTextLineNode & CanvasNodeSerializer;
export type CanvasSerializablePathNode = CanvasPathNode & CanvasNodeSerializer;

export type CanvasRendererOptions = {
  pageGap?: number;
  pageSize?: CanvasPageSize | ((page: LayoutPage) => CanvasPageSize);
  pageBackground?: string;
  text?: CanvasTextPaint | ((box: LayoutBox, lineIndex: number) => CanvasTextPaint);
  box?: CanvasBoxPaint | ((box: LayoutBox) => CanvasBoxPaint | undefined);
  extensions?: CanvasRendererExtension[];
};

export type CanvasRendererExtension = {
  name: string;
  toCanvasNodes?: (context: CanvasRenderNodeContext) => CanvasNode[] | undefined;
  decorateCanvasNodes?: (context: CanvasDecorateNodeContext) => CanvasNode[] | undefined;
};

export type CanvasRenderNodeContext = {
  node: RenderCustomNode;
  yOffset: number;
  options: CanvasRendererOptions;
  renderNode: (node: RenderNode) => CanvasNode[];
};

export type CanvasDecorateNodeContext = {
  node: Extract<RenderNode, { kind: "box" | "custom" }>;
  yOffset: number;
  options: CanvasRendererOptions;
};

export type CanvasPageSize = {
  width: number;
  height: number;
};

export type CanvasTextPaint = {
  font?: string;
  fill?: string;
  outlineFont?: TextOutlineFont;
  fontSize?: number;
  letterSpacing?: number;
  embolden?: number;
  pixelSnap?: number;
  skewX?: number;
};

export type CanvasBoxPaint = {
  fill?: string;
  stroke?: string;
};

export type ReconcileOperation =
  | { type: "mount"; key: string; next: SceneNodeSnapshot }
  | { type: "update"; key: string; previous: SceneNodeSnapshot; next: SceneNodeSnapshot }
  | { type: "unmount"; key: string; previous: SceneNodeSnapshot }
  | { type: "retain"; key: string };

export type SceneNodeSnapshot = {
  kind: "page" | CanvasNode["kind"];
  props: Record<string, unknown>;
};

export type CanvasRenderResult = {
  scene: CanvasScene;
  operations: ReconcileOperation[];
  commands: CanvasCommand[];
  didPaint: boolean;
};

export type CanvasRenderer = {
  render(document: LayoutResult | RenderDocument): CanvasRenderResult;
  reset(): void;
};
