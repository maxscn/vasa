import {
  layoutDocument,
  type BoxNode,
  type LayoutNode,
  type LayoutOptions,
  type LayoutResult,
  type Rect,
  type TextStyle,
} from "@vasa/layout";
import {
  createTextLineOutline,
  createRenderDocument,
  textOutlinePathBounds,
  type RenderDocument,
  type RenderNode,
  type RenderCustomNode,
  type RenderTextNode,
  type SvgPath,
  type TextOutlineFont,
  type TextOutlinePath,
} from "@vasa/renderer";
import { createElement, type ReactElement, type ReactNode } from "react";
import Reconciler from "react-reconciler";
import { DefaultEventPriority, NoEventPriority } from "react-reconciler/constants";

export type PdfPrimitiveType = string;

export type PdfPrimitiveProps = {
  id?: string;
  style?: BoxNode["style"] | TextStyle;
  children?: ReactNode;
  [key: string]: unknown;
};

export type PdfTextProps = PdfPrimitiveProps & {
  text?: string;
};

type PdfElementHostNode = {
  type: string;
  props: PdfPrimitiveProps;
  children: PdfHostNode[];
};

type PdfTextInstanceHostNode = {
  type: "textInstance";
  text: string;
  children: [];
};

export type PdfHostNode = PdfElementHostNode | PdfTextInstanceHostNode;

export type PdfRootContainer = {
  children: PdfHostNode[];
};

export type PdfRenderOptions = LayoutOptions & {
  metadata?: PdfMetadata;
  outlineText?: PdfOutlineTextOptions | PdfOutlineTextResolver;
  textMode?: "native" | "outline" | "embedded";
  defaultTextFill?: string;
  selectableText?: boolean;
  renderers?: PdfRendererExtension[];
};

export type PdfMetadata = {
  title?: string;
  author?: string;
};

export type PdfOutlineTextOptions = {
  font: TextOutlineFont;
  fontSize?: number;
  fill?: string;
  letterSpacing?: number;
  embolden?: number;
  skewX?: number;
};

export type PdfOutlineTextResolver = (
  node: RenderTextNode,
  lineIndex: number,
) => PdfOutlineTextOptions | undefined;

export type PdfCommand =
  | { type: "beginPage"; index: number; rect: Rect }
  | {
      type: "text";
      text: string;
      x: number;
      y: number;
      fontSize: number;
      fontWeight?: string;
      fontStyle?: string;
      fill?: string;
      invisible?: boolean;
      embeddedFont?: PdfEmbeddedFont;
    }
  | { type: "textPath"; path: TextOutlinePath; fill: string }
  | { type: "rect"; rect: Rect; fill: string }
  | { type: "path"; path: SvgPath; fill?: string; stroke?: string; strokeWidth?: number };

export type PdfRendererExtension = {
  name: string;
  toPdfCommands?: (context: PdfRenderNodeContext) => PdfCommand[] | undefined;
};

export type PdfRenderNodeContext = {
  node: RenderCustomNode;
  renderNode: (node: RenderNode) => PdfCommand[];
};

export type PdfRenderResult = {
  layout: LayoutResult;
  commands: PdfCommand[];
  bytes: Uint8Array;
  compressedBytes: () => Promise<Uint8Array>;
};

export type PdfEmbeddedFont = {
  font: TextOutlineFont;
  fill?: string;
};

type EmbeddedFontResource = {
  key: string;
  name: string;
  font: TextOutlineFont;
  glyphs: Map<number, { sourceGlyphId: number; unicode: string; width: number }>;
  sourceToSubsetGlyphs: Map<number, number>;
  subsetBytes: Uint8Array;
  type0Object: number;
  cidFontObject: number;
  descriptorObject: number;
  fileObject: number;
  toUnicodeObject: number;
};

type ReconcilerInstance = {
  createContainer: (...args: unknown[]) => unknown;
  updateContainerSync?: (...args: unknown[]) => void;
  updateContainer: (...args: unknown[]) => void;
  flushSyncWork?: () => void;
};

export type PdfPrimitiveComponent<TProps extends PdfPrimitiveProps = PdfPrimitiveProps> = (
  props: TProps,
) => ReactElement;

export function createPdfPrimitive<TProps extends PdfPrimitiveProps = PdfPrimitiveProps>(
  type: PdfPrimitiveType,
): PdfPrimitiveComponent<TProps> {
  return function PdfPrimitive(props: TProps) {
    return createElement(type, props);
  };
}

export const Document = createPdfPrimitive("document");
export const View = createPdfPrimitive("view");
export const Box = createPdfPrimitive("box");
export const Text = createPdfPrimitive<PdfTextProps>("text");

