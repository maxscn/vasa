import { deleteSelectionRange } from "./transforms.ts";
import {
  clampOffset,
  cloneJsonContent,
  createTextBlockFromContent,
  currentTextBlockPath,
  getNodeAtPath,
  hasTextContent,
  isSelectionExpanded,
  isTextBlock,
  normalizeSelectionRange,
  normalizeTextPath,
  normalizeTextPointForOffset,
  selectionAtEndOfInsertedContent,
  textNodeSegment,
  type JSONContent,
  type EditorSelection,
} from "./model.ts";
import { getTextAtPath } from "./selection.ts";

export function insertEditorContent(
  doc: JSONContent,
  selection: EditorSelection,
  fragment: JSONContent,
): { doc: JSONContent; selection: EditorSelection } {
  const content = editorContentFromFragment(fragment);
  if (content.length === 0) return { doc, selection };

  if (isSelectionExpanded(selection)) {
    const range = normalizeSelectionRange(doc, selection);
    const startText = getTextAtPath(doc, range.start.path);
    const endText = getTextAtPath(doc, range.end.path);
    if (range.start.offset === 0 && range.end.offset === endText.length) {
      const nextDoc = cloneJsonContent(doc);
      const startIndex = range.start.path[0] ?? 0;
      const endIndex = range.end.path[0] ?? startIndex;
      nextDoc.content = [...(nextDoc.content ?? [])];
      nextDoc.content.splice(
        startIndex,
        endIndex - startIndex + 1,
        ...content.map(cloneJsonContent),
      );

      return {
        doc: nextDoc,
        selection: selectionAtEndOfInsertedContent(content, [startIndex]),
      };
    }

    if (range.start.offset === 0 && range.end.offset === 0 && startText.length === 0) {
      const nextDoc = cloneJsonContent(doc);
      const startIndex = range.start.path[0] ?? 0;
      nextDoc.content = [...(nextDoc.content ?? [])];
      nextDoc.content.splice(startIndex, 1, ...content.map(cloneJsonContent));

      return {
        doc: nextDoc,
        selection: selectionAtEndOfInsertedContent(content, [startIndex]),
      };
    }
  }

  const deleted = deleteSelectionRange(doc, selection);
  return insertContentAtPoint(deleted.doc, deleted.selection, content);
}

export function editorContentFromFragment(fragment: JSONContent): JSONContent[] {
  const content = fragment.type === "doc" ? (fragment.content ?? []) : [fragment];
  return content.map(cloneJsonContent).filter(hasTextContent);
}

function insertContentAtPoint(
  doc: JSONContent,
  selection: EditorSelection,
  content: JSONContent[],
): { doc: JSONContent; selection: EditorSelection } {
  const inlineContent = inlineContentForInlinePaste(content);
  if (inlineContent !== undefined) {
    return insertInlineContentAtPoint(doc, selection, inlineContent);
  }

  const blockPath = currentTextBlockPath(doc, selection.path);
  if (blockPath === undefined) {
    const nextDoc = cloneJsonContent(doc);
    nextDoc.content = [...(nextDoc.content ?? []), ...content.map(cloneJsonContent)];
    return {
      doc: nextDoc,
      selection: selectionAtEndOfInsertedContent(content, [
        (nextDoc.content?.length ?? 0) - content.length,
      ]),
    };
  }

  const textPath = normalizeTextPath(doc, selection.path);
  const block = getNodeAtPath(doc, blockPath);
  const textNode = getNodeAtPath(doc, textPath);
  if (
    block === undefined ||
    block.content === undefined ||
    textNode?.type !== "text" ||
    !isTextBlock(block)
  ) {
    return { doc, selection };
  }

  const textIndex = textPath.at(-1) ?? 0;
  const text = textNode.text ?? "";
  const offset = clampOffset(selection.offset, text);
  const parentPath = blockPath.slice(0, -1);
  const blockIndex = blockPath.at(-1) ?? 0;
  const nextDoc = cloneJsonContent(doc);
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  if (nextParent?.content === undefined) return { doc, selection };

  const leftContent = [
    ...block.content.slice(0, textIndex).map(cloneJsonContent),
    ...textNodeSegment(textNode, 0, offset),
  ];
  const rightContent = [
    ...textNodeSegment(textNode, offset, text.length),
    ...block.content.slice(textIndex + 1).map(cloneJsonContent),
  ];
  const replacement = [
    ...textBlockFromNonEmptyContent(block, leftContent),
    ...content.map(cloneJsonContent),
    ...textBlockFromNonEmptyContent(block, rightContent),
  ];

  nextParent.content.splice(blockIndex, 1, ...replacement);

  return {
    doc: nextDoc,
    selection: selectionAtEndOfInsertedContent(content, [
      ...parentPath,
      blockIndex + (leftContent.length > 0 ? 1 : 0),
    ]),
  };
}

