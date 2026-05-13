import type { LayoutTextGrid, Rect } from "@skriva/layout";
import { isMarkActive, type EditorMarkSpec } from "./font-attributes.ts";
import {
  getNodeAtPath,
  isSelectionExpanded,
  type JSONContent,
  type EditorSelection,
  type EditorSelectionPoint,
} from "./model.ts";
import { getTextAtPath } from "./selection.ts";
import { moveSelection } from "./transforms.ts";
import { tablePositionForPath } from "./table-transforms.ts";
import { type EditorTextLine } from "./actions.ts";
import { isWordSeparator } from "./word.ts";

export type EditorRenderLineDocument = {
  pages: Array<{
    index: number;
    nodes: EditorRenderLineNode[];
  }>;
};

export type EditorRenderLineNode = EditorRenderTextNode | EditorRenderParentNode;

export type EditorRenderTextFragment = {
  sourceId?: string;
  sourceText?: string;
  text: string;
  start?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  font?: string;
};

export type EditorRenderTextNode = {
  kind: "text";
  text: string;
  sourceId?: string;
  lines: EditorRenderTextFragment[];
  textGrid?: LayoutTextGrid;
  visualLines?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    fragments: EditorRenderTextFragment[];
  }>;
};

export type EditorRenderParentNode = {
  kind: string;
  sourceId?: string;
  rect?: Rect;
  children: EditorRenderLineNode[];
};

export type EditorRenderedTextLine = {
  sourceId: string;
  sourceText: string;
  text: string;
  start: number;
  font?: string;
  rect: Rect;
};

type EditorRenderedVisualLine = {
  rect: Rect;
  fragments: EditorRenderedTextLine[];
};

export type EditorRenderLineOptions = {
  pageHeight: number;
  pageGap?: number;
  minLineWidth?: number;
};

export type EditorClientPointMapping = {
  clientLeft: number;
  clientTop: number;
  clientWidth: number;
  clientHeight: number;
  surfaceWidth: number;
  surfaceHeight: number;
};

export type EditorOverlaySurface = {
  save: () => void;
  restore: () => void;
  setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  fillStyle: unknown;
};

export type EditorOverlayPaintOptions = {
  scale?: number;
  caretColor?: string;
  selectionColor?: string;
};

export function textToEditorDocument(value: string): JSONContent {
  const paragraphs = value.split(/\n{2,}/g);

  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    })),
  };
}

export function isToolbarMarkActive(
  doc: JSONContent,
  selection: EditorSelection,
  storedMarks: EditorMarkSpec[],
  type: string,
  attrs: Record<string, unknown> = {},
) {
  if (isSelectionExpanded(selection)) return isMarkActive(doc, selection, type, attrs);
  if (findMark(storedMarks, type, attrs) !== undefined) return true;

  const node = getEditorNodeAtPath(doc, selection.path);
  return findMark(node?.marks, type, attrs) !== undefined;
}

export function toggleStoredMark(storedMarks: EditorMarkSpec[], mark: EditorMarkSpec) {
  return findMark(storedMarks, mark.type, mark.attrs ?? {}) === undefined
    ? upsertStoredMark(storedMarks, mark)
    : storedMarks.filter((storedMark) => storedMark.type !== mark.type);
}

export function upsertStoredMark(storedMarks: EditorMarkSpec[], mark: EditorMarkSpec) {
  const mergedAttrs = removeEmptyAttrs({
    ...storedMarks.find((storedMark) => storedMark.type === mark.type)?.attrs,
    ...mark.attrs,
  });
  const next = storedMarks.filter((storedMark) => storedMark.type !== mark.type);

  return [
    ...next,
    Object.keys(mergedAttrs).length === 0
      ? { type: mark.type }
      : { type: mark.type, attrs: mergedAttrs },
  ];
}

export function cloneJsonContent(doc: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(doc)) as JSONContent;
}

export function cloneSelection(selection: EditorSelection): EditorSelection {
  return {
    path: [...selection.path],
    offset: selection.offset,
    ...(selection.anchor === undefined
      ? {}
      : { anchor: { path: [...selection.anchor.path], offset: selection.anchor.offset } }),
  };
}

