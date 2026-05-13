import type { JSONContent } from "@skriva/core";
import { EDITOR_CLIPBOARD_MIME_TYPE } from "./constants.js";

export type { JSONContent } from "@skriva/core";

export type EditorSelection = {
  path: number[];
  offset: number;
  anchor?: EditorSelectionPoint;
};

export type EditorSelectionPoint = {
  path: number[];
  offset: number;
};

export const editorClipboardMimeType = EDITOR_CLIPBOARD_MIME_TYPE;

export function headingLevel(value: unknown) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
    ? value
    : 1;
}

export function tableSpan(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

export function tableColwidth(value: unknown) {
  return Array.isArray(value)
    ? value.filter((width): width is number => typeof width === "number" && Number.isFinite(width))
    : undefined;
}

export function isSelectionExpanded(selection: EditorSelection) {
  return (
    selection.anchor !== undefined &&
    (comparePaths(selection.anchor.path, selection.path) !== 0 ||
      selection.anchor.offset !== selection.offset)
  );
}

export function normalizeSelectionRange(
  doc: JSONContent,
  selection: EditorSelection,
): { start: EditorSelectionPoint; end: EditorSelectionPoint } {
  const focus = normalizeSelectionPoint(doc, selection);
  const anchor = normalizeSelectionPoint(doc, selection.anchor ?? selection);

  return comparePoints(anchor, focus) <= 0
    ? { start: anchor, end: focus }
    : { start: focus, end: anchor };
}

export function normalizeSelectionPoint(
  doc: JSONContent,
  point: EditorSelectionPoint,
): EditorSelectionPoint {
  const path = normalizeTextPath(doc, point.path);
  const text = getTextAtPath(doc, path);

  return { path, offset: clampOffset(point.offset, text) };
}

export function previousTextPoint(
  doc: JSONContent,
  path: number[],
): EditorSelectionPoint | undefined {
  const textPaths = collectTextPaths(doc);
  const currentIndex = textPaths.findIndex((textPath) => comparePaths(textPath, path) === 0);
  if (currentIndex < 0) {
    const previousPath = textPaths
      .slice()
      .reverse()
      .find((textPath) => comparePaths(textPath, path) < 0);
    return previousPath === undefined
      ? undefined
      : { path: previousPath, offset: getTextAtPath(doc, previousPath).length };
  }
  if (currentIndex === 0) return undefined;

  const previousPath = textPaths[currentIndex - 1];
  return { path: previousPath, offset: getTextAtPath(doc, previousPath).length };
}

export function nextTextPoint(doc: JSONContent, path: number[]): EditorSelectionPoint | undefined {
  const textPaths = collectTextPaths(doc);
  const currentIndex = textPaths.findIndex((textPath) => comparePaths(textPath, path) === 0);
  if (currentIndex < 0) {
    const nextPath = textPaths.find((textPath) => comparePaths(textPath, path) > 0);
    return nextPath === undefined ? undefined : { path: nextPath, offset: 0 };
  }
  if (currentIndex >= textPaths.length - 1) return undefined;

  const nextPath = textPaths[currentIndex + 1];
  return { path: nextPath, offset: 0 };
}

export function collectTextPaths(node: JSONContent, path: number[] = []): number[][] {
  if (node.type === "text") return [path];

  return (node.content ?? []).flatMap((child, index) => collectTextPaths(child, [...path, index]));
}

export function arePointsInSameTextBlock(doc: JSONContent, left: number[], right: number[]) {
  const leftBlockPath = currentTextBlockPath(doc, left);
  const rightBlockPath = currentTextBlockPath(doc, right);
  return (
    leftBlockPath !== undefined &&
    rightBlockPath !== undefined &&
    comparePaths(leftBlockPath, rightBlockPath) === 0
  );
}

export function currentTextBlockPath(doc: JSONContent, path: number[]): number[] | undefined {
  const topIndex = path[0] ?? 0;
  const topBlock = doc.content?.[topIndex];
  if (topBlock?.type === "paragraph" || topBlock?.type === "heading") return [topIndex];

  if (topBlock?.type === "blockquote") {
    const childIndex = path[1] ?? 0;
    const child = topBlock.content?.[childIndex];
    if (child?.type === "paragraph" || child?.type === "heading") return [topIndex, childIndex];
  }

  return undefined;
}

export function getTextAtPath(doc: JSONContent, path: number[]): string {
  const node = getNodeAtPath(doc, path);
  if (node?.type === "text") return node.text ?? "";
  return "";
}

export function getTextBlockText(block: JSONContent) {
  return (block.content ?? [])
    .filter((child) => child.type === "text")
    .map((child) => child.text ?? "")
    .join("");
}

export function comparePoints(left: EditorSelectionPoint, right: EditorSelectionPoint) {
  const pathComparison = comparePaths(left.path, right.path);
  if (pathComparison !== 0) return pathComparison;
  return left.offset - right.offset;
}

export function comparePaths(left: number[], right: number[]) {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const comparison = (left[index] ?? -1) - (right[index] ?? -1);
    if (comparison !== 0) return comparison;
  }

  return 0;
}

