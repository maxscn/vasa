import type {
  LayoutBox,
  LayoutPage,
  LayoutTextGrid,
  LayoutResult,
  Rect,
  TextLine,
  TextVisualLine,
} from "@skriva/layout";

export type RenderDocument = {
  pages: RenderPage[];
};

export type RenderPage = {
  index: number;
  rect: Rect;
  content: Rect;
  nodes: RenderNode[];
};

export type RenderNode = RenderBoxNode | RenderTextNode | RenderCustomNode;

export type RenderBoxNode = {
  key: string;
  kind: "box";
  sourceId?: string;
  rect: Rect;
  props?: Record<string, unknown>;
  children: RenderNode[];
};

export type RenderTextNode = {
  key: string;
  kind: "text";
  sourceId?: string;
  rect: Rect;
  text: string;
  lines: TextLine[];
  visualLines?: TextVisualLine[];
  textGrid?: LayoutTextGrid;
  children: [];
};

export type RenderCustomNode = {
  key: string;
  kind: "custom";
  sourceId?: string;
  name: string;
  rect: Rect;
  props?: Record<string, unknown>;
  children: RenderNode[];
};

export type Renderer<TResult, TOptions = undefined> = {
  render(document: RenderDocument, options?: TOptions): TResult;
};

export type RendererExtension = {
  name: string;
  toRenderNode?: (context: RenderNodeContext) => RenderNode | undefined;
};

export type RenderComponent = {
  name: string;
  match: (context: RenderNodeContext) => boolean;
  render: (context: RenderNodeContext) => RenderNode;
};

export type RenderRegistry = {
  register(component: RenderComponent): void;
  resolve(context: RenderNodeContext): RenderComponent;
  components(): RenderComponent[];
};

export type RenderNodeContext = {
  box: LayoutBox;
  page: LayoutPage;
  key: string;
  path: string;
  children: RenderNode[];
};

export type CreateRenderDocumentOptions = {
  registry?: RenderRegistry;
  extensions?: RendererExtension[];
};

export type CreateRenderDocumentInput = LayoutResult;