export function renderDocumentToPdf(document: BoxNode, options: PdfRenderOptions): PdfRenderResult {
  const layout = layoutDocument(document, options);
  const commands = createPdfCommands(createRenderDocument(layout), options.page, options);
  const bytes = writePdf(commands, options.page, options.metadata);
  const compressedBytes = () => writePdfAsync(commands, options.page, options.metadata);

  return { layout, commands, bytes, compressedBytes };
}

export function renderReactToPdf(element: unknown, options: PdfRenderOptions): PdfRenderResult {
  return renderDocumentToPdf(renderReactToLayoutTree(element), options);
}

export function renderReactToLayoutTree(element: unknown): BoxNode {
  const container = createPdfRootContainer();
  const root = pdfReconciler.createContainer(
    container,
    0,
    null,
    false,
    null,
    "",
    defaultErrorHandler,
    defaultErrorHandler,
    defaultErrorHandler,
    null,
  );

  if (typeof pdfReconciler.updateContainerSync === "function") {
    pdfReconciler.updateContainerSync(element, root, null, null);
  } else {
    pdfReconciler.updateContainer(element, root, null, null);
  }

  pdfReconciler.flushSyncWork?.();

  const document = container.children.find((child) => child.type === "document");
  return hostNodeToLayoutTree(
    document ?? { type: "document", props: {}, children: container.children },
  );
}

export function createPdfCommands(
  document: LayoutResult | RenderDocument,
  page: LayoutOptions["page"],
  options: Pick<
    PdfRenderOptions,
    "defaultTextFill" | "outlineText" | "renderers" | "selectableText" | "textMode"
  > = {},
): PdfCommand[] {
  const renderDocument = isRenderDocument(document) ? document : createRenderDocument(document);
  const commands: PdfCommand[] = [];

  for (const renderPage of renderDocument.pages) {
    commands.push({
      type: "beginPage",
      index: renderPage.index,
      rect: { x: 0, y: 0, width: page.width, height: page.height },
    });

    for (const node of renderPage.nodes) {
      appendPdfCommands(commands, node, options);
    }
  }

  return commands;
}

export function writePdf(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  metadata: PdfMetadata = {},
): Uint8Array {
  return writePdfWithStreamEncoder(commands, page, metadata, createStreamObject);
}

export async function writePdfAsync(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  metadata: PdfMetadata = {},
): Promise<Uint8Array> {
  return writePdfWithStreamEncoder(commands, page, metadata, createCompressedStreamObject);
}