export function getNodeAtPath(doc: JSONContent, path: number[]): JSONContent | undefined {
  let current: JSONContent | undefined = doc;

  for (const index of path) {
    current = current?.content?.[index];
  }

  return current;
}

export function isTextBlock(node: JSONContent) {
  return node.type === "paragraph" || node.type === "heading";
}

export function isPointInsideBlock(point: EditorSelectionPoint, blockPath: number[]) {
  return (
    point.path.length > blockPath.length &&
    blockPath.every((pathSegment, index) => point.path[index] === pathSegment)
  );
}

export function normalizeTextPath(doc: JSONContent, path: number[]): number[] {
  const node = getNodeAtPath(doc, path);
  if (node?.type === "text") return path;

  const blockPath = currentTextBlockPath(doc, path);
  if (blockPath === undefined) return path;

  const block = getNodeAtPath(doc, blockPath);
  if (block?.type === "paragraph" || block?.type === "heading") {
    const textIndex = block.content?.findIndex((child) => child.type === "text") ?? -1;
    return [...blockPath, textIndex >= 0 ? textIndex : 0];
  }

  return path;
}

export function normalizeTextPointForOffset(
  doc: JSONContent,
  point: EditorSelectionPoint,
): EditorSelectionPoint {
  const textPath = normalizeTextPath(doc, point.path);
  const text = getTextAtPath(doc, textPath);
  if (comparePaths(textPath, point.path) === 0 && point.offset <= text.length) {
    return { path: textPath, offset: point.offset };
  }

  const blockPath = currentTextBlockPath(doc, point.path);
  const block = blockPath === undefined ? undefined : getNodeAtPath(doc, blockPath);
  if (blockPath === undefined || !isTextBlock(block ?? { type: "" })) {
    return { path: textPath, offset: clampOffset(point.offset, text) };
  }

  let remainingOffset = Math.max(0, point.offset);
  const textChildren = block?.content ?? [];
  for (const [index, child] of textChildren.entries()) {
    if (child.type !== "text") continue;

    const childText = child.text ?? "";
    if (remainingOffset <= childText.length) {
      return { path: [...blockPath, index], offset: remainingOffset };
    }
    remainingOffset -= childText.length;
  }

  for (let index = textChildren.length - 1; index >= 0; index -= 1) {
    const child = textChildren[index];
    if (child?.type === "text") {
      return { path: [...blockPath, index], offset: (child.text ?? "").length };
    }
  }

  return { path: textPath, offset: text.length };
}

export function firstTextPath(node: JSONContent, path: string): string {
  const textIndex = node.content?.findIndex((child) => child.type === "text") ?? -1;
  return textIndex >= 0 ? `${path}.${textIndex}` : `${path}.0`;
}

export function selectionAtEndOfInsertedContent(
  content: JSONContent[],
  firstInsertedPath: number[],
): EditorSelection {
  const lastIndex = content.length - 1;
  const lastText = lastTextPathInNode(content[lastIndex], [
    ...firstInsertedPath.slice(0, -1),
    (firstInsertedPath.at(-1) ?? 0) + lastIndex,
  ]);
  if (lastText === undefined) return { path: firstInsertedPath, offset: 0 };

  return { path: lastText.path, offset: lastText.offset };
}

