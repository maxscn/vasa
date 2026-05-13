import type { BoxNode, LayoutNode, TextStyle } from "@skriva/layout";
import Reconciler from "react-reconciler";
import { DefaultEventPriority, NoEventPriority } from "react-reconciler/constants";
import type { CanvasPrimitiveProps } from "../primitives.js";

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

const REACT_CONCURRENT_ROOT_TAG = 0;
const REACT_NO_TIMEOUT = -1;
const REACT_NO_EVENT_TIMESTAMP = -1.1;

export function renderReactToLayoutTree(element: unknown): BoxNode {
  const container = createCanvasRootContainer();
  const root = canvasReconciler.createContainer(
    container,
    REACT_CONCURRENT_ROOT_TAG,
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
  createAppendChildCommand({ parent, child }).apply();
}

function insertBefore(
  parent: CanvasElementHostNode | CanvasRootContainer,
  child: CanvasHostNode,
  beforeChild: CanvasHostNode,
) {
  createInsertBeforeCommand({ parent, child, beforeChild }).apply();
}

function removeChild(parent: CanvasElementHostNode | CanvasRootContainer, child: CanvasHostNode) {
  createRemoveChildCommand({ parent, child }).apply();
}

type HostMutationCommand = {
  apply(): void;
};

function createAppendChildCommand({
  parent,
  child,
}: {
  parent: CanvasElementHostNode | CanvasRootContainer;
  child: CanvasHostNode;
}): HostMutationCommand {
  return {
    apply() {
      childList(parent).push(child);
    },
  };
}

function createInsertBeforeCommand({
  parent,
  child,
  beforeChild,
}: {
  parent: CanvasElementHostNode | CanvasRootContainer;
  child: CanvasHostNode;
  beforeChild: CanvasHostNode;
}): HostMutationCommand {
  return {
    apply() {
      const children = childList(parent);
      const existingIndex = children.indexOf(child);
      if (existingIndex >= 0) children.splice(existingIndex, 1);

      const index = children.indexOf(beforeChild);
      children.splice(index < 0 ? children.length : index, 0, child);
    },
  };
}

function createRemoveChildCommand({
  parent,
  child,
}: {
  parent: CanvasElementHostNode | CanvasRootContainer;
  child: CanvasHostNode;
}): HostMutationCommand {
  return {
    apply() {
      const children = childList(parent);
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
    },
  };
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
  noTimeout: REACT_NO_TIMEOUT,
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
  resolveEventTimeStamp: () => REACT_NO_EVENT_TIMESTAMP,
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
