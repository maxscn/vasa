import {
  DEFAULT_FONT,
  layoutDocument,
  type BoxNode,
  type LayoutBox,
  type LayoutNode,
  type LayoutOptions,
  type LayoutPage,
  type LayoutResult,
  type Rect,
  type TextStyle,
} from "@vasa/layout";
import {
  createTextLineOutline,
  textOutlinePathBounds,
  type RenderDocument,
  type RenderCustomNode,
  type RenderNode,
  type RenderTextNode,
  type SvgPath,
  type TextOutlineFont,
  type TextOutlinePath,
} from "@vasa/renderer";
import Reconciler from "react-reconciler";
import { DefaultEventPriority, NoEventPriority } from "react-reconciler/constants";
import type { CanvasPrimitiveProps } from "./primitives.js";

export { Box } from "./box.js";
export { Document } from "./document.js";
export {
  createCanvasPrimitive,
  type CanvasPrimitiveComponent,
  type CanvasPrimitiveProps,
  type CanvasPrimitiveType,
  type CanvasTextProps,
} from "./primitives.js";
export { Text } from "./text.js";

type CanvasElementHostNode = {
  type: string;
  props: CanvasPrimitiveProps;
  children: CanvasHostNode[];
};

type CanvasTextInstanceHostNode = {
  type: "textInstance";
  text: string;
  children: [];
};

export type CanvasHostNode = CanvasElementHostNode | CanvasTextInstanceHostNode;

export type CanvasRootContainer = {
  children: CanvasHostNode[];
};

type ReconcilerInstance = {
  createContainer: (...args: unknown[]) => unknown;
  updateContainerSync?: (...args: unknown[]) => void;
  updateContainer: (...args: unknown[]) => void;
  flushSyncWork?: () => void;
};

export type CanvasScene = {
  pages: CanvasPageNode[];
};

export type CanvasPageNode = {
  key: string;
  index: number;
  rect: Rect;
  children: CanvasNode[];
};

export type CanvasNode = CanvasBoxNode | CanvasTextLineNode | CanvasPathNode;

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
};

export type CanvasPathNode = {
  key: string;
  kind: "path";
  path: SvgPath;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

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
};

export type CanvasRenderNodeContext = {
  node: RenderCustomNode;
  yOffset: number;
  options: CanvasRendererOptions;
  renderNode: (node: RenderNode) => CanvasNode[];
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
  skewX?: number;
};

export type CanvasBoxPaint = {
  fill?: string;
  stroke?: string;
};

export type CanvasCommand =
  | { type: "clearRect"; rect: Rect }
  | { type: "fillRect"; rect: Rect; fill: string }
  | { type: "strokeRect"; rect: Rect; stroke: string }
  | { type: "fillText"; text: string; x: number; y: number; font: string; fill: string }
  | { type: "fillPath"; path: TextOutlinePath; fill: string }
  | { type: "path"; path: SvgPath; fill?: string; stroke?: string; strokeWidth?: number };

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