export function areEditorDocumentsEqual(left: JSONContent, right: JSONContent) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function moveSelectionHorizontally(
  doc: JSONContent,
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  options: {
    direction: "left" | "right";
    granularity: "character" | "word" | "line";
    renderLines: EditorRenderLineOptions;
  },
): EditorSelectionPoint {
  if (options.granularity === "line") {
    return moveSelectionToLineEdge(document, selection, options.direction, options.renderLines);
  }

  if (options.granularity === "word") {
    return moveSelectionByWord(doc, selection, options.direction);
  }

  return (
    moveSelectionByRenderedCaretStop(document, selection, options.direction, options.renderLines) ??
    moveSelection(doc, selection, options.direction)
  );
}

export function moveSelectionVertically(
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  direction: "up" | "down",
  measureText: (text: string, font?: string) => number,
  options: EditorRenderLineOptions,
  doc?: JSONContent,
): EditorSelectionPoint {
  const tableMove =
    doc === undefined ? undefined : moveSelectionVerticallyInTable(doc, selection, direction);
  if (tableMove !== undefined) return tableMove;

  const lines = renderTextLines(document, options);
  const visualLines = renderVisualTextLines(document, options);
  const caret = findCaretRect(document, selection, measureText, options);
  if (lines.length === 0 || visualLines.length === 0 || caret === undefined) return selection;

  const currentLine =
    findVisualLineAtSelection(visualLines, selection, "right") ??
    visualLineAtPoint(visualLines, caret.x, caret.y);
  const lineIndex = visualLines.indexOf(currentLine);
  const nextLine = visualLines[direction === "up" ? lineIndex - 1 : lineIndex + 1];

  if (nextLine === undefined) {
    const edgeFragment =
      direction === "up" ? currentLine.fragments[0] : currentLine.fragments.at(-1);
    if (edgeFragment === undefined) return selection;
    return {
      path: sourceIdToPath(edgeFragment.sourceId),
      offset:
        direction === "up" ? edgeFragment.start : edgeFragment.start + edgeFragment.text.length,
    };
  }

  return pointInRenderLine(nearestFragmentInVisualLine(nextLine, caret.x), caret.x, measureText);
}

export function pointToEditorSelection(
  document: EditorRenderLineDocument,
  point: { x: number; y: number },
  measureText: (text: string, font?: string) => number,
  options: EditorRenderLineOptions,
): EditorSelection | undefined {
  const lines = renderTextLines(document, options);
  const blockCarets = renderBlockBoundaryCarets(document, options);
  if (lines.length === 0 && blockCarets.length === 0) return undefined;

  const nearestBlockCaret =
    blockCarets.length === 0
      ? undefined
      : blockCarets.reduce((nearest, caret) => {
          const currentDistance = distanceToRect(point.x, point.y, caret.rect);
          const nearestDistance = distanceToRect(point.x, point.y, nearest.rect);
          return currentDistance < nearestDistance ? caret : nearest;
        });
  const nearestLine = lines.length === 0 ? undefined : nearestLineToPoint(lines, point.x, point.y);

  if (nearestBlockCaret !== undefined) {
    const blockDistance = distanceToRect(point.x, point.y, nearestBlockCaret.rect);
    const lineDistance =
      nearestLine === undefined
        ? Number.POSITIVE_INFINITY
        : distanceToRect(point.x, point.y, nearestLine.rect);
    if (blockDistance < lineDistance) {
      return {
        path: sourceIdToPath(nearestBlockCaret.sourceId),
        offset: blockBoundaryOffsetAtPoint(nearestBlockCaret.nodeRect, point),
      };
    }
  }

  return nearestLine === undefined
    ? undefined
    : pointInRenderLine(nearestLine, point.x, measureText);
}

function blockBoundaryOffsetAtPoint(rect: Rect, point: { x: number; y: number }) {
  if (point.x < rect.x || point.x > rect.x + rect.width) {
    return point.x > rect.x + rect.width / 2 ? 1 : 0;
  }

  return point.y > rect.y + rect.height / 2 ? 1 : 0;
}