function insertInlineContentAtPoint(
  doc: JSONContent,
  selection: EditorSelection,
  content: JSONContent[],
): { doc: JSONContent; selection: EditorSelection } {
  const point = normalizeTextPointForOffset(doc, selection);
  const textPath = point.path;
  const blockPath = currentTextBlockPath(doc, textPath);
  const block = blockPath === undefined ? undefined : getNodeAtPath(doc, blockPath);
  const textNode = getNodeAtPath(doc, textPath);
  if (
    blockPath === undefined ||
    block?.content === undefined ||
    textNode?.type !== "text" ||
    !isTextBlock(block)
  ) {
    return { doc, selection };
  }

  const textIndex = textPath.at(-1) ?? 0;
  const text = textNode.text ?? "";
  const offset = clampOffset(point.offset, text);
  const nextDoc = cloneJsonContent(doc);
  const nextBlock = getNodeAtPath(nextDoc, blockPath);
  if (nextBlock?.content === undefined) return { doc, selection };

  const leftContent = [
    ...block.content.slice(0, textIndex).map(cloneJsonContent),
    ...textNodeSegment(textNode, 0, offset),
  ];
  const rightContent = [
    ...textNodeSegment(textNode, offset, text.length),
    ...block.content.slice(textIndex + 1).map(cloneJsonContent),
  ];
  const insertedIndex = leftContent.length;
  const merged = mergeTextNodesWithPoint(
    [...leftContent, ...content.map(cloneJsonContent), ...rightContent],
    insertedIndex + content.length - 1,
    getTextAtPath({ type: "doc", content }, [content.length - 1]),
  );

  nextBlock.content = merged.content;

  return {
    doc: nextDoc,
    selection: { path: [...blockPath, merged.pointIndex], offset: merged.offset },
  };
}

function inlineContentForInlinePaste(content: JSONContent[]) {
  if (content.length !== 1) return undefined;

  const block = content[0];
  if (!isTextBlock(block)) return undefined;

  const textContent = block.content ?? [];
  if (
    textContent[0]?.type === "text" &&
    ((textContent[0].text ?? "").startsWith("\n") || (textContent[0].text ?? "").length === 0)
  ) {
    return undefined;
  }

  return textContent.every((child) => child.type === "text")
    ? textContent.map(cloneJsonContent)
    : undefined;
}

function mergeTextNodesWithPoint(
  content: JSONContent[],
  targetIndex: number,
  targetOffset: string,
) {
  const merged: JSONContent[] = [];
  let pointIndex = 0;
  let offset = targetOffset.length;

  for (const [index, node] of content.entries()) {
    const previous = merged.at(-1);
    if (
      previous?.type === "text" &&
      node.type === "text" &&
      sameMarks(previous.marks, node.marks)
    ) {
      const previousLength = previous.text?.length ?? 0;
      previous.text = `${previous.text ?? ""}${node.text ?? ""}`;
      if (index === targetIndex) {
        pointIndex = merged.length - 1;
        offset = previousLength + targetOffset.length;
      }
      continue;
    }

    merged.push(cloneJsonContent(node));
    if (index === targetIndex) {
      pointIndex = merged.length - 1;
      offset = targetOffset.length;
    }
  }

  return { content: merged, pointIndex, offset };
}

function sameMarks(left: JSONContent["marks"], right: JSONContent["marks"]) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function textBlockFromNonEmptyContent(block: JSONContent, content: JSONContent[]) {
  return hasTextContent({ type: block.type, content })
    ? [createTextBlockFromContent(block, content)]
    : [];
}