function writePdfWithStreamEncoder(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  metadata: PdfMetadata,
  streamObject: (stream: string) => PdfObject | Promise<PdfObject>,
): Uint8Array;
function writePdfWithStreamEncoder(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  metadata: PdfMetadata,
  streamObject: (stream: string) => Promise<PdfObject>,
): Promise<Uint8Array>;
function writePdfWithStreamEncoder(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  metadata: PdfMetadata,
  streamObject: (stream: string) => PdfObject | Promise<PdfObject>,
): Uint8Array | Promise<Uint8Array> {
  const pageCommands = groupCommandsByPage(commands);
  const embeddedFonts = collectEmbeddedFonts(commands);
  const objects: PdfObject[] = [];
  const catalogObject = 1;
  const pagesObject = 2;
  const fontObject = 3;
  const boldFontObject = 4;
  const italicFontObject = 5;
  const boldItalicFontObject = 6;
  let nextObjectId = 7;
  for (const font of embeddedFonts) {
    font.type0Object = nextObjectId++;
    font.cidFontObject = nextObjectId++;
    font.descriptorObject = nextObjectId++;
    font.fileObject = nextObjectId++;
    font.toUnicodeObject = nextObjectId++;
  }
  const infoObject = nextObjectId++;
  const firstPageObject = nextObjectId;
  const pageObjectIds = pageCommands.map((_, index) => firstPageObject + index * 2);
  const contentObjectIds = pageCommands.map((_, index) => firstPageObject + index * 2 + 1);

  objects[catalogObject] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[pagesObject] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCommands.length} >>`;
  objects[fontObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[boldFontObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[italicFontObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>";
  objects[boldItalicFontObject] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>";
  appendEmbeddedFontObjects(objects, embeddedFonts);
  objects[infoObject] = createInfoDictionary(metadata);

  const pendingStreams: Array<Promise<void>> = [];

  for (const [index, pageContent] of pageCommands.entries()) {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(page.width)} ${formatNumber(page.height)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R ${embeddedFonts
        .map((font) => `/${font.name} ${font.type0Object} 0 R`)
        .join(" ")} >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
    const contentStream = streamObject(serializePageCommands(pageContent, page, embeddedFonts));
    if (isPdfObject(contentStream)) {
      objects[contentObjectId] = contentStream;
    } else {
      pendingStreams.push(
        contentStream.then((resolved) => {
          objects[contentObjectId] = resolved;
        }),
      );
    }
  }

  if (pendingStreams.length > 0) {
    return Promise.all(pendingStreams).then(() =>
      encodePdfObjects(objects, catalogObject, infoObject),
    );
  }

  return encodePdfObjects(objects, catalogObject, infoObject);
}

export function createPdfRootContainer(): PdfRootContainer {
  return { children: [] };
}

function appendPdfCommands(
  commands: PdfCommand[],
  node: RenderNode,
  options: Pick<
    PdfRenderOptions,
    "defaultTextFill" | "outlineText" | "renderers" | "selectableText" | "textMode"
  >,
) {
  if (isRenderTextNode(node)) {
    for (const [lineIndex, line] of node.lines.entries()) {
      const resolvedOutlineText = resolveOutlineText(options.outlineText, node, lineIndex);
      const outlinePath =
        resolvedOutlineText === undefined
          ? undefined
          : createTextLineOutline(line, {
              font: resolvedOutlineText.font,
              fontSize: resolvedOutlineText.fontSize ?? line.fontSize ?? line.height,
              letterSpacing: resolvedOutlineText.letterSpacing,
              embolden: resolvedOutlineText.embolden,
              skewX: resolvedOutlineText.skewX,
            });
      appendPdfTextBackgroundCommands(commands, line, outlinePath);
      if (resolvedOutlineText !== undefined) {
        const fill = resolvedOutlineText.fill ?? "#111111";
        if (options.textMode === "embedded") {
          commands.push({
            type: "text",
            text: line.text,
            x: line.x,
            y: line.y,
            fontSize: Math.max(1, Math.min(line.fontSize ?? line.height, 72)),
            fill,
            embeddedFont: { font: resolvedOutlineText.font, fill },
            ...(isBoldFontWeight(line.fontWeight) ? { fontWeight: line.fontWeight } : {}),
            ...(line.fontStyle === undefined ? {} : { fontStyle: line.fontStyle }),
          });
          appendPdfTextDecorationCommands(commands, line, fill, outlinePath);
          continue;
        }

        if (options.selectableText === true) {
          commands.push({
            type: "text",
            text: line.text,
            x: line.x,
            y: line.y,
            fontSize: Math.max(1, Math.min(line.fontSize ?? line.height, 72)),
            invisible: true,
            ...(isBoldFontWeight(line.fontWeight) ? { fontWeight: line.fontWeight } : {}),
            ...(line.fontStyle === undefined ? {} : { fontStyle: line.fontStyle }),
          });
        }
        commands.push({
          type: "textPath",
          path: outlinePath!,
          fill,
        });
        appendPdfTextDecorationCommands(commands, line, fill, outlinePath);
        continue;
      }

      const fill = line.color ?? options.defaultTextFill ?? "#111111";
      const commandFill = line.color ?? options.defaultTextFill;
      commands.push({
        type: "text",
        text: line.text,
        x: line.x,
        y: line.y,
        fontSize: Math.max(1, Math.min(line.fontSize ?? line.height, 72)),
        ...(isBoldFontWeight(line.fontWeight) ? { fontWeight: line.fontWeight } : {}),
        ...(line.fontStyle === undefined ? {} : { fontStyle: line.fontStyle }),
        ...(commandFill === undefined ? {} : { fill: commandFill }),
      });
      appendPdfTextDecorationCommands(commands, line, fill, outlinePath);
    }
    return;
  }

  if (node.kind === "custom") {
    const extensionCommands = renderCustomNodeWithExtensions(node, options.renderers, options);
    if (extensionCommands !== undefined) {
      commands.push(...extensionCommands);
      return;
    }
  }

  const blockquoteBorder = blockquoteBorderCommand(node);
  if (blockquoteBorder !== undefined) {
    commands.push(blockquoteBorder);
  }

  for (const child of node.children) {
    appendPdfCommands(commands, child, options);
  }
}

function blockquoteBorderCommand(node: RenderNode): PdfCommand | undefined {
  if (node.kind !== "box" && node.kind !== "custom") return undefined;
  const fill =
    typeof node.props?.blockquoteBorderColor === "string"
      ? node.props.blockquoteBorderColor
      : undefined;
  if (fill === undefined) return undefined;

  const width =
    typeof node.props?.blockquoteBorderWidth === "number" ? node.props.blockquoteBorderWidth : 3;

  return {
    type: "rect",
    fill,
    rect: {
      x: node.rect.x,
      y: node.rect.y,
      width,
      height: node.rect.height,
    },
  };
}

function appendPdfTextBackgroundCommands(
  commands: PdfCommand[],
  line: RenderTextNode["lines"][number],
  outline: TextOutlinePath | undefined,
) {
  if (line.backgroundColor !== undefined) {
    commands.push({
      type: "rect",
      rect: snappedTextRect(line, outline),
      fill: line.backgroundColor,
    });
  }
}

function appendPdfTextDecorationCommands(
  commands: PdfCommand[],
  line: RenderTextNode["lines"][number],
  fill: string,
  outline: TextOutlinePath | undefined,
) {
  if (line.textDecorationLine !== undefined) {
    const fontSize = line.fontSize ?? line.height;
    commands.push({
      type: "rect",
      rect: textDecorationRect(line, fontSize, outline),
      fill: line.textDecorationColor ?? line.color ?? fill,
    });
  }
}

function textDecorationRect(
  line: RenderTextNode["lines"][number],
  fontSize: number,
  outline: TextOutlinePath | undefined,
): Rect {
  const horizontal = snappedTextHorizontalRect(line, outline);
  const thickness = line.textDecorationThickness ?? Math.max(1, Math.round(fontSize * 0.06));
  const bounds = outline === undefined ? undefined : textOutlinePathBounds(outline);
  const fallbackOffset =
    line.textDecorationLine === "line-through"
      ? fontSize * 0.6
      : Math.min(line.height - thickness, fontSize);
  const hasMetricOffset = line.textDecorationOffset !== undefined;
  const offset = line.textDecorationOffset ?? fallbackOffset;
  const y =
    bounds === undefined || line.textDecorationLine === "line-through" || hasMetricOffset
      ? Math.round(line.y + offset)
      : Math.max(Math.round(line.y + offset), Math.floor(bounds.y + bounds.height));

  return {
    x: horizontal.x,
    y,
    width: horizontal.width,
    height: thickness,
  };
}

function snappedTextRect(
  line: RenderTextNode["lines"][number],
  outline: TextOutlinePath | undefined,
): Rect {
  const horizontal = snappedTextHorizontalRect(line, outline);
  return {
    x: horizontal.x,
    y: Math.round(line.y),
    width: horizontal.width,
    height: Math.round(line.height),
  };
}

function snappedTextHorizontalRect(
  line: RenderTextNode["lines"][number],
  outline: TextOutlinePath | undefined,
) {
  const bounds = outline === undefined ? undefined : textOutlinePathBounds(outline);
  if (bounds === undefined) return { x: Math.round(line.x), width: Math.round(line.width) };

  const x = Math.floor(bounds.x);
  return { x, width: Math.max(1, Math.ceil(bounds.x + bounds.width) - x) };
}

function renderCustomNodeWithExtensions(
  node: RenderCustomNode,
  renderers: PdfRendererExtension[] | undefined,
  options: Pick<
    PdfRenderOptions,
    "defaultTextFill" | "outlineText" | "renderers" | "selectableText" | "textMode"
  >,
) {
  for (const renderer of renderers ?? []) {
    const commands = renderer.toPdfCommands?.({
      node,
      renderNode(child) {
        const commands: PdfCommand[] = [];
        appendPdfCommands(commands, child, options);
        return commands;
      },
    });
    if (commands !== undefined) return commands;
  }

  return undefined;
}

function resolveOutlineText(
  outlineText: PdfRenderOptions["outlineText"] | undefined,
  node: RenderTextNode,
  lineIndex: number,
) {
  if (typeof outlineText === "function") return outlineText(node, lineIndex);
  return outlineText;
}

function isRenderDocument(document: LayoutResult | RenderDocument): document is RenderDocument {
  return document.pages.every((page) => "nodes" in page);
}

function isRenderTextNode(node: RenderNode): node is RenderTextNode {
  return node.kind === "text";
}

function hostNodeToLayoutTree(node: PdfHostNode): BoxNode {
  if (isTextInstanceHostNode(node)) {
    return { type: "box", children: [] };
  }

  if (node.type === "text") {
    return {
      type: "box",
      children: [hostTextNodeToLayoutText(node)],
    };
  }

  return {
    type: "box",
    id: node.props.id,
    style: node.props.style as BoxNode["style"],
    children: node.children.flatMap((child) => hostNodeToLayoutNodes(child)),
  };
}

function hostNodeToLayoutNodes(node: PdfHostNode): LayoutNode[] {
  if (isTextInstanceHostNode(node)) return [];
  if (node.type === "text") return [hostTextNodeToLayoutText(node)];
  if (node.type !== "document" && node.type !== "view" && node.type !== "box") {
    return [hostNodeToCustomLayoutNode(node)];
  }
  return [hostNodeToLayoutTree(node)];
}

function hostTextNodeToLayoutText(node: PdfElementHostNode) {
  return {
    type: "text" as const,
    id: node.props.id,
    text: typeof node.props.text === "string" ? node.props.text : collectText(node),
    style: node.props.style as TextStyle,
  };
}

function collectText(node: PdfHostNode): string {
  if (isTextInstanceHostNode(node)) return node.text;
  return node.children.map((child) => collectText(child)).join("");
}

function hostNodeToCustomLayoutNode(node: PdfElementHostNode): LayoutNode {
  return {
    ...primitiveProps(node.props),
    type: node.type,
    id: node.props.id,
    style: node.props.style as LayoutNode["style"],
    children: node.children.flatMap((child) => hostNodeToLayoutNodes(child)),
  } as LayoutNode;
}

function primitiveProps(props: PdfPrimitiveProps): Record<string, unknown> {
  const { children, id, style, ...rest } = props;
  void children;
  void id;
  void style;
  return rest;
}

function childList(parent: PdfElementHostNode | PdfRootContainer): PdfHostNode[] {
  return parent.children;
}

function appendChild(parent: PdfElementHostNode | PdfRootContainer, child: PdfHostNode) {
  childList(parent).push(child);
}

function insertBefore(
  parent: PdfElementHostNode | PdfRootContainer,
  child: PdfHostNode,
  beforeChild: PdfHostNode,
) {
  const children = childList(parent);
  const existingIndex = children.indexOf(child);
  if (existingIndex >= 0) children.splice(existingIndex, 1);

  const index = children.indexOf(beforeChild);
  children.splice(index < 0 ? children.length : index, 0, child);
}

function removeChild(parent: PdfElementHostNode | PdfRootContainer, child: PdfHostNode) {
  const children = childList(parent);
  const index = children.indexOf(child);
  if (index >= 0) children.splice(index, 1);
}

function createHostNode(type: string, props: PdfPrimitiveProps): PdfHostNode {
  return { type, props, children: [] };
}

function commitUpdate(
  instance: PdfHostNode,
  _type: string,
  _oldProps: PdfPrimitiveProps,
  newProps: PdfPrimitiveProps,
) {
  if (!isTextInstanceHostNode(instance)) {
    instance.props = newProps;
  }
}

function isTextInstanceHostNode(node: PdfHostNode): node is PdfTextInstanceHostNode {
  return "text" in node;
}

const pdfReconciler = Reconciler({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,
  noTimeout: -1,
  getRootHostContext: () => null,
  getChildHostContext: () => null,
  getPublicInstance: (instance: PdfHostNode) => instance,
  prepareForCommit: () => null,
  resetAfterCommit: () => undefined,
  createInstance: createHostNode,
  appendInitialChild: appendChild,
  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  createTextInstance: (text: string) => ({ type: "textInstance", text, children: [] }),
  appendChild,
  appendChildToContainer: appendChild,
  insertBefore,
  insertInContainerBefore: insertBefore,
  removeChild,
  removeChildFromContainer: removeChild,
  clearContainer: (container: PdfRootContainer) => {
    container.children = [];
    return false;
  },
  prepareUpdate: () => true,
  commitUpdate,
  commitTextUpdate: (textInstance: PdfTextInstanceHostNode, _oldText: string, newText: string) => {
    textInstance.text = newText;
  },
  resetTextContent: () => undefined,
  hideInstance: () => undefined,
  hideTextInstance: () => undefined,
  unhideInstance: () => undefined,
  unhideTextInstance: () => undefined,
  getCurrentEventPriority: () => DefaultEventPriority,
  resolveUpdatePriority: () => DefaultEventPriority,
  setCurrentUpdatePriority: () => undefined,
  getCurrentUpdatePriority: () => NoEventPriority,
  maySuspendCommit: () => false,
  startSuspendingCommit: () => undefined,
  suspendInstance: () => undefined,
  suspendOnActiveViewTransition: () => undefined,
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: {},
  resetFormInstance: () => undefined,
  requestPostPaintCallback: () => undefined,
  trackSchedulerEvent: () => undefined,
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  shouldAttemptEagerTransition: () => false,
  detachDeletedInstance: () => undefined,
  beforeActiveInstanceBlur: () => undefined,
  afterActiveInstanceBlur: () => undefined,
  preparePortalMount: () => undefined,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
  isTimeoutScheduled: () => false,
  getInstanceFromNode: () => null,
  beforeCommit: () => undefined,
  afterCommit: () => undefined,
  prepareScopeUpdate: () => undefined,
  getInstanceFromScope: () => null,
  setFocusIfFocusable: () => false,
}) as ReconcilerInstance;

function groupCommandsByPage(commands: PdfCommand[]) {
  const groups: PdfCommand[][] = [];
  let current: PdfCommand[] | undefined;

  for (const command of commands) {
    if (command.type === "beginPage") {
      current = [];
      groups[command.index] = current;
      continue;
    }

    current ??= [];
    current.push(command);
  }

  return groups.length > 0 ? groups : [[] satisfies PdfCommand[]];
}

function collectEmbeddedFonts(commands: PdfCommand[]): EmbeddedFontResource[] {
  const resources = new Map<string, EmbeddedFontResource>();

  for (const command of commands) {
    if (
      command.type !== "text" ||
      command.embeddedFont === undefined ||
      command.embeddedFont.font.bytes === undefined
    )
      continue;

    const font = command.embeddedFont.font;
    const key = embeddedFontKey(font);
    let resource = resources.get(key);
    if (resource === undefined) {
      resource = {
        key,
        name: `EF${resources.size + 1}`,
        font,
        glyphs: new Map(),
        sourceToSubsetGlyphs: new Map(),
        subsetBytes: new Uint8Array(),
        type0Object: 0,
        cidFontObject: 0,
        descriptorObject: 0,
        fileObject: 0,
        toUnicodeObject: 0,
      };
      resources.set(key, resource);
    }

    for (const character of command.text) {
      const glyph = font.source.charToGlyph(character);
      if (!resource.sourceToSubsetGlyphs.has(glyph.index)) {
        const subsetGlyphId = resource.sourceToSubsetGlyphs.size + 1;
        resource.sourceToSubsetGlyphs.set(glyph.index, subsetGlyphId);
        resource.glyphs.set(subsetGlyphId, {
          sourceGlyphId: glyph.index,
          unicode: character,
          width: Math.round((glyph.advanceWidth / font.unitsPerEm) * 1000),
        });
      }
    }
  }

  return [...resources.values()].map((resource) => ({
    ...resource,
    subsetBytes: createSubsetFontBytes(resource),
  }));
}

function appendEmbeddedFontObjects(objects: PdfObject[], fonts: EmbeddedFontResource[]) {
  for (const font of fonts) {
    const glyphIds = [...font.glyphs.keys()].sort((left, right) => left - right);
    const descender = font.font.descender ?? -Math.round(font.font.ascender * 0.25);
    const fontBBox = [-1000, Math.round(descender), 3000, Math.round(font.font.ascender)];

    objects[font.type0Object] =
      `<< /Type /Font /Subtype /Type0 /BaseFont /${font.name} /Encoding /Identity-H ` +
      `/DescendantFonts [${font.cidFontObject} 0 R] /ToUnicode ${font.toUnicodeObject} 0 R >>`;
    objects[font.cidFontObject] =
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${font.name} ` +
      `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
      `/FontDescriptor ${font.descriptorObject} 0 R /CIDToGIDMap /Identity /DW 1000 /W ${cidWidths(font, glyphIds)} >>`;
    objects[font.descriptorObject] =
      `<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${fontBBox.join(
        " ",
      )}] /ItalicAngle 0 /Ascent ${Math.round(font.font.ascender)} /Descent ${Math.round(
        descender,
      )} /CapHeight ${Math.round(font.font.ascender)} /StemV 80 /FontFile2 ${font.fileObject} 0 R >>`;
    objects[font.fileObject] = createBinaryStreamObject(font.subsetBytes);
    objects[font.toUnicodeObject] = createStreamObject(toUnicodeCMap(font, glyphIds));
  }
}

function embeddedFontForCommand(
  command: Extract<PdfCommand, { type: "text" }>,
  fonts: EmbeddedFontResource[],
) {
  if (command.embeddedFont === undefined) return undefined;
  const key = embeddedFontKey(command.embeddedFont.font);
  return fonts.find((font) => font.key === key);
}

function embeddedFontKey(font: TextOutlineFont) {
  return `${font.unitsPerEm}:${font.ascender}:${font.descender ?? ""}:${font.bytes?.byteLength ?? 0}`;
}

function textToGlyphHex(text: string, font: EmbeddedFontResource) {
  return Array.from(text, (character) => {
    const glyph = font.font.source.charToGlyph(character);
    return (font.sourceToSubsetGlyphs.get(glyph.index) ?? 0).toString(16).padStart(4, "0");
  }).join("");
}

function cidWidths(font: EmbeddedFontResource, glyphIds: number[]) {
  return `[${glyphIds
    .map((glyphId) => `${glyphId} [${font.glyphs.get(glyphId)?.width ?? 1000}]`)
    .join(" ")}]`;
}

function createSubsetFontBytes(resource: EmbeddedFontResource) {
  const sourceFont = resource.font.source as unknown as {
    constructor: new (options: Record<string, unknown>) => { toArrayBuffer(): ArrayBuffer };
    glyphs: { get(index: number): unknown };
    names?: { unicode?: { fontFamily?: { en?: string }; fontSubfamily?: { en?: string } } };
  };
  const sourceGlyphs = [0, ...[...resource.glyphs.values()].map((glyph) => glyph.sourceGlyphId)];
  const glyphs = sourceGlyphs.map((glyphId, index) =>
    cloneGlyph(sourceFont.glyphs.get(glyphId), index),
  );
  const familyName = sourceFont.names?.unicode?.fontFamily?.en ?? resource.name;
  const styleName = sourceFont.names?.unicode?.fontSubfamily?.en ?? "Regular";
  const font = new sourceFont.constructor({
    familyName,
    styleName,
    unitsPerEm: resource.font.unitsPerEm,
    ascender: resource.font.ascender,
    descender: resource.font.descender ?? -Math.round(resource.font.ascender * 0.25),
    glyphs,
  });

  return new Uint8Array(font.toArrayBuffer());
}

function cloneGlyph(source: unknown, index: number) {
  const glyph = source as {
    constructor: new (options: Record<string, unknown>) => unknown;
    name?: string;
    unicode?: number;
    unicodes?: number[];
    xMin?: number;
    yMin?: number;
    xMax?: number;
    yMax?: number;
    advanceWidth?: number;
    leftSideBearing?: number;
    path?: unknown;
  };

  return new glyph.constructor({
    index,
    name: index === 0 ? ".notdef" : glyph.name,
    unicode: index === 0 ? undefined : glyph.unicode,
    unicodes: index === 0 ? [] : glyph.unicodes,
    xMin: glyph.xMin,
    yMin: glyph.yMin,
    xMax: glyph.xMax,
    yMax: glyph.yMax,
    advanceWidth: glyph.advanceWidth,
    leftSideBearing: glyph.leftSideBearing,
    path: glyph.path,
  });
}

function toUnicodeCMap(font: EmbeddedFontResource, glyphIds: number[]) {
  const mappings = glyphIds
    .map(
      (glyphId) =>
        `<${glyphId.toString(16).padStart(4, "0")}> <${unicodeHex(font.glyphs.get(glyphId)?.unicode ?? "")}>`,
    )
    .join("\n");

  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /VasaToUnicode def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <ffff>",
    "endcodespacerange",
    `${glyphIds.length} beginbfchar`,
    mappings,
    "endbfchar",
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

function unicodeHex(value: string) {
  return Array.from(value, (character) =>
    character.codePointAt(0)!.toString(16).padStart(4, "0"),
  ).join("");
}

function serializePageCommands(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  embeddedFonts: EmbeddedFontResource[] = [],
) {
  return commands
    .map((command) => {
      if (command.type === "beginPage") return "";

      if (command.type === "textPath") {
        return [
          "q",
          `${serializeFillColor(command.fill)} rg`,
          `1 0 0 -1 0 ${formatNumber(page.height)} cm`,
          serializePath(command.path),
          "f",
          "Q",
        ].join("\n");
      }

      if (command.type === "path") {
        return serializePathCommand(command, page);
      }

      if (command.type === "rect") {
        return serializeRectCommand(command, page);
      }

      const embeddedFont = embeddedFontForCommand(command, embeddedFonts);
      const x = formatNumber(command.x);
      const y = formatNumber(
        embeddedFont === undefined
          ? page.height - command.y - command.fontSize + command.fontSize * 0.25
          : page.height -
              command.y -
              (embeddedFont.font.ascender / embeddedFont.font.unitsPerEm) * command.fontSize,
      );
      const fontSize = formatNumber(command.fontSize);
      const font = embeddedFont?.name ?? pdfFontResource(command);
      return [
        "BT",
        `${serializeFillColor(command.fill ?? "#000000")} rg`,
        command.invisible === true ? "3 Tr" : undefined,
        `/${font} ${fontSize} Tf`,
        `1 0 0 1 ${x} ${y} Tm`,
        embeddedFont === undefined
          ? `(${escapePdfString(command.text)}) Tj`
          : `<${textToGlyphHex(command.text, embeddedFont)}> Tj`,
        "ET",
      ]
        .filter((operation) => operation !== undefined)
        .join(" ");
    })
    .filter(Boolean)
    .join("\n");
}

function pdfFontResource(command: Extract<PdfCommand, { type: "text" }>) {
  const bold = isBoldFontWeight(command.fontWeight);
  const italic = isItalicFontStyle(command.fontStyle);
  if (bold && italic) return "F4";
  if (italic) return "F3";
  if (bold) return "F2";
  return "F1";
}

function isItalicFontStyle(fontStyle: string | undefined) {
  return fontStyle === "italic" || fontStyle === "oblique";
}

function serializeRectCommand(
  command: Extract<PdfCommand, { type: "rect" }>,
  page: LayoutOptions["page"],
) {
  const x = formatNumber(command.rect.x);
  const y = formatNumber(page.height - command.rect.y - command.rect.height);
  const width = formatNumber(command.rect.width);
  const height = formatNumber(command.rect.height);

  return [
    "q",
    `${serializeFillColor(command.fill)} rg`,
    `${x} ${y} ${width} ${height} re`,
    "f",
    "Q",
  ].join("\n");
}

function serializePathCommand(
  command: Extract<PdfCommand, { type: "path" }>,
  page: LayoutOptions["page"],
) {
  const operations = [
    "q",
    `1 0 0 -1 0 ${formatNumber(page.height)} cm`,
    command.strokeWidth === undefined ? undefined : `${formatNumber(command.strokeWidth)} w`,
    command.fill === undefined ? undefined : `${serializeFillColor(command.fill)} rg`,
    command.stroke === undefined ? undefined : `${serializeFillColor(command.stroke)} RG`,
    serializePath(command.path),
    paintPathOperator(command),
    "Q",
  ].filter((operation) => operation !== undefined);

  return operations.join("\n");
}

function paintPathOperator(command: Extract<PdfCommand, { type: "path" }>) {
  if (command.fill !== undefined && command.stroke !== undefined) return "B";
  if (command.stroke !== undefined) return "S";
  return "f";
}

function isBoldFontWeight(fontWeight: string | undefined) {
  if (fontWeight === undefined) return false;
  if (fontWeight.toLowerCase() === "bold") return true;
  const parsed = Number.parseInt(fontWeight, 10);
  return Number.isFinite(parsed) && parsed >= 600;
}

function createStreamObject(stream: string) {
  return `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`;
}

function createBinaryStreamObject(stream: Uint8Array) {
  return concatBytes(
    new TextEncoder().encode(`<< /Length ${stream.byteLength} >>\nstream\n`),
    stream,
    new TextEncoder().encode("\nendstream"),
  );
}

async function createCompressedStreamObject(stream: string) {
  const compressed = await flateDeflate(new TextEncoder().encode(stream));
  return concatBytes(
    new TextEncoder().encode(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`),
    compressed,
    new TextEncoder().encode("\nendstream"),
  );
}