export function clientPointToEditorPoint(
  mapping: EditorClientPointMapping,
  clientPoint: { x: number; y: number },
) {
  return {
    x: (clientPoint.x - mapping.clientLeft) * safeScale(mapping.surfaceWidth, mapping.clientWidth),
    y: (clientPoint.y - mapping.clientTop) * safeScale(mapping.surfaceHeight, mapping.clientHeight),
  };
}

export function clientPointToEditorSelection(
  document: EditorRenderLineDocument,
  mapping: EditorClientPointMapping,
  clientPoint: { x: number; y: number },
  measureText: (text: string, font?: string) => number,
  options: EditorRenderLineOptions,
) {
  return pointToEditorSelection(
    document,
    clientPointToEditorPoint(mapping, clientPoint),
    measureText,
    options,
  );
}

export function paintEditorCaret(
  surface: EditorOverlaySurface,
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  measureText: (text: string, font?: string) => number,
  renderLines: EditorRenderLineOptions,
  options: EditorOverlayPaintOptions = {},
) {
  const caret = findCaretRect(document, selection, measureText, renderLines);
  if (caret === undefined) return;

  surface.save();
  setOverlayTransform(surface, options.scale ?? 1);
  surface.fillStyle = options.caretColor ?? "#4338ca";
  surface.fillRect(caret.x, caret.y, caret.width, caret.height);
  surface.restore();
}

