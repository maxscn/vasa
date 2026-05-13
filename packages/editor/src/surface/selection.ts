import type { Editor } from "@skriva/core";
import type { EditorSelection, EditorSelectionPoint } from "../model.ts";
import { isWordSeparator } from "../word.ts";
import type { SkrivaSelectionIntent, SkrivaSurfaceLine, SkrivaSurfacePoint } from "./adapter.ts";

export type SurfaceSelection =
  | Parameters<Editor["commands"]["setTextSelection"]>[0]
  | { type: "gapCursor"; position: number };

export type ProjectSurfaceSelection = (
  point: SkrivaSurfacePoint,
  intent: SkrivaSelectionIntent,
) => SurfaceSelection | undefined;

export function createProjectSurfaceSelection(editor: Editor): ProjectSurfaceSelection {
  return (point, intent) => {
    const position = surfacePointToProseMirrorPosition(editor.state.doc, point);
    if (position === undefined) return undefined;

    if (intent.extend !== true && isBlockBoundarySurfacePoint(editor.state.doc, point)) {
      return { type: "gapCursor", position };
    }

    return intent.extend === true
      ? { from: editor.state.selection.anchor, to: position }
      : position;
  };
}

export function createProjectSurfaceWordSelection(editor: Editor): ProjectSurfaceSelection {
  return (point) => {
    const text = textAtSurfacePath(editor.state.doc, point.path);
    if (text === undefined) return undefined;

    const offset = Math.max(0, Math.min(point.offset, text.length));
    const start = wordBoundary(text, offset, "backward");
    const end = wordBoundary(text, offset, "forward");
    const from = surfacePointToProseMirrorPosition(editor.state.doc, {
      path: point.path,
      offset: start,
    });
    const to = surfacePointToProseMirrorPosition(editor.state.doc, {
      path: point.path,
      offset: end,
    });
    if (from === undefined || to === undefined) return undefined;

    return { from, to };
  };
}

export function createProjectSurfaceLineSelection(editor: Editor) {
  return (_point: SkrivaSurfacePoint, line?: SkrivaSurfaceLine) => {
    if (line === undefined) return undefined;

    const from = surfacePointToProseMirrorPosition(editor.state.doc, {
      path: line.path,
      offset: line.start,
    });
    const to = surfacePointToProseMirrorPosition(editor.state.doc, {
      path: line.path,
      offset: line.start + line.text.length,
    });
    if (from === undefined || to === undefined) return undefined;

    return { from, to };
  };
}

export function surfacePointToProseMirrorPosition(
  doc: Editor["state"]["doc"],
  point: SkrivaSurfacePoint,
): number | undefined {
  const result = positionForPath(doc, point.path, point.offset, 0);
  if (result === undefined) return undefined;
  return Math.max(0, Math.min(result, doc.content.size));
}

export function proseMirrorSelectionToSurfaceSelection(
  selection: Editor["state"]["selection"],
): EditorSelection | undefined {
  const focus = proseMirrorPositionToSurfacePoint(selection.$head.doc, selection.head);
  const anchor = proseMirrorPositionToSurfacePoint(selection.$anchor.doc, selection.anchor);
  if (focus === undefined) return undefined;

  return anchor === undefined || sameSurfacePoint(focus, anchor) ? focus : { ...focus, anchor };
}

export function proseMirrorPositionToSurfacePoint(
  doc: Editor["state"]["doc"],
  position: number,
): EditorSelectionPoint | undefined {
  return pointForPosition(doc, Math.max(0, Math.min(position, doc.content.size)), [], 0);
}

type ProseMirrorNodeLike = {
  childCount: number;
  content: { size: number };
  isText?: boolean;
  isTextblock?: boolean;
  nodeSize: number;
  type?: { name?: string };
  text?: string;
  child(index: number): ProseMirrorNodeLike;
};

function positionForPath(
  node: ProseMirrorNodeLike,
  path: number[],
  offset: number,
  position: number,
): number | undefined {
  const [index, ...rest] = path;
  if (index === undefined) return position;
  if (index < 0 || index >= node.childCount) return undefined;

  let childPosition = position;
  for (let siblingIndex = 0; siblingIndex < index; siblingIndex += 1) {
    childPosition += node.child(siblingIndex).nodeSize;
  }

  const child = node.child(index);
  if (child.isText === true) {
    return rest.length === 0
      ? childPosition + Math.max(0, Math.min(offset, child.text?.length ?? 0))
      : undefined;
  }

  if (isBlockBoundaryNode(child) && rest.length === 0) {
    return offset <= 0 ? childPosition : childPosition + child.nodeSize;
  }

  if (child.isTextblock === true && child.childCount === 0 && rest.length === 1 && rest[0] === 0) {
    return childPosition + 1;
  }

  return positionForPath(child, rest, offset, childPosition + 1);
}

function pointForPosition(
  node: ProseMirrorNodeLike,
  target: number,
  path: number[],
  position: number,
): EditorSelectionPoint | undefined {
  let childPosition = position;

  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index);
    const childPath = [...path, index];
    const childEnd = childPosition + child.nodeSize;

    if (child.isText === true) {
      if (target >= childPosition && target <= childEnd) {
        return {
          path: childPath,
          offset: Math.max(0, Math.min(target - childPosition, child.text?.length ?? 0)),
        };
      }
    } else if (isBlockBoundaryNode(child) && (target === childPosition || target === childEnd)) {
      return { path: childPath, offset: target === childPosition ? 0 : 1 };
    } else if (child.isTextblock === true && child.childCount === 0) {
      if (target > childPosition && target < childEnd) {
        return { path: [...childPath, 0], offset: 0 };
      }
    } else if (target > childPosition && target < childEnd) {
      const point = pointForPosition(child, target, childPath, childPosition + 1);
      if (point !== undefined) return point;
    }

    childPosition = childEnd;
  }

  return undefined;
}

function textAtSurfacePath(doc: ProseMirrorNodeLike, path: number[]) {
  const node = nodeAtPath(doc, path);
  return node?.isText === true ? (node.text ?? "") : undefined;
}

function nodeAtPath(node: ProseMirrorNodeLike, path: number[]): ProseMirrorNodeLike | undefined {
  return path.reduce<ProseMirrorNodeLike | undefined>((current, index) => {
    if (current === undefined || index < 0 || index >= current.childCount) return undefined;
    return current.child(index);
  }, node);
}

function isBlockBoundarySurfacePoint(doc: ProseMirrorNodeLike, point: SkrivaSurfacePoint) {
  return isBlockBoundaryNode(nodeAtPath(doc, point.path));
}

function isBlockBoundaryNode(node: ProseMirrorNodeLike | undefined) {
  return node?.type?.name === "table" || node?.type?.name === "horizontalRule";
}

function wordBoundary(text: string, offset: number, direction: "backward" | "forward") {
  let index = offset;
  if (direction === "backward") {
    while (index > 0 && !isWordSeparator(text[index - 1]!)) index -= 1;
    return index;
  }

  while (index < text.length && !isWordSeparator(text[index]!)) index += 1;
  return index;
}

function sameSurfacePoint(left: EditorSelectionPoint, right: EditorSelectionPoint) {
  return left.offset === right.offset && left.path.join(".") === right.path.join(".");
}