async function flateDeflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return bytes;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("deflate") as never) as ReadableStream<Uint8Array>;
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function createInfoDictionary(metadata: PdfMetadata) {
  const entries = [
    metadata.title === undefined ? undefined : `/Title (${escapePdfString(metadata.title)})`,
    metadata.author === undefined ? undefined : `/Author (${escapePdfString(metadata.author)})`,
    "/Producer (Vasa PDF)",
  ].filter((entry) => entry !== undefined);

  return `<< ${entries.join(" ")} >>`;
}

type PdfObject = string | Uint8Array;

function isPdfObject(value: PdfObject | Promise<PdfObject>): value is PdfObject {
  return typeof value === "string" || value instanceof Uint8Array;
}

function encodePdfObjects(objects: PdfObject[], catalogObject: number, infoObject: number) {
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let length = 0;
  const append = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    chunks.push(bytes);
    length += bytes.byteLength;
  };

  append("%PDF-1.7\n");

  for (let objectId = 1; objectId < objects.length; objectId++) {
    offsets[objectId] = length;
    append(`${objectId} 0 obj\n`);
    append(objects[objectId] ?? "");
    append("\nendobj\n");
  }

  const xrefOffset = length;
  append(`xref\n0 ${objects.length}\n`);
  append("0000000000 65535 f \n");

  for (let objectId = 1; objectId < objects.length; objectId++) {
    append(`${offsets[objectId].toString().padStart(10, "0")} 00000 n \n`);
  }

  append(
    `trailer\n<< /Size ${objects.length} /Root ${catalogObject} 0 R /Info ${infoObject} 0 R >>\n`,
  );
  append(`startxref\n${xrefOffset}\n%%EOF\n`);

  return concatBytes(...chunks);
}