export function paintEditorSelection(
  surface: EditorOverlaySurface,
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  measureText: (text: string, font?: string) => number,
  renderLines: EditorRenderLineOptions,
  options: EditorOverlayPaintOptions = {},
) {
  const rects = findSelectionRects(document, selection, measureText, renderLines);
  if (rects.length === 0) return;

  surface.save();
  setOverlayTransform(surface, options.scale ?? 1);
  surface.fillStyle = options.selectionColor ?? "rgb(79 70 229 / 0.22)";
  for (const rect of rects) {
    surface.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  surface.restore();
}

export function editorTextLineAtSelection(
  document: EditorRenderLineDocument,
  selection: EditorSelectionPoint,
  options: EditorRenderLineOptions,
): EditorTextLine | undefined {
  const line = findRenderLineAtSelection(document, selection, options);
  if (line === undefined) return undefined;

  return {
    path: sourceIdToPath(line.sourceId),
    start: line.start,
    text: line.text,
  };
}

export function findSelectionRects(
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  measureText: (text: string, font?: string) => number,
  options: EditorRenderLineOptions,
): Rect[] {
  if (selection.anchor === undefined) return [];

  const focus = normalizeDocumentPoint(document, selection, options);
  const anchor = normalizeDocumentPoint(document, selection.anchor, options);
  const range =
    comparePoints(anchor, focus) <= 0
      ? { start: anchor, end: focus }
      : { start: focus, end: anchor };

  if (comparePoints(range.start, range.end) === 0) return [];

  return renderTextLines(document, options).flatMap((line) => {
    const lineStart = { path: sourceIdToPath(line.sourceId), offset: line.start };
    const lineEnd = { path: sourceIdToPath(line.sourceId), offset: line.start + line.text.length };
    const start = maxPoint(range.start, lineStart);
    const end = minPoint(range.end, lineEnd);

    if (comparePoints(start, end) >= 0) return [];

    const startX = xForLineOffset(line, start.offset, measureText);
    const endX = xForLineOffset(line, end.offset, measureText);

    return [
      {
        x: startX,
        y: line.rect.y,
        width: Math.max(2, endX - startX),
        height: line.rect.height,
      },
    ];
  });
}

export function findCaretRect(
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  measureText: (text: string, font?: string) => number,
  options: EditorRenderLineOptions,
): Rect | undefined {
  const sourceId = pathToSourceId(selection.path);
  const textLines = renderTextLines(document, options).filter((line) => line.sourceId === sourceId);
  if (textLines.length === 0) {
    return blockBoundaryCaretRect(document, sourceId, selection.offset, options);
  }

  const text = textLines[0]?.sourceText ?? "";
  const targetOffset = Math.max(0, Math.min(selection.offset, text.length));
  const line =
    findRenderLineAtSelection(
      document,
      { path: selection.path, offset: targetOffset },
      options,
      "right",
    ) ?? textLines.at(-1);
  if (line === undefined) return undefined;

  const offsetInLine = Math.max(0, Math.min(targetOffset - line.start, line.text.length));

  return {
    x: xForLineOffset(line, line.start + offsetInLine, measureText),
    y: line.rect.y,
    width: 2,
    height: line.rect.height,
  };
}

export function findRenderLineAtSelection(
  document: EditorRenderLineDocument,
  selection: EditorSelectionPoint,
  options: EditorRenderLineOptions,
  affinity?: "left" | "right",
): EditorRenderedTextLine | undefined {
  const sourceId = pathToSourceId(selection.path);
  const lines = renderTextLines(document, options).filter((line) => line.sourceId === sourceId);
  const containingLines = lines.filter(
    (candidate) =>
      selection.offset >= candidate.start &&
      selection.offset <= candidate.start + candidate.text.length,
  );

  if (affinity === "right") {
    const startingLine = containingLines.find((candidate) => selection.offset === candidate.start);
    if (startingLine !== undefined) return startingLine;
  }

  if (affinity === "left") {
    const endingLine = containingLines
      .slice()
      .reverse()
      .find((candidate) => selection.offset === candidate.start + candidate.text.length);
    if (endingLine !== undefined) return endingLine;
  }

  return containingLines[0] ?? lines.at(-1);
}

export function renderTextLines(
  document: EditorRenderLineDocument,
  options: EditorRenderLineOptions,
) {
  return document.pages.flatMap((pageItem) =>
    pageItem.nodes.flatMap((node) => collectRenderTextLines(node, pageItem.index, options)),
  );
}

function renderVisualTextLines(
  document: EditorRenderLineDocument,
  options: EditorRenderLineOptions,
) {
  return document.pages.flatMap((pageItem) =>
    pageItem.nodes.flatMap((node) => collectRenderVisualTextLines(node, pageItem.index, options)),
  );
}

function findVisualLineAtSelection(
  lines: EditorRenderedVisualLine[],
  selection: EditorSelectionPoint,
  affinity?: "left" | "right",
) {
  const sourceId = pathToSourceId(selection.path);
  const containingLines = lines.filter((line) =>
    line.fragments.some(
      (fragment) =>
        fragment.sourceId === sourceId &&
        selection.offset >= fragment.start &&
        selection.offset <= fragment.start + fragment.text.length,
    ),
  );

  if (affinity === "right") {
    const startingLine = containingLines.find((line) =>
      line.fragments.some(
        (fragment) => fragment.sourceId === sourceId && selection.offset === fragment.start,
      ),
    );
    if (startingLine !== undefined) return startingLine;
  }

  if (affinity === "left") {
    const endingLine = containingLines
      .slice()
      .reverse()
      .find((line) =>
        line.fragments.some(
          (fragment) =>
            fragment.sourceId === sourceId &&
            selection.offset === fragment.start + fragment.text.length,
        ),
      );
    if (endingLine !== undefined) return endingLine;
  }

  return containingLines[0];
}

export function pathToSourceId(path: number[]) {
  return path.join(".");
}

export function sourceIdToPath(sourceId: string | undefined) {
  if (sourceId === undefined || sourceId.length === 0) return [0, 0];
  return sourceId.split(".").map((part) => Number.parseInt(part, 10));
}

function findMark(
  marks: EditorMarkSpec[] | undefined,
  type: string,
  attrs: Record<string, unknown> = {},
) {
  return marks
    ?.filter((mark) => mark.type === type)
    .find((mark) => objectIncludes(mark.attrs ?? {}, attrs));
}

function objectIncludes(object: Record<string, unknown>, subset: Record<string, unknown>) {
  return Object.entries(subset).every(([key, value]) => object[key] === value);
}

function removeEmptyAttrs(attrs: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(attrs).filter(([, value]) => value !== undefined && value !== null),
  );
}

function getEditorNodeAtPath(doc: JSONContent, path: number[]) {
  return path.reduce<JSONContent | undefined>((node, index) => node?.content?.[index], doc);
}