export type CanvasSurface = {
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect?(x: number, y: number, width: number, height: number): void;
  strokeRect?(x: number, y: number, width: number, height: number): void;
  fillText?(text: string, x: number, y: number): void;
  beginPath?(): void;
  moveTo?(x: number, y: number): void;
  lineTo?(x: number, y: number): void;
  bezierCurveTo?(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
  closePath?(): void;
  fill?(): void;
  stroke?(): void;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  font?: string;
  textBaseline?: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
};

type SceneNode = {
  key: string;
  snapshot: SceneNodeSnapshot;
  children: SceneNode[];
};

export function createCanvasRenderer(surface: CanvasSurface, options: CanvasRendererOptions = {}) {
  let current: CanvasScene | undefined;

  return {
    render(document: LayoutResult | RenderDocument): CanvasRenderResult {
      const scene = buildCanvasScene(document, options);
      const operations = reconcileCanvasScenes(current, scene);
      const didPaint = shouldPaint(operations);
      const commands = didPaint ? createCanvasCommands(scene, options) : [];

      if (didPaint) {
        applyCanvasCommands(surface, commands);
      }

      current = scene;

      return { scene, operations, commands, didPaint };
    },
    reset() {
      current = undefined;
    },
  };
}

export function renderReactToCanvasScene(
  element: unknown,
  layoutOptions: LayoutOptions,
  options: CanvasRendererOptions = {},
): CanvasScene {
  return buildCanvasScene(layoutDocument(renderReactToLayoutTree(element), layoutOptions), options);
}

export function renderReactToCanvasCommands(
  element: unknown,
  layoutOptions: LayoutOptions,
  options: CanvasRendererOptions = {},
): CanvasCommand[] {
  return createCanvasCommands(renderReactToCanvasScene(element, layoutOptions, options), options);
}

export function renderReactToLayoutTree(element: unknown): BoxNode {
  const container = createCanvasRootContainer();
  const root = canvasReconciler.createContainer(
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

  if (typeof canvasReconciler.updateContainerSync === "function") {
    canvasReconciler.updateContainerSync(element, root, null, null);
  } else {
    canvasReconciler.updateContainer(element, root, null, null);
  }

  canvasReconciler.flushSyncWork?.();

  const document = container.children.find((child) => child.type === "document");
  return hostNodeToLayoutTree(
    document ?? { type: "document", props: {}, children: container.children },
  );
}

export function createCanvasRootContainer(): CanvasRootContainer {
  return { children: [] };
}

export function buildCanvasScene(
  document: LayoutResult | RenderDocument,
  options: CanvasRendererOptions = {},
): CanvasScene {
  if (isRenderDocument(document)) return buildCanvasSceneFromRenderDocument(document, options);

  const layout = document;
  const pageGap = options.pageGap ?? 24;

  return {
    pages: layout.pages.map((page) => {
      const rect = pageRect(page, options.pageSize);
      const yOffset = page.index * (rect.height + pageGap);

      return {
        key: `page:${page.index}`,
        index: page.index,
        rect: { ...rect, y: yOffset },
        children: page.boxes.flatMap((box, index) =>
          buildCanvasNodes(box, options, `${index}`, yOffset),
        ),
      };
    }),
  };
}

export function buildCanvasSceneFromRenderDocument(
  document: RenderDocument,
  options: CanvasRendererOptions = {},
): CanvasScene {
  const pageGap = options.pageGap ?? 24;

  return {
    pages: document.pages.map((page) => {
      const rect = pageRectFromRenderPage(page.rect, options.pageSize);
      const yOffset = page.index * (rect.height + pageGap);

      return {
        key: `page:${page.index}`,
        index: page.index,
        rect: { ...rect, y: yOffset },
        children: page.nodes.flatMap((node) =>
          buildCanvasNodesFromRenderNode(node, yOffset, options),
        ),
      };
    }),
  };
}

export function createCanvasCommands(
  scene: CanvasScene,
  options: CanvasRendererOptions = {},
): CanvasCommand[] {
  const pageBackground = options.pageBackground ?? "#ffffff";
  const commands: CanvasCommand[] = [];

  for (const page of scene.pages) {
    commands.push({ type: "clearRect", rect: page.rect });
    commands.push({ type: "fillRect", rect: page.rect, fill: pageBackground });
    appendNodeCommands(commands, page.children);
  }

  return commands;
}

export function reconcileCanvasScenes(
  previous: CanvasScene | undefined,
  next: CanvasScene,
): ReconcileOperation[] {
  if (previous === undefined) {
    return flattenScene(next).map((node) => ({
      type: "mount",
      key: node.key,
      next: node.snapshot,
    }));
  }

  return reconcileNodeLists(flattenScene(previous), flattenScene(next));
}

export function applyCanvasCommands(surface: CanvasSurface, commands: CanvasCommand[]) {
  surface.textBaseline = "top";

  for (const command of commands) {
    if (command.type === "clearRect") {
      surface.clearRect(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      continue;
    }

    if (command.type === "fillRect") {
      surface.fillStyle = command.fill;
      surface.fillRect?.(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      continue;
    }

    if (command.type === "strokeRect") {
      surface.strokeStyle = command.stroke;
      surface.strokeRect?.(command.rect.x, command.rect.y, command.rect.width, command.rect.height);
      continue;
    }

    if (command.type === "fillPath") {
      surface.fillStyle = command.fill;
      fillSurfacePath(surface, command.path);
      continue;
    }

    if (command.type === "path") {
      surface.fillStyle = command.fill;
      surface.strokeStyle = command.stroke;
      surface.lineWidth = command.strokeWidth ?? 1;
      paintSurfacePath(surface, command.path, {
        fill: command.fill !== undefined,
        stroke: command.stroke !== undefined,
      });
      continue;
    }

    surface.fillStyle = command.fill;
    surface.font = command.font;
    surface.fillText?.(command.text, command.x, command.y);
  }
}

function hostNodeToLayoutTree(node: CanvasHostNode): BoxNode {
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

function hostNodeToLayoutNodes(node: CanvasHostNode): LayoutNode[] {
  if (isTextInstanceHostNode(node)) return [];
  if (node.type === "text") return [hostTextNodeToLayoutText(node)];
  if (node.type !== "document" && node.type !== "box") {
    return [hostNodeToCustomLayoutNode(node)];
  }
  return [hostNodeToLayoutTree(node)];
}

function hostTextNodeToLayoutText(node: CanvasElementHostNode) {
  return {
    type: "text" as const,
    id: node.props.id,
    text: typeof node.props.text === "string" ? node.props.text : collectText(node),
    style: node.props.style as TextStyle,
  };
}

function collectText(node: CanvasHostNode): string {
  if (isTextInstanceHostNode(node)) return node.text;
  return node.children.map((child) => collectText(child)).join("");
}

function hostNodeToCustomLayoutNode(node: CanvasElementHostNode): LayoutNode {
  return {
    ...primitiveProps(node.props),
    type: node.type,
    id: node.props.id,
    style: node.props.style as LayoutNode["style"],
    children: node.children.flatMap((child) => hostNodeToLayoutNodes(child)),
  } as LayoutNode;
}

function primitiveProps(props: CanvasPrimitiveProps): Record<string, unknown> {
  const { children, id, style, ...rest } = props;
  void children;
  void id;
  void style;
  return rest;
}

function childList(parent: CanvasElementHostNode | CanvasRootContainer): CanvasHostNode[] {
  return parent.children;
}

function appendChild(parent: CanvasElementHostNode | CanvasRootContainer, child: CanvasHostNode) {
  childList(parent).push(child);
}

function insertBefore(
  parent: CanvasElementHostNode | CanvasRootContainer,
  child: CanvasHostNode,
  beforeChild: CanvasHostNode,
) {
  const children = childList(parent);
  const existingIndex = children.indexOf(child);
  if (existingIndex >= 0) children.splice(existingIndex, 1);

  const index = children.indexOf(beforeChild);
  children.splice(index < 0 ? children.length : index, 0, child);
}

function removeChild(parent: CanvasElementHostNode | CanvasRootContainer, child: CanvasHostNode) {
  const children = childList(parent);
  const index = children.indexOf(child);
  if (index >= 0) children.splice(index, 1);
}

function createHostNode(type: string, props: CanvasPrimitiveProps): CanvasHostNode {
  return { type, props, children: [] };
}

function commitUpdate(
  instance: CanvasHostNode,
  _type: string,
  _oldProps: CanvasPrimitiveProps,
  newProps: CanvasPrimitiveProps,
) {
  if (!isTextInstanceHostNode(instance)) {
    instance.props = newProps;
  }
}

function isTextInstanceHostNode(node: CanvasHostNode): node is CanvasTextInstanceHostNode {
  return "text" in node;
}

function defaultErrorHandler(error: unknown) {
  throw error;
}

const canvasReconciler = Reconciler({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,
  noTimeout: -1,
  getRootHostContext: () => null,
  getChildHostContext: () => null,
  getPublicInstance: (instance: CanvasHostNode) => instance,
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
  clearContainer: (container: CanvasRootContainer) => {
    container.children = [];
    return false;
  },
  prepareUpdate: () => true,
  commitUpdate,
  commitTextUpdate: (
    textInstance: CanvasTextInstanceHostNode,
    _oldText: string,
    newText: string,
  ) => {
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

function buildCanvasNodes(
  box: LayoutBox,
  options: CanvasRendererOptions,
  path: string,
  yOffset: number,
): CanvasNode[] {
  const keyBase = box.id ?? path;
  const nodes: CanvasNode[] = [];

  if (box.type === "box") {
    const paint = resolveBoxPaint(box, options.box);
    const children = box.children.flatMap((child, index) =>
      buildCanvasNodes(child, options, `${path}.${index}`, yOffset),
    );

    if (paint !== undefined) {
      nodes.push({
        key: `box:${keyBase}`,
        kind: "box",
        rect: offsetRect(box.rect, yOffset),
        fill: paint.fill,
        stroke: paint.stroke,
        children,
      });
    } else {
      nodes.push(...children);
    }
  } else {
    for (const [lineIndex, line] of (box.lines ?? []).entries()) {
      const paint = resolveTextPaint(box, lineIndex, options.text);
      nodes.push({
        key: `text:${keyBase}:${lineIndex}`,
        kind: "textLine",
        text: line.text,
        x: line.x,
        y: line.y + yOffset,
        width: line.width,
        height: line.height,
        font: canvasFontForTextLine(paint, line),
        fill: paint.fill ?? line.color ?? "#111111",
        ...(line.backgroundColor === undefined ? {} : { backgroundColor: line.backgroundColor }),
        ...(line.textDecorationLine === undefined
          ? {}
          : { textDecorationLine: line.textDecorationLine }),
        ...(line.textDecorationColor === undefined
          ? {}
          : { textDecorationColor: line.textDecorationColor }),
        ...(paint.outlineFont === undefined
          ? {}
          : {
              outline: createTextLineOutline(
                { ...line, y: line.y + yOffset },
                {
                  font: paint.outlineFont,
                  fontSize: paint.fontSize ?? line.fontSize ?? line.height,
                  letterSpacing: paint.letterSpacing,
                  embolden: paint.embolden,
                  skewX: paint.skewX,
                },
              ),
            }),
      });
    }
  }

  return nodes;
}

function buildCanvasNodesFromRenderNode(
  node: RenderNode,
  yOffset: number,
  options: CanvasRendererOptions,
): CanvasNode[] {
  if (node.kind === "custom") {
    const extensionNodes = renderCustomNodeWithExtensions(node, yOffset, options);
    if (extensionNodes !== undefined) return extensionNodes;
  }

  if (node.kind === "box" || node.kind === "custom") {
    const children = node.children.flatMap((child) =>
      buildCanvasNodesFromRenderNode(child, yOffset, options),
    );
    const blockquoteBorder = renderBlockquoteBorderCanvasNode(node, yOffset);
    return blockquoteBorder === undefined ? children : [blockquoteBorder, ...children];
  }

  return renderTextNodeToCanvasNodes(node, yOffset, options);
}

function renderBlockquoteBorderCanvasNode(
  node: Extract<RenderNode, { kind: "box" | "custom" }>,
  yOffset: number,
): CanvasBoxNode | undefined {
  const border = blockquoteBorderRect(node.rect, node.props, yOffset);
  if (border === undefined) return undefined;

  return {
    key: `${node.key}:blockquote-border`,
    kind: "box",
    rect: border.rect,
    fill: border.fill,
    children: [],
  };
}

function renderCustomNodeWithExtensions(
  node: Extract<RenderNode, { kind: "custom" }>,
  yOffset: number,
  options: CanvasRendererOptions,
) {
  for (const extension of options.extensions ?? []) {
    const nodes = extension.toCanvasNodes?.({
      node,
      yOffset,
      options,
      renderNode(child) {
        return buildCanvasNodesFromRenderNode(child, yOffset, options);
      },
    });
    if (nodes !== undefined) return nodes;
  }

  return undefined;
}

function renderTextNodeToCanvasNodes(
  node: RenderTextNode,
  yOffset: number,
  options: CanvasRendererOptions,
): CanvasTextLineNode[] {
  return node.lines.map((line, lineIndex) => {
    const paint = resolveRenderTextPaint(node, lineIndex, options.text);
    const y = line.y + yOffset;

    return {
      key: `${node.key}:${lineIndex}`,
      kind: "textLine",
      text: line.text,
      x: line.x,
      y,
      width: line.width,
      height: line.height,
      font: canvasFontForTextLine(paint, line),
      fill: paint.fill ?? line.color ?? "#111111",
      ...(line.backgroundColor === undefined ? {} : { backgroundColor: line.backgroundColor }),
      ...(line.textDecorationLine === undefined
        ? {}
        : { textDecorationLine: line.textDecorationLine }),
      ...(line.textDecorationColor === undefined
        ? {}
        : { textDecorationColor: line.textDecorationColor }),
      ...(line.textDecorationOffset === undefined
        ? {}
        : { textDecorationOffset: line.textDecorationOffset }),
      ...(line.textDecorationThickness === undefined
        ? {}
        : { textDecorationThickness: line.textDecorationThickness }),
      ...(paint.outlineFont === undefined
        ? {}
        : {
            outline: createTextLineOutline(
              { ...line, y },
              {
                font: paint.outlineFont,
                fontSize: paint.fontSize ?? line.fontSize ?? line.height,
                letterSpacing: paint.letterSpacing,
                embolden: paint.embolden,
                skewX: paint.skewX,
              },
            ),
          }),
    };
  });
}

function appendNodeCommands(commands: CanvasCommand[], nodes: CanvasNode[]) {
  for (const node of nodes) {
    if (node.kind === "box") {
      if (node.fill !== undefined)
        commands.push({ type: "fillRect", rect: node.rect, fill: node.fill });
      if (node.stroke !== undefined) {
        commands.push({ type: "strokeRect", rect: node.rect, stroke: node.stroke });
      }
      appendNodeCommands(commands, node.children);
      continue;
    }

    if (node.kind === "path") {
      commands.push({
        type: "path",
        path: node.path,
        fill: node.fill,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth,
      });
      continue;
    }

    appendTextBackgroundCommands(commands, node);

    if (node.outline === undefined) {
      commands.push({
        type: "fillText",
        text: node.text,
        x: node.x,
        y: node.y,
        font: node.font,
        fill: node.fill,
      });
    } else {
      commands.push({ type: "fillPath", path: node.outline, fill: node.fill });
    }

    appendTextDecorationCommands(commands, node);
  }
}

function appendTextBackgroundCommands(commands: CanvasCommand[], node: CanvasTextLineNode) {
  if (node.backgroundColor !== undefined) {
    commands.push({
      type: "fillRect",
      rect: snappedTextRect(node, node.outline),
      fill: node.backgroundColor,
    });
  }
}

function appendTextDecorationCommands(commands: CanvasCommand[], node: CanvasTextLineNode) {
  if (node.textDecorationLine !== undefined) {
    const fontSize = fontSizeFromCanvasTextNode(node);
    commands.push({
      type: "fillRect",
      rect: textDecorationRect(node, fontSize, node.outline),
      fill: node.textDecorationColor ?? node.fill,
    });
  }
}

function textDecorationRect(
  node: CanvasTextLineNode,
  fontSize: number,
  outline: TextOutlinePath | undefined,
): Rect {
  const horizontal = snappedTextHorizontalRect(node, outline);
  const thickness = node.textDecorationThickness ?? Math.max(1, Math.round(fontSize * 0.06));
  const fallbackOffset =
    node.textDecorationLine === "line-through"
      ? fontSize * 0.6
      : Math.min(node.height - thickness, fontSize);
  const offset = node.textDecorationOffset ?? fallbackOffset;

  return {
    x: horizontal.x,
    y: Math.round(node.y + offset),
    width: horizontal.width,
    height: thickness,
  };
}

function snappedTextRect(node: CanvasTextLineNode, outline: TextOutlinePath | undefined): Rect {
  const horizontal = snappedTextHorizontalRect(node, outline);
  return {
    x: horizontal.x,
    y: Math.round(node.y),
    width: horizontal.width,
    height: Math.round(node.height),
  };
}

function snappedTextHorizontalRect(node: CanvasTextLineNode, outline: TextOutlinePath | undefined) {
  const bounds = outline === undefined ? undefined : textOutlinePathBounds(outline);
  if (bounds === undefined) return { x: Math.round(node.x), width: Math.round(node.width) };

  const x = Math.floor(bounds.x);
  return { x, width: Math.max(1, Math.ceil(bounds.x + bounds.width) - x) };
}

function fontSizeFromCanvasTextNode(node: CanvasTextLineNode) {
  const match = node.font.match(/(\d+(?:\.\d+)?)px/);
  if (match === null) return Math.max(1, node.height);
  return Number.parseFloat(match[1]);
}

function canvasFontForTextLine(paint: CanvasTextPaint, line: RenderTextNode["lines"][number]) {
  const font = paint.font ?? line.font ?? DEFAULT_FONT;
  const fontSize = paint.fontSize ?? line.fontSize;
  if (fontSize === undefined) return font;
  return font.replace(/(\d+(?:\.\d+)?)px/, `${formatCssNumber(fontSize)}px`);
}

function formatCssNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function reconcileNodeLists(previous: SceneNode[], next: SceneNode[]): ReconcileOperation[] {
  const previousByKey = new Map(previous.map((node) => [node.key, node]));
  const nextByKey = new Map(next.map((node) => [node.key, node]));
  const operations: ReconcileOperation[] = [];

  for (const previousNode of previous) {
    if (!nextByKey.has(previousNode.key)) {
      operations.push({ type: "unmount", key: previousNode.key, previous: previousNode.snapshot });
    }
  }

  for (const nextNode of next) {
    const previousNode = previousByKey.get(nextNode.key);

    if (previousNode === undefined) {
      operations.push({ type: "mount", key: nextNode.key, next: nextNode.snapshot });
    } else if (!snapshotsEqual(previousNode.snapshot, nextNode.snapshot)) {
      operations.push({
        type: "update",
        key: nextNode.key,
        previous: previousNode.snapshot,
        next: nextNode.snapshot,
      });
    } else {
      operations.push({ type: "retain", key: nextNode.key });
    }
  }

  return operations;
}

function flattenScene(scene: CanvasScene): SceneNode[] {
  return scene.pages.flatMap((page) => flattenPage(page));
}

function flattenPage(page: CanvasPageNode): SceneNode[] {
  return [
    {
      key: page.key,
      snapshot: {
        kind: "page",
        props: { index: page.index, rect: page.rect },
      },
      children: page.children.flatMap((node) => flattenNode(node)),
    },
    ...page.children.flatMap((node) => flattenNode(node)),
  ];
}

function flattenNode(node: CanvasNode): SceneNode[] {
  const snapshot = snapshotNode(node);

  if (node.kind === "box") {
    return [
      { key: node.key, snapshot, children: node.children.flatMap((child) => flattenNode(child)) },
      ...node.children.flatMap((child) => flattenNode(child)),
    ];
  }

  return [{ key: node.key, snapshot, children: [] }];
}

function snapshotNode(node: CanvasNode): SceneNodeSnapshot {
  if (node.kind === "box") {
    return {
      kind: "box",
      props: {
        rect: node.rect,
        fill: node.fill,
        stroke: node.stroke,
      },
    };
  }

  if (node.kind === "path") {
    return {
      kind: "path",
      props: {
        path: node.path,
        fill: node.fill,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth,
      },
    };
  }

  return {
    kind: "textLine",
    props: {
      text: node.text,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      font: node.font,
      fill: node.fill,
      ...(node.outline === undefined ? {} : { outline: node.outline }),
    },
  };
}

function shouldPaint(operations: ReconcileOperation[]) {
  return operations.some((operation) => operation.type !== "retain");
}

function snapshotsEqual(left: SceneNodeSnapshot, right: SceneNodeSnapshot) {
  return left.kind === right.kind && JSON.stringify(left.props) === JSON.stringify(right.props);
}

function pageRect(page: LayoutPage, pageSize: CanvasRendererOptions["pageSize"]): Rect {
  const resolvedPageSize = typeof pageSize === "function" ? pageSize(page) : pageSize;
  const width = resolvedPageSize?.width ?? page.bounds.width;
  const height = resolvedPageSize?.height ?? page.bounds.height;

  return { x: 0, y: 0, width, height };
}

function pageRectFromRenderPage(rect: Rect, pageSize: CanvasRendererOptions["pageSize"]): Rect {
  const resolvedPageSize = typeof pageSize === "function" ? undefined : pageSize;

  return {
    x: 0,
    y: 0,
    width: resolvedPageSize?.width ?? rect.width,
    height: resolvedPageSize?.height ?? rect.height,
  };
}

function isRenderDocument(document: LayoutResult | RenderDocument): document is RenderDocument {
  return document.pages.every((page) => "nodes" in page);
}

function offsetRect(rect: Rect, yOffset: number): Rect {
  return { ...rect, y: rect.y + yOffset };
}

function blockquoteBorderRect(
  rect: Rect,
  props: Record<string, unknown> | undefined,
  yOffset = 0,
): { rect: Rect; fill: string } | undefined {
  const fill =
    typeof props?.blockquoteBorderColor === "string" ? props.blockquoteBorderColor : undefined;
  if (fill === undefined) return undefined;

  const width = typeof props?.blockquoteBorderWidth === "number" ? props.blockquoteBorderWidth : 3;
  return {
    fill,
    rect: {
      x: rect.x,
      y: rect.y + yOffset,
      width,
      height: rect.height,
    },
  };
}

function resolveTextPaint(
  box: LayoutBox,
  lineIndex: number,
  paint: CanvasRendererOptions["text"],
): CanvasTextPaint {
  if (typeof paint === "function") return paint(box, lineIndex);
  return paint ?? {};
}

function resolveRenderTextPaint(
  node: RenderTextNode,
  lineIndex: number,
  paint: CanvasRendererOptions["text"],
): CanvasTextPaint {
  if (typeof paint !== "function") return paint ?? {};
  const line = node.lines[lineIndex];

  return paint(
    {
      id: line?.sourceId ?? node.sourceId,
      type: "text",
      rect: node.rect,
      text: line?.sourceText ?? node.text,
      lines: node.lines,
      children: [],
    },
    lineIndex,
  );
}

function resolveBoxPaint(
  box: LayoutBox,
  paint: CanvasRendererOptions["box"],
): CanvasBoxPaint | undefined {
  if (typeof paint === "function") return paint(box);
  return paint;
}

function fillSurfacePath(surface: CanvasSurface, path: TextOutlinePath) {
  paintSurfacePath(surface, path, { fill: true, stroke: false });
}

function paintSurfacePath(
  surface: CanvasSurface,
  path: TextOutlinePath | SvgPath,
  paint: { fill: boolean; stroke: boolean },
) {
  surface.beginPath?.();

  for (const command of path.commands) {
    if (command.type === "moveTo") {
      surface.moveTo?.(command.x, command.y);
      continue;
    }

    if (command.type === "lineTo") {
      surface.lineTo?.(command.x, command.y);
      continue;
    }

    if (command.type === "bezierCurveTo") {
      surface.bezierCurveTo?.(command.x1, command.y1, command.x2, command.y2, command.x, command.y);
      continue;
    }

    surface.closePath?.();
  }

  if (paint.fill) surface.fill?.();
  if (paint.stroke) surface.stroke?.();
}
