import {
  clampOffset,
  comparePaths,
  comparePoints,
  createTextNode,
  getNodeAtPath,
  isPointInsideBlock,
  isSelectionExpanded,
  isTextBlock,
  normalizeSelectionRange,
  type JSONContent,
  type EditorSelection,
  type EditorSelectionPoint,
} from "./model.ts";

export function getTextAtPath(doc: JSONContent, path: number[]): string {
  const node = getNodeAtPath(doc, path);
  if (node?.type === "text") return node.text ?? "";
  return "";
}

export function getSelectedText(doc: JSONContent, selection: EditorSelection): string {
  if (!isSelectionExpanded(selection)) return "";

  const range = normalizeSelectionRange(doc, selection);
  const blocks = collectTextBlocksInRange(doc, range);
  return blocks.map(({ path }) => getTextBlockTextInRange(doc, path, range)).join("\n\n");
}

export function getSelectedContent(
  doc: JSONContent,
  selection: EditorSelection,
): JSONContent | undefined {
  if (!isSelectionExpanded(selection)) return undefined;

  const range = normalizeSelectionRange(doc, selection);
  const content = (doc.content ?? [])
    .map((node, index) => cloneSelectedNode(node, [index], range))
    .filter((node): node is JSONContent => node !== undefined);

  return content.length === 0 ? undefined : { type: "doc", content };
}

function collectTextBlocksInRange(
  node: JSONContent,
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
  path: number[] = [],
): Array<{ path: number[] }> {
  const blocks: Array<{ path: number[] }> = [];

  if (isTextBlock(node) && textBlockIntersectsRange(node, path, range)) {
    blocks.push({ path });
  }

  for (const [index, child] of (node.content ?? []).entries()) {
    blocks.push(...collectTextBlocksInRange(child, range, [...path, index]));
  }

  return blocks;
}

function getTextBlockTextInRange(
  doc: JSONContent,
  blockPath: number[],
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
) {
  const block = getNodeAtPath(doc, blockPath);
  const textNodes = block?.content ?? [];
  const start = isPointInsideBlock(range.start, blockPath) ? range.start : undefined;
  const end = isPointInsideBlock(range.end, blockPath) ? range.end : undefined;
  const startTextIndex = start?.path[blockPath.length] ?? 0;
  const endTextIndex = end?.path[blockPath.length] ?? textNodes.length - 1;
  const parts: string[] = [];

  for (let index = startTextIndex; index <= endTextIndex; index += 1) {
    const node = textNodes[index];
    if (node?.type !== "text") continue;

    const text = node.text ?? "";
    const startOffset = index === startTextIndex ? (start?.offset ?? 0) : 0;
    const endOffset = index === endTextIndex ? (end?.offset ?? text.length) : text.length;
    parts.push(text.slice(clampOffset(startOffset, text), clampOffset(endOffset, text)));
  }

  return parts.join("");
}

function textBlockIntersectsRange(
  block: JSONContent,
  blockPath: number[],
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
) {
  const firstPoint = firstTextPointInBlock(block, blockPath);
  const lastPoint = lastTextPointInBlock(block, blockPath);
  if (firstPoint === undefined || lastPoint === undefined) return false;

  return comparePoints(lastPoint, range.start) >= 0 && comparePoints(firstPoint, range.end) <= 0;
}

function firstTextPointInBlock(
  block: JSONContent,
  blockPath: number[],
): EditorSelectionPoint | undefined {
  const textIndex = block.content?.findIndex((child) => child.type === "text") ?? -1;
  return textIndex < 0 ? undefined : { path: [...blockPath, textIndex], offset: 0 };
}

function lastTextPointInBlock(
  block: JSONContent,
  blockPath: number[],
): EditorSelectionPoint | undefined {
  const content = block.content ?? [];

  for (let index = content.length - 1; index >= 0; index -= 1) {
    const child = content[index];
    if (child?.type === "text") {
      return { path: [...blockPath, index], offset: (child.text ?? "").length };
    }
  }

  return undefined;
}

function cloneSelectedNode(
  node: JSONContent,
  path: number[],
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
): JSONContent | undefined {
  if (node.type === "text") {
    const text = node.text ?? "";
    const nodeStart = { path, offset: 0 };
    const nodeEnd = { path, offset: text.length };
    if (comparePoints(nodeEnd, range.start) <= 0 || comparePoints(nodeStart, range.end) >= 0) {
      return undefined;
    }

    const startOffset = comparePaths(path, range.start.path) === 0 ? range.start.offset : 0;
    const endOffset = comparePaths(path, range.end.path) === 0 ? range.end.offset : text.length;
    const start = clampOffset(startOffset, text);
    const end = clampOffset(endOffset, text);
    if (end <= start) return undefined;
    return createTextNode(text.slice(start, end), node.marks);
  }

  const content = (node.content ?? [])
    .map((child, index) => cloneSelectedNode(child, [...path, index], range))
    .filter((child): child is JSONContent => child !== undefined);
  if (content.length === 0) return undefined;

  return {
    type: node.type,
    ...(node.attrs === undefined
      ? {}
      : { attrs: JSON.parse(JSON.stringify(node.attrs)) as Record<string, unknown> }),
    content,
  };
}