function moveSelectionByWord(
  doc: JSONContent,
  selection: EditorSelection,
  direction: "left" | "right",
): EditorSelectionPoint {
  const text = getTextAtPath(doc, selection.path);
  const offset = Math.max(0, Math.min(selection.offset, text.length));

  if (direction === "left") {
    if (offset === 0) return moveSelection(doc, selection, "left");

    let nextOffset = offset;
    while (nextOffset > 0 && isWordSeparator(text[nextOffset - 1])) nextOffset -= 1;
    while (nextOffset > 0 && !isWordSeparator(text[nextOffset - 1])) nextOffset -= 1;

    return { path: selection.path, offset: nextOffset };
  }

  if (offset === text.length) return moveSelection(doc, selection, "right");

  let nextOffset = offset;
  while (nextOffset < text.length && isWordSeparator(text[nextOffset])) nextOffset += 1;
  while (nextOffset < text.length && !isWordSeparator(text[nextOffset])) nextOffset += 1;

  return { path: selection.path, offset: nextOffset };
}

function moveSelectionVerticallyInTable(
  doc: JSONContent,
  selection: EditorSelection,
  direction: "up" | "down",
): EditorSelectionPoint | undefined {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return undefined;

  const table = getNodeAtPath(doc, position.tablePath);
  const rows = table?.content ?? [];
  const targetRowIndex = position.rowIndex + (direction === "up" ? -1 : 1);
  const targetRow = rows[targetRowIndex];
  const targetCellCount = targetRow?.content?.length ?? 0;
  if (targetCellCount === 0) return selection;

  const targetCellIndex = Math.min(position.cellIndex, targetCellCount - 1);
  const targetCellPath = [...position.tablePath, targetRowIndex, targetCellIndex];
  const targetCell = getNodeAtPath(doc, targetCellPath);
  return editablePointInNodeAtOffset(targetCell, targetCellPath, selection.offset) ?? selection;
}

function editablePointInNodeAtOffset(
  node: JSONContent | undefined,
  path: number[],
  offset: number,
): EditorSelectionPoint | undefined {
  if (node?.type === "text") {
    const text = node.text ?? "";
    return { path, offset: Math.max(0, Math.min(offset, text.length)) };
  }

  if (node?.type === "paragraph" || node?.type === "heading") {
    const textIndex = node.content?.findIndex((child) => child.type === "text") ?? -1;
    if (textIndex < 0) return { path: [...path, 0], offset: 0 };
    return editablePointInNodeAtOffset(node.content?.[textIndex], [...path, textIndex], offset);
  }

  for (const [index, child] of (node?.content ?? []).entries()) {
    const point = editablePointInNodeAtOffset(child, [...path, index], offset);
    if (point !== undefined) return point;
  }

  return undefined;
}

type RenderedCaretStop = {
  sourceId: string;
  startOffset: number;
  endOffset: number;
};

function moveSelectionByRenderedCaretStop(
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  direction: "left" | "right",
  options: EditorRenderLineOptions,
): EditorSelectionPoint | undefined {
  const stops = renderVisualTextLines(document, options).flatMap((line) =>
    line.fragments.flatMap(caretStopsForRenderedLine),
  );
  if (stops.length === 0) return undefined;

  const sourceId = pathToSourceId(selection.path);
  const index =
    direction === "left"
      ? findLeftRenderedCaretStopIndex(stops, sourceId, selection.offset)
      : findRightRenderedCaretStopIndex(stops, sourceId, selection.offset);
  const stop = index === undefined ? undefined : stops[index];
  if (stop === undefined) return undefined;
  if (
    stop.sourceId !== sourceId &&
    !areSourceIdsInSameTextParent(sourceId, stop.sourceId) &&
    !isOffsetInsideRenderedCaretStop(stop, selection.offset)
  ) {
    return undefined;
  }

  return {
    path: sourceIdToPath(stop.sourceId),
    offset: direction === "left" ? stop.startOffset : stop.endOffset,
  };
}

function areSourceIdsInSameTextParent(left: string, right: string) {
  const leftParent = sourceIdToPath(left).slice(0, -1);
  const rightParent = sourceIdToPath(right).slice(0, -1);
  return comparePaths(leftParent, rightParent) === 0;
}