function concatBytes(...chunks: Uint8Array[]) {
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replaceAll(/0+$/g, "").replaceAll(/\.$/g, "");
}

function serializePath(path: TextOutlinePath | SvgPath) {
  return path.commands
    .map((command) => {
      if (command.type === "moveTo") {
        return `${formatNumber(command.x)} ${formatNumber(command.y)} m`;
      }

      if (command.type === "lineTo") {
        return `${formatNumber(command.x)} ${formatNumber(command.y)} l`;
      }

      if (command.type === "bezierCurveTo") {
        return [
          formatNumber(command.x1),
          formatNumber(command.y1),
          formatNumber(command.x2),
          formatNumber(command.y2),
          formatNumber(command.x),
          formatNumber(command.y),
          "c",
        ].join(" ");
      }

      return "h";
    })
    .join("\n");
}

function serializeFillColor(fill: string) {
  const rgb = parseHexColor(fill);
  return rgb.map((channel) => formatNumber(channel / 255)).join(" ");
}

function parseHexColor(fill: string) {
  const normalized = fill.trim();

  if (/^#[\da-f]{6}$/i.test(normalized)) {
    return [
      Number.parseInt(normalized.slice(1, 3), 16),
      Number.parseInt(normalized.slice(3, 5), 16),
      Number.parseInt(normalized.slice(5, 7), 16),
    ];
  }

  if (/^#[\da-f]{3}$/i.test(normalized)) {
    return Array.from(normalized.slice(1), (channel) => Number.parseInt(channel + channel, 16));
  }

  return [17, 17, 17];
}

function escapePdfString(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll("\n", "\\n");
}

function defaultErrorHandler(error: unknown) {
  throw error;
}
