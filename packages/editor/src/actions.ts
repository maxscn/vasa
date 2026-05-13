import { type JSONContent, type EditorSelection, type EditorSelectionPoint } from "./model.ts";
import { deleteLeft, deleteRange, deleteRight } from "./primitives.ts";
import { getSelectedText, getTextAtPath } from "./selection.ts";
import { deleteBackward, deleteForward } from "./transforms.ts";
import { isWordSeparator } from "./word.ts";

export type EditorTextLine = {
  path: number[];
  start: number;
  text: string;
};

export type EditorDeleteGranularity = "character" | "word" | "line";

export type EditorDeleteDirection = "backward" | "forward";

export function createSelection(
  focus: EditorSelectionPoint,
  anchor: EditorSelectionPoint | undefined,
): EditorSelection {
  if (
    anchor === undefined ||
    (compareSelectionPaths(anchor.path, focus.path) === 0 && anchor.offset === focus.offset)
  ) {
    return { path: focus.path, offset: focus.offset };
  }

  return { path: focus.path, offset: focus.offset, anchor };
}

export function extendSelection(
  currentSelection: EditorSelection,
  focus: EditorSelectionPoint,
  shouldExtend: boolean,
): EditorSelection {
  if (!shouldExtend) return { path: focus.path, offset: focus.offset };
  return createSelection(focus, currentSelection.anchor ?? currentSelection);
}

export function selectWordAtPoint(doc: JSONContent, point: EditorSelectionPoint): EditorSelection {
  const range = wordRangeAtPoint(doc, point);
  return range === undefined ? point : createSelection(range.end, range.start);
}

export function selectLineAtPoint(
  point: EditorSelectionPoint,
  line: EditorTextLine | undefined,
): EditorSelection {
  if (line === undefined) return point;

  return createSelection(
    { path: line.path, offset: line.start + line.text.length },
    { path: line.path, offset: line.start },
  );
}

export function selectAllDocument(doc: JSONContent): EditorSelection {
  return createSelection(lastTextPoint(doc), firstTextPoint(doc));
}

export function deleteByGranularity(
  doc: JSONContent,
  selection: EditorSelection,
  options: {
    direction: EditorDeleteDirection;
    granularity: EditorDeleteGranularity;
    line?: EditorTextLine | undefined;
  },
): { doc: JSONContent; selection: EditorSelection } {
  if (isSelectionExpanded(selection)) return deleteBackward(doc, selection);

  if (options.granularity === "line") {
    return deleteLineContents(doc, selection, options.line);
  }

  if (options.granularity === "word") {
    return deleteAdjacentWord(doc, selection, options.direction);
  }

  return options.direction === "backward"
    ? deleteBackward(doc, selection)
    : deleteForward(doc, selection);
}

export function trimTrailingInlineWhitespaceSelection(
  doc: JSONContent,
  selection: EditorSelection,
): EditorSelection {
  const selectedText = getSelectedText(doc, selection);
  const trailingInlineWhitespace = selectedText.match(/[ \t]+$/)?.[0].length ?? 0;
  if (trailingInlineWhitespace === 0 || trailingInlineWhitespace === selectedText.length) {
    return selection;
  }

  const focus = cloneSelection(selection);
  const anchor =
    selection.anchor === undefined
      ? undefined
      : { path: [...selection.anchor.path], offset: selection.anchor.offset };
  if (anchor === undefined) return selection;

  const focusIsEnd = compareSelectionPoints(anchor, focus) <= 0;
  const end = focusIsEnd ? focus : anchor;
  end.offset = Math.max(0, end.offset - trailingInlineWhitespace);

  return focusIsEnd ? focus : { ...focus, anchor };
}

export function isSelectionExpanded(selection: EditorSelection) {
  return (
    selection.anchor !== undefined &&
    (compareSelectionPaths(selection.anchor.path, selection.path) !== 0 ||
      selection.anchor.offset !== selection.offset)
  );
}

export function compareSelectionPoints(left: EditorSelectionPoint, right: EditorSelectionPoint) {
  const pathComparison = compareSelectionPaths(left.path, right.path);
  if (pathComparison !== 0) return pathComparison;
  return left.offset - right.offset;
}

export function compareSelectionPaths(left: number[], right: number[]) {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const comparison = (left[index] ?? -1) - (right[index] ?? -1);
    if (comparison !== 0) return comparison;
  }

  return 0;
}