function isOffsetInsideRenderedCaretStop(stop: RenderedCaretStop, offset: number) {
  return offset > stop.startOffset && offset < stop.endOffset;
}

function findLeftRenderedCaretStopIndex(
  stops: RenderedCaretStop[],
  sourceId: string,
  offset: number,
) {
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    const stop = stops[index];
    if (stop?.sourceId !== sourceId) continue;
    if (offset > stop.startOffset && offset <= stop.endOffset) return index;
    if (offset === stop.startOffset) return index - 1 >= 0 ? index - 1 : undefined;
  }

  return undefined;
}

function findRightRenderedCaretStopIndex(
  stops: RenderedCaretStop[],
  sourceId: string,
  offset: number,
) {
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    if (stop?.sourceId !== sourceId) continue;
    if (offset >= stop.startOffset && offset < stop.endOffset) return index;
    if (offset === stop.endOffset) return index + 1 < stops.length ? index + 1 : undefined;
  }

  return undefined;
}

function caretStopsForRenderedLine(line: EditorRenderedTextLine): RenderedCaretStop[] {
  const graphemes = segmentGraphemes(line.text);

  if (graphemes.length === 0) {
    return [{ sourceId: line.sourceId, startOffset: line.start, endOffset: line.start }];
  }

  return graphemes.map((grapheme) => ({
    sourceId: line.sourceId,
    startOffset: line.start + grapheme.index,
    endOffset: line.start + grapheme.index + grapheme.text.length,
  }));
}

function segmentGraphemes(text: string) {
  const Segmenter = Intl.Segmenter;
  if (Segmenter === undefined) {
    return Array.from(text).map((segment, index) => ({ text: segment, index }));
  }

  const segmenter = new Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (segment) => ({
    text: segment.segment,
    index: segment.index,
  }));
}

function moveSelectionToLineEdge(
  document: EditorRenderLineDocument,
  selection: EditorSelection,
  direction: "left" | "right",
  options: EditorRenderLineOptions,
): EditorSelectionPoint {
  const line = findRenderLineAtSelection(document, selection, options, direction);

  if (line === undefined) return selection;

  return {
    path: sourceIdToPath(line.sourceId),
    offset: direction === "left" ? line.start : line.start + line.text.length,
  };
}

function blockBoundaryCaretRect(
  document: EditorRenderLineDocument,
  sourceId: string,
  offset: number,
  options: EditorRenderLineOptions,
): Rect | undefined {
  const caret = renderBlockBoundaryCarets(document, options).find(
    (candidate) => candidate.sourceId === sourceId,
  );
  if (caret === undefined) return undefined;

  return offset <= 0 ? caret.before : caret.after;
}

function renderBlockBoundaryCarets(
  document: EditorRenderLineDocument,
  options: EditorRenderLineOptions,
): Array<{ sourceId: string; nodeRect: Rect; rect: Rect; before: Rect; after: Rect }> {
  return document.pages.flatMap((page) => {
    const yOffset = page.index * (options.pageHeight + (options.pageGap ?? 0));
    return page.nodes.flatMap((node) => collectBlockBoundaryCarets(node, yOffset));
  });
}

function collectBlockBoundaryCarets(
  node: EditorRenderLineNode,
  yOffset: number,
): Array<{ sourceId: string; nodeRect: Rect; rect: Rect; before: Rect; after: Rect }> {
  const children = "children" in node ? node.children : [];
  const childCarets = children.flatMap((child) => collectBlockBoundaryCarets(child, yOffset));
  if (isEditorRenderTextNode(node) || !isBlockBoundaryNode(node)) return childCarets;

  const nodeRect = { ...node.rect, y: node.rect.y + yOffset };
  const before = {
    x: nodeRect.x,
    y: nodeRect.y - 2,
    width: 20,
    height: 1,
  };
  const after = {
    x: nodeRect.x,
    y: nodeRect.y + nodeRect.height + 2,
    width: 20,
    height: 1,
  };

  return [
    { sourceId: node.sourceId, nodeRect, rect: expandRect(nodeRect, 6), before, after },
    ...childCarets,
  ];
}

