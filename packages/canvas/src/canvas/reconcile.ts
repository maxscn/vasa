import type {
  CanvasNode,
  CanvasPageNode,
  CanvasScene,
  ReconcileOperation,
  SceneNodeSnapshot,
} from "./types.js";

type SceneNode = {
  key: string;
  snapshot: SceneNodeSnapshot;
};

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

export function shouldPaint(operations: ReconcileOperation[]) {
  return operations.some((operation) => operation.type !== "retain");
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
    },
    ...flattenNodes(page.children),
  ];
}

function flattenNodes(nodes: CanvasNode[]): SceneNode[] {
  return nodes.flatMap((node) => [
    {
      key: node.key,
      snapshot: node.serialize(),
    },
    ...flattenNodes(node.kind === "box" ? node.children : []),
  ]);
}

function snapshotsEqual(left: SceneNodeSnapshot, right: SceneNodeSnapshot) {
  return left.kind === right.kind && JSON.stringify(left.props) === JSON.stringify(right.props);
}
