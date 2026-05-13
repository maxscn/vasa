import type { BoxNode, LayoutNode, TextStyle } from "@skriva/layout";
import Reconciler from "react-reconciler";
import { DefaultEventPriority, NoEventPriority } from "react-reconciler/constants";
import type { PdfPrimitiveProps } from "../primitives.js";

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

type ReconcilerInstance = {
  createContainer: (...args: unknown[]) => unknown;
  updateContainerSync?: (...args: unknown[]) => void;
  updateContainer: (...args: unknown[]) => void;
  flushSyncWork?: () => void;
};

type HostMutationCommand = {
  apply(): void;
};

const REACT_CONCURRENT_ROOT_TAG = 0;
const REACT_NO_TIMEOUT = -1;
const REACT_NO_EVENT_TIMESTAMP = -1.1;

export function renderReactToLayoutTree(element: unknown): BoxNode {
  const container = createPdfRootContainer();
  const root = pdfReconciler.createContainer(
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

export function createPdfRootContainer(): PdfRootContainer {
  return { children: [] };
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
  AppendChild({ parent, child }).apply();
}

function insertBefore(
  parent: PdfElementHostNode | PdfRootContainer,
  child: PdfHostNode,
  beforeChild: PdfHostNode,
) {
  InsertBefore({ parent, child, beforeChild }).apply();
}

function removeChild(parent: PdfElementHostNode | PdfRootContainer, child: PdfHostNode) {
  RemoveChild({ parent, child }).apply();
}

function AppendChild({
  parent,
  child,
}: {
  parent: PdfElementHostNode | PdfRootContainer;
  child: PdfHostNode;
}): HostMutationCommand {
  return {
    apply() {
      childList(parent).push(child);
    },
  };
}

function InsertBefore({
  parent,
  child,
  beforeChild,
}: {
  parent: PdfElementHostNode | PdfRootContainer;
  child: PdfHostNode;
  beforeChild: PdfHostNode;
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

function RemoveChild({
  parent,
  child,
}: {
  parent: PdfElementHostNode | PdfRootContainer;
  child: PdfHostNode;
}): HostMutationCommand {
  return {
    apply() {
      const children = childList(parent);
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
    },
  };
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

function defaultErrorHandler(error: unknown) {
  throw error;
}

const pdfReconciler = Reconciler({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,
  noTimeout: REACT_NO_TIMEOUT,
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
