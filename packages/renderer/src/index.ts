import type {
  LayoutBox,
  LayoutPage,
  LayoutTextGrid,
  LayoutResult,
  Rect,
  TextLine,
  TextVisualLine,
} from "@vasa/layout";
export {
  createTextLineOutline,
  parseTextOutlineFont,
  textOutlinePathBounds,
  type TextOutlineFont,
  type TextOutlineFontOptions,
  type TextOutlineOptions,
  type TextOutlinePath,
  type TextOutlinePathCommand,
} from "./text-outline.ts";
export {
  parseSvgPathData,
  parseSvgViewBox,
  transformSvgPath,
  type SvgPath,
  type SvgPathCommand,
  type SvgViewBox,
} from "./svg-path.ts";

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

export function createRenderer<TResult, TOptions = undefined>(
  renderer: Renderer<TResult, TOptions>,
): Renderer<TResult, TOptions> {
  return renderer;
}

export function createRenderRegistry(components: RenderComponent[] = []): RenderRegistry {
  const registered = [...components];

  return {
    register(component) {
      registered.push(component);
    },
    resolve(context) {
      return (
        registered.find((component) => component.match(context)) ??
        defaultRenderComponents.find((component) => component.match(context)) ??
        unsupportedRenderComponent
      );
    },
    components() {
      return [...registered, ...defaultRenderComponents];
    },
  };
}

export function createRenderDocument(
  layout: LayoutResult,
  options: CreateRenderDocumentOptions = {},
): RenderDocument {
  const registry = createDocumentRegistry(options);

  return {
    pages: layout.pages.map((page) => ({
      index: page.index,
      rect: pageRect(page),
      content: page.content,
      nodes: page.boxes.map((box, index) => renderLayoutBox(box, page, String(index), registry)),
    })),
  };
}

function renderLayoutBox(
  box: LayoutBox,
  page: LayoutPage,
  path: string,
  registry: RenderRegistry,
): RenderNode {
  const key = nodeKey(box, path);
  const children = box.children.map((child, index) =>
    renderLayoutBox(child, page, `${path}.${index}`, registry),
  );
  const context: RenderNodeContext = { box, page, key, path, children };
  return registry.resolve(context).render(context);
}

function createDocumentRegistry(options: CreateRenderDocumentOptions): RenderRegistry {
  const registry = options.registry ?? createRenderRegistry();

  for (const extension of options.extensions ?? []) {
    registry.register(extensionToRenderComponent(extension));
  }

  return registry;
}

function extensionToRenderComponent(extension: RendererExtension): RenderComponent {
  return {
    name: extension.name,
    match: (context) => extension.toRenderNode?.(context) !== undefined,
    render: (context) =>
      extension.toRenderNode?.(context) ?? unsupportedRenderComponent.render(context),
  };
}

const defaultRenderComponents: RenderComponent[] = [
  {
    name: "text",
    match: ({ box }) => box.type === "text",
    render: ({ box, key }) => ({
      key,
      kind: "text",
      sourceId: box.id,
      rect: box.rect,
      text: box.text ?? "",
      lines: box.lines ?? [],
      visualLines: box.visualLines,
      ...(box.textGrid === undefined ? {} : { textGrid: box.textGrid }),
      children: [],
    }),
  },
  {
    name: "box",
    match: ({ box }) => box.type === "box",
    render: ({ box, key, children }) => ({
      key,
      kind: "box",
      sourceId: box.id,
      rect: box.rect,
      props: box.props,
      children,
    }),
  },
];

const unsupportedRenderComponent: RenderComponent = {
  name: "unsupported",
  match: () => true,
  render: ({ box, key, children }) => ({
    key,
    kind: "custom",
    sourceId: box.id,
    name: box.type,
    rect: box.rect,
    props: box.props,
    children,
  }),
};

export function renderBoxComponent({ box, key, children }: RenderNodeContext): RenderBoxNode {
  return {
    key,
    kind: "box",
    sourceId: box.id,
    rect: box.rect,
    props: box.props,
    children,
  };
}

export function renderTextComponent({ box, key }: RenderNodeContext): RenderTextNode {
  return {
    key,
    kind: "text",
    sourceId: box.id,
    rect: box.rect,
    text: box.text ?? "",
    lines: box.lines ?? [],
    visualLines: box.visualLines,
    ...(box.textGrid === undefined ? {} : { textGrid: box.textGrid }),
    children: [],
  };
}

function nodeKey(box: LayoutBox, path: string) {
  return `${box.type}:${box.id ?? path}`;
}

function pageRect(page: LayoutPage): Rect {
  return page.bounds;
}