function isBlockBoundaryNode(
  node: EditorRenderLineNode,
): node is EditorRenderParentNode & { sourceId: string; rect: Rect } {
  if (isEditorRenderTextNode(node)) return false;

  return (
    typeof node.sourceId === "string" &&
    node.sourceId.length > 0 &&
    node.rect !== undefined &&
    node.kind === "custom"
  );
}

function collectRenderTextLines(
  node: EditorRenderLineNode,
  pageIndex: number,
  options: EditorRenderLineOptions,
): EditorRenderedTextLine[] {
  if (!isEditorRenderTextNode(node)) {
    return node.children.flatMap((child) => collectRenderTextLines(child, pageIndex, options));
  }

  const starts = node.lines.some((line) => line.start !== undefined)
    ? node.lines.map((line) => line.start ?? 0)
    : lineStartOffsets(
        node.text,
        node.lines.map((line) => line.text),
      );
  const yOffset = pageIndex * (options.pageHeight + (options.pageGap ?? 0));

  return node.lines.map((line, index) => ({
    sourceId: line.sourceId ?? node.sourceId ?? "",
    sourceText: line.sourceText ?? node.text,
    text: line.text,
    start: starts[index] ?? 0,
    font: line.font,
    rect: {
      x: line.x,
      y: line.y + yOffset,
      width: Math.max(line.width, options.minLineWidth ?? 0),
      height: line.height,
    },
  }));
}

function collectRenderVisualTextLines(
  node: EditorRenderLineNode,
  pageIndex: number,
  options: EditorRenderLineOptions,
): EditorRenderedVisualLine[] {
  if (!isEditorRenderTextNode(node)) {
    return node.children.flatMap((child) =>
      collectRenderVisualTextLines(child, pageIndex, options),
    );
  }

  if (node.visualLines === undefined) {
    return collectRenderTextLines(node, pageIndex, options).map((fragment) => ({
      rect: fragment.rect,
      fragments: [fragment],
    }));
  }

  const yOffset = pageIndex * (options.pageHeight + (options.pageGap ?? 0));

  return node.visualLines.map((line) => ({
    rect: {
      x: line.x,
      y: line.y + yOffset,
      width: Math.max(line.width, options.minLineWidth ?? 0),
      height: line.height,
    },
    fragments: line.fragments.map((fragment) =>
      renderTextLineFragment(node, fragment, yOffset, options),
    ),
  }));
}

function renderTextLineFragment(
  node: EditorRenderTextNode,
  line: EditorRenderTextFragment,
  yOffset: number,
  options: EditorRenderLineOptions,
): EditorRenderedTextLine {
  return {
    sourceId: line.sourceId ?? node.sourceId ?? "",
    sourceText: line.sourceText ?? node.text,
    text: line.text,
    start: line.start ?? 0,
    font: line.font,
    rect: {
      x: line.x,
      y: line.y + yOffset,
      width: Math.max(line.width, options.minLineWidth ?? 0),
      height: line.height,
    },
  };
}

function isEditorRenderTextNode(node: EditorRenderLineNode): node is EditorRenderTextNode {
  return node.kind === "text";
}

function lineStartOffsets(text: string, lines: string[]) {
  let cursor = 0;

  return lines.map((line) => {
    const found = line.length === 0 ? cursor : text.indexOf(line, cursor);
    const start = found >= cursor ? found : cursor;
    cursor =
      found >= cursor
        ? consumeTrailingLineSeparator(text, start + line.length)
        : consumeRenderedLine(text, cursor, line);
    return start;
  });
}

function consumeRenderedLine(text: string, start: number, line: string) {
  let cursor = start;

  for (const character of line) {
    if (text[cursor] === character) {
      cursor += 1;
    }
  }

  return consumeTrailingLineSeparator(text, cursor);
}

function consumeTrailingLineSeparator(text: string, cursor: number) {
  if (text[cursor] === "\n") return cursor + 1;
  if (text[cursor] === " ") return cursor + 1;
  return cursor;
}

function pointInRenderLine(
  line: EditorRenderedTextLine,
  x: number,
  measureText: (text: string, font?: string) => number,
): EditorSelectionPoint {
  const lineOffset = offsetForLineX(line, x, measureText);

  return {
    path: sourceIdToPath(line.sourceId),
    offset: lineOffset + line.start,
  };
}