export function lastTextPathInNode(
  node: JSONContent | undefined,
  path: number[],
): EditorSelectionPoint | undefined {
  if (node?.type === "text") return { path, offset: (node.text ?? "").length };

  const content = node?.content ?? [];
  for (let index = content.length - 1; index >= 0; index -= 1) {
    const point = lastTextPathInNode(content[index], [...path, index]);
    if (point !== undefined) return point;
  }

  return undefined;
}

export function firstTextSelectionInNode(
  node: JSONContent | undefined,
  path: number[],
): EditorSelection {
  return firstTextPathInNode(node, path) ?? { path, offset: 0 };
}

export function firstTextPathInNode(
  node: JSONContent | undefined,
  path: number[],
): EditorSelectionPoint | undefined {
  if (node?.type === "text") return { path, offset: 0 };

  for (const [index, child] of (node?.content ?? []).entries()) {
    const point = firstTextPathInNode(child, [...path, index]);
    if (point !== undefined) return point;
  }

  return undefined;
}

export function nearestTextSelection(doc: JSONContent, deletedPath: number[]): EditorSelection {
  return (
    firstTextPathInNode(doc.content?.[deletedPath[0] ?? 0], [deletedPath[0] ?? 0]) ??
    firstTextPathInNode(doc, []) ?? { path: [0, 0], offset: 0 }
  );
}

export function hasTextContent(node: JSONContent): boolean {
  if (node.type === "text") return (node.text ?? "").length > 0;
  return (node.content ?? []).some(hasTextContent);
}

export function createTextParagraph(text: string, marks?: JSONContent["marks"]): JSONContent {
  return { type: "paragraph", content: [createTextNode(text, marks)] };
}

export function createTextBlockFromContent(
  source: JSONContent,
  content: JSONContent[],
): JSONContent {
  return {
    type: source.type,
    ...(source.attrs === undefined
      ? {}
      : { attrs: JSON.parse(JSON.stringify(source.attrs)) as Record<string, unknown> }),
    content: content.length === 0 ? [{ type: "text", text: "" }] : content,
  };
}

export function textNodeSegment(node: JSONContent, from: number, to: number): JSONContent[] {
  const text = node.text ?? "";
  const segment = text.slice(from, to);
  return segment.length === 0 ? [] : [createTextNode(segment, node.marks)];
}

export function createTextNode(text: string, marks: JSONContent["marks"]): JSONContent {
  return {
    type: "text",
    text,
    ...(marks === undefined || marks.length === 0
      ? {}
      : { marks: JSON.parse(JSON.stringify(marks)) as JSONContent["marks"] }),
  };
}

export function sanitizeTiptapJson(doc: JSONContent): JSONContent {
  return stripInvalidProseMirrorJson(doc) ?? { type: "doc" };
}

export function normalizeTiptapJson(doc: JSONContent): JSONContent {
  if (doc.type === "text") return cloneJsonContent(doc);

  const content = doc.content?.map(normalizeTiptapJson) ?? [];
  const next: JSONContent = {
    type: doc.type,
    ...(doc.attrs === undefined ? {} : { attrs: cloneRecord(doc.attrs) }),
    ...(doc.marks === undefined ? {} : { marks: cloneJsonArray(doc.marks) }),
  };

  if (content.length > 0) {
    next.content = content;
  } else if (doc.type === "paragraph" || doc.type === "heading") {
    next.content = [createTextNode("", undefined)];
  }

  return next;
}

function stripInvalidProseMirrorJson(node: JSONContent): JSONContent | undefined {
  if (node.type === "text" && (node.text ?? "").length === 0) return undefined;

  const content = (node.content ?? [])
    .map(stripInvalidProseMirrorJson)
    .filter((child): child is JSONContent => child !== undefined);
  const next: JSONContent = {
    type: node.type,
    ...(node.text === undefined ? {} : { text: node.text }),
    ...(node.attrs === undefined ? {} : { attrs: cloneRecord(node.attrs) }),
    ...(node.marks === undefined ? {} : { marks: cloneJsonArray(node.marks) }),
  };

  if (content.length > 0) next.content = content;

  return next;
}

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

function cloneJsonArray<T>(value: T[]): T[] {
  return JSON.parse(JSON.stringify(value)) as T[];
}

export function cloneJsonContent(doc: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(doc)) as JSONContent;
}

export function clampOffset(offset: number, text: string) {
  return Math.max(0, Math.min(offset, text.length));
}
