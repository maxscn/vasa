import type { JSONContent, EditorSelectionPoint } from "./model.ts";

export type EditorTextPrimitiveResult = {
  doc: JSONContent;
  point: EditorSelectionPoint;
};

export function insertAt(
  doc: JSONContent,
  path: number[],
  word: string,
  from: number,
): EditorTextPrimitiveResult {
  const textPath = normalizeTextPath(doc, path);
  const text = getTextAtPath(doc, textPath);
  const offset = clampOffset(from, text);

  return replaceTextRange(doc, textPath, offset, offset, word);
}

export function deleteLeft(
  doc: JSONContent,
  path: number[],
  from: number,
  to = from - 1,
): EditorTextPrimitiveResult {
  const textPath = normalizeTextPath(doc, path);
  const text = getTextAtPath(doc, textPath);
  const end = clampOffset(from, text);
  const start = clampOffset(to, text);

  return replaceTextRange(doc, textPath, Math.min(start, end), Math.max(start, end), "");
}

export function deleteRight(
  doc: JSONContent,
  path: number[],
  from: number,
  to = from + 1,
): EditorTextPrimitiveResult {
  const textPath = normalizeTextPath(doc, path);
  const text = getTextAtPath(doc, textPath);
  const start = clampOffset(from, text);
  const end = clampOffset(to, text);

  return replaceTextRange(doc, textPath, Math.min(start, end), Math.max(start, end), "");
}

export function deleteRange(
  doc: JSONContent,
  path: number[],
  from: number,
  to: number,
): EditorTextPrimitiveResult {
  const textPath = normalizeTextPath(doc, path);
  const text = getTextAtPath(doc, textPath);
  const start = clampOffset(from, text);
  const end = clampOffset(to, text);

  return replaceTextRange(doc, textPath, Math.min(start, end), Math.max(start, end), "");
}

function replaceTextRange(
  doc: JSONContent,
  path: number[],
  from: number,
  to: number,
  value: string,
): EditorTextPrimitiveResult {
  const nextDoc = cloneJsonContent(doc);
  const node = getNodeAtPath(nextDoc, path);

  if (node === undefined) {
    return { doc, point: { path, offset: from } };
  }

  const text = node.text ?? "";
  node.type = "text";
  node.text = `${text.slice(0, from)}${value}${text.slice(to)}`;
  if (node.text.length === 0) delete node.marks;

  return {
    doc: nextDoc,
    point: { path, offset: from + value.length },
  };
}

function getTextAtPath(doc: JSONContent, path: number[]): string {
  const node = getNodeAtPath(doc, path);
  if (node?.type === "text") return node.text ?? "";
  return "";
}

function getNodeAtPath(doc: JSONContent, path: number[]): JSONContent | undefined {
  let current: JSONContent | undefined = doc;

  for (const index of path) {
    current = current?.content?.[index];
  }

  return current;
}

function normalizeTextPath(doc: JSONContent, path: number[]): number[] {
  const node = getNodeAtPath(doc, path);
  if (node?.type === "text") return path;

  const paragraphIndex = path[0] ?? 0;
  const paragraph = doc.content?.[paragraphIndex];
  if (paragraph?.type === "paragraph") {
    const textIndex = paragraph.content?.findIndex((child) => child.type === "text") ?? -1;
    return [paragraphIndex, textIndex >= 0 ? textIndex : 0];
  }

  return path;
}

function cloneJsonContent(doc: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(doc)) as JSONContent;
}

function clampOffset(offset: number, text: string) {
  return Math.max(0, Math.min(offset, text.length));
}