function deleteLineContents(
  doc: JSONContent,
  selection: EditorSelection,
  line: EditorTextLine | undefined,
) {
  if (line === undefined || line.text.length === 0) return { doc, selection };

  const result = deleteRange(doc, line.path, line.start, line.start + line.text.length);
  return { doc: result.doc, selection: result.point };
}

function deleteAdjacentWord(
  doc: JSONContent,
  selection: EditorSelection,
  direction: EditorDeleteDirection,
) {
  const text = getTextAtPath(doc, selection.path);
  const offset = Math.max(0, Math.min(selection.offset, text.length));
  const range =
    direction === "backward"
      ? previousWordRange(selection.path, text, offset)
      : nextWordRange(selection.path, text, offset);

  if (range === undefined) {
    return direction === "backward"
      ? deleteBackward(doc, selection)
      : deleteForward(doc, selection);
  }

  const result =
    direction === "backward"
      ? deleteLeft(doc, range.end.path, range.end.offset, range.start.offset)
      : deleteRight(doc, range.start.path, range.start.offset, range.end.offset);
  return { doc: result.doc, selection: result.point };
}

function previousWordRange(path: number[], text: string, offset: number) {
  if (offset <= 0) return undefined;

  if (!isWordSeparator(text[offset])) {
    return wordRangeContainingOffset(path, text, offset);
  }

  let start = offset;
  while (start > 0 && isWordSeparator(text[start - 1])) start -= 1;
  while (start > 0 && !isWordSeparator(text[start - 1])) start -= 1;

  return start === offset ? undefined : { start: { path, offset: start }, end: { path, offset } };
}

function nextWordRange(path: number[], text: string, offset: number) {
  if (offset >= text.length) return undefined;

  let start = offset;
  while (start < text.length && isWordSeparator(text[start])) start += 1;
  while (start > 0 && !isWordSeparator(text[start - 1])) start -= 1;

  let end = Math.max(start, offset);
  while (end < text.length && isWordSeparator(text[end])) end += 1;
  while (end < text.length && !isWordSeparator(text[end])) end += 1;

  return end === start ? undefined : { start: { path, offset: start }, end: { path, offset: end } };
}

function wordRangeAtPoint(doc: JSONContent, point: EditorSelectionPoint) {
  const text = getTextAtPath(doc, point.path);
  if (text.length === 0) return undefined;

  let offset = Math.max(0, Math.min(point.offset, text.length));
  if (offset === text.length || isWordSeparator(text[offset])) {
    offset -= 1;
  }

  if (offset < 0 || isWordSeparator(text[offset])) return undefined;

  return wordRangeContainingOffset(point.path, text, offset);
}

function wordRangeContainingOffset(path: number[], text: string, offset: number) {
  let start = offset;
  while (start > 0 && !isWordSeparator(text[start - 1])) start -= 1;

  let end = offset + 1;
  while (end < text.length && !isWordSeparator(text[end])) end += 1;

  return {
    start: { path, offset: start },
    end: { path, offset: end },
  };
}

function firstTextPoint(doc: JSONContent): EditorSelectionPoint {
  return firstTextPath(doc) ?? { path: [0, 0], offset: 0 };
}

function lastTextPoint(doc: JSONContent): EditorSelectionPoint {
  const path = lastTextPath(doc) ?? [0, 0];
  return { path, offset: getTextAtPath(doc, path).length };
}

function firstTextPath(
  node: JSONContent | undefined,
  path: number[] = [],
): EditorSelectionPoint | undefined {
  if (node?.type === "text") return { path, offset: 0 };

  for (const [index, child] of (node?.content ?? []).entries()) {
    const point = firstTextPath(child, [...path, index]);
    if (point !== undefined) return point;
  }

  return undefined;
}

function lastTextPath(node: JSONContent | undefined, path: number[] = []): number[] | undefined {
  if (node?.type === "text") return path;

  const content = node?.content ?? [];
  for (let index = content.length - 1; index >= 0; index -= 1) {
    const textPath = lastTextPath(content[index], [...path, index]);
    if (textPath !== undefined) return textPath;
  }

  return undefined;
}

function cloneSelection(selection: EditorSelection): EditorSelection {
  return {
    path: [...selection.path],
    offset: selection.offset,
    ...(selection.anchor === undefined
      ? {}
      : { anchor: { path: [...selection.anchor.path], offset: selection.anchor.offset } }),
  };
}