function offsetForLineX(
  line: EditorRenderedTextLine,
  x: number,
  measureText: (text: string, font?: string) => number,
) {
  const targetX = Math.max(0, x - line.rect.x);

  for (let offset = 0; offset < line.text.length; offset += 1) {
    const currentX = measureText(line.text.slice(0, offset), line.font);
    const nextX = measureText(line.text.slice(0, offset + 1), line.font);
    if (targetX <= (currentX + nextX) / 2) return offset;
  }

  return line.text.length;
}

function xForLineOffset(
  line: EditorRenderedTextLine,
  absoluteOffset: number,
  measureText: (text: string, font?: string) => number,
) {
  const offsetInLine = Math.max(0, Math.min(absoluteOffset - line.start, line.text.length));
  return line.rect.x + measureText(line.text.slice(0, offsetInLine), line.font);
}

function nearestLineToPoint(lines: EditorRenderedTextLine[], x: number, y: number) {
  return lines.reduce((nearest, line) => {
    const currentDistance = distanceToRect(x, y, line.rect);
    const nearestDistance = distanceToRect(x, y, nearest.rect);
    if (currentDistance < nearestDistance) return line;
    if (currentDistance > nearestDistance) return nearest;
    return line.rect.x > nearest.rect.x ? line : nearest;
  });
}

function visualLineAtPoint(lines: EditorRenderedVisualLine[], x: number, y: number) {
  return lines.reduce((nearest, line) => {
    const currentDistance = distanceToRect(x, y, line.rect);
    const nearestDistance = distanceToRect(x, y, nearest.rect);
    return currentDistance < nearestDistance ? line : nearest;
  });
}

function nearestFragmentInVisualLine(line: EditorRenderedVisualLine, x: number) {
  return line.fragments.reduce((nearest, fragment) => {
    const currentDistance = distanceToHorizontalRect(x, fragment.rect);
    const nearestDistance = distanceToHorizontalRect(x, nearest.rect);
    if (currentDistance < nearestDistance) return fragment;
    if (currentDistance > nearestDistance) return nearest;
    return fragment.rect.x > nearest.rect.x ? fragment : nearest;
  });
}

function normalizeDocumentPoint(
  document: EditorRenderLineDocument,
  point: EditorSelectionPoint,
  options: EditorRenderLineOptions,
): EditorSelectionPoint {
  const textLines = renderTextLines(document, options).filter(
    (line) => line.sourceId === pathToSourceId(point.path),
  );
  const textLength = textLines[0]?.sourceText.length ?? 0;

  return { path: point.path, offset: Math.max(0, Math.min(point.offset, textLength)) };
}

function minPoint(left: EditorSelectionPoint, right: EditorSelectionPoint) {
  return comparePoints(left, right) <= 0 ? left : right;
}

function maxPoint(left: EditorSelectionPoint, right: EditorSelectionPoint) {
  return comparePoints(left, right) >= 0 ? left : right;
}

function comparePoints(left: EditorSelectionPoint, right: EditorSelectionPoint) {
  const pathComparison = comparePaths(left.path, right.path);
  if (pathComparison !== 0) return pathComparison;
  return left.offset - right.offset;
}

function comparePaths(left: number[], right: number[]) {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const comparison = (left[index] ?? -1) - (right[index] ?? -1);
    if (comparison !== 0) return comparison;
  }

  return 0;
}

function distanceToRect(x: number, y: number, rect: Rect) {
  const dx = x < rect.x ? rect.x - x : Math.max(0, x - (rect.x + rect.width));
  const dy = y < rect.y ? rect.y - y : Math.max(0, y - (rect.y + rect.height));
  return dx * dx + dy * dy;
}

function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function distanceToHorizontalRect(x: number, rect: Rect) {
  if (x < rect.x) return rect.x - x;
  return Math.max(0, x - (rect.x + rect.width));
}

function safeScale(surfaceSize: number, clientSize: number) {
  return clientSize === 0 ? 1 : surfaceSize / clientSize;
}

function setOverlayTransform(surface: EditorOverlaySurface, scale: number) {
  surface.setTransform(scale, 0, 0, scale, 0, 0);
}
