import { deleteLeft, deleteRight, insertAt } from "./primitives.ts";
import { type EditorMarkSpec } from "./font-attributes.ts";
import { createBlankEditorTable, tablePositionForPath } from "./table-transforms.ts";
import {
  arePointsInSameTextBlock,
  clampOffset,
  cloneJsonContent,
  collectTextPaths,
  comparePoints,
  comparePaths,
  createTextBlockFromContent,
  createTextNode,
  createTextParagraph,
  currentTextBlockPath,
  firstTextSelectionInNode,
  getNodeAtPath,
  getTextBlockText,
  isSelectionExpanded,
  isTextBlock,
  lastTextPathInNode,
  nearestTextSelection,
  nextTextPoint,
  normalizeSelectionRange,
  normalizeTextPath,
  previousTextPoint,
  textNodeSegment,
  type JSONContent,
  type EditorSelection,
} from "./model.ts";
import { getTextAtPath } from "./selection.ts";

export function insertText(
  doc: JSONContent,
  selection: EditorSelection,
  text: string,
): { doc: JSONContent; selection: EditorSelection } {
  if (text.length === 0) return { doc, selection };

  const deleted = deleteSelectionRange(doc, selection);
  const inserted = insertAt(deleted.doc, deleted.selection.path, text, deleted.selection.offset);
  return { doc: inserted.doc, selection: inserted.point };
}

export function insertTextWithMarks(
  doc: JSONContent,
  selection: EditorSelection,
  text: string,
  marks: JSONContent["marks"] = [],
): { doc: JSONContent; selection: EditorSelection } {
  if (text.length === 0) return { doc, selection };

  const deleted = deleteSelectionRange(doc, selection);
  const path = normalizeTextPath(deleted.doc, deleted.selection.path);
  const node = getNodeAtPath(deleted.doc, path);
  const parent = getNodeAtPath(deleted.doc, path.slice(0, -1));
  const textIndex = path.at(-1) ?? 0;
  const sourceText = node?.text ?? "";
  const offset = clampOffset(deleted.selection.offset, sourceText);
  if (parent?.content === undefined || node?.type !== "text")
    return insertText(doc, selection, text);

  const nextDoc = cloneJsonContent(deleted.doc);
  const nextParent = getNodeAtPath(nextDoc, path.slice(0, -1));
  const nextNode = getNodeAtPath(nextDoc, path);
  if (nextParent?.content === undefined || nextNode?.type !== "text") {
    return insertText(doc, selection, text);
  }

  const fragments = [
    createTextNode(sourceText.slice(0, offset), nextNode.marks),
    createTextNode(text, marks),
    createTextNode(sourceText.slice(offset), nextNode.marks),
  ].filter((fragment) => (fragment.text ?? "").length > 0);
  const insertedIndex = textIndex + (sourceText.slice(0, offset).length > 0 ? 1 : 0);

  nextParent.content.splice(textIndex, 1, ...fragments);

  return {
    doc: nextDoc,
    selection: { path: [...path.slice(0, -1), insertedIndex], offset: text.length },
  };
}

export function deleteBackward(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  if (isSelectionExpanded(selection)) return deleteSelectionRange(doc, selection);
  const boundaryDeleted = deleteLargeBlockBoundarySelection(doc, selection);
  if (boundaryDeleted !== undefined) return boundaryDeleted;

  const textPath = normalizeTextPath(doc, selection.path);
  const text = getTextAtPath(doc, textPath);
  const offset = clampOffset(selection.offset, text);
  if (offset > 0 && isLargeBlockLandingText(text)) {
    const deleted = deleteAdjacentLargeBlockLanding(doc, textPath, "previous");
    if (deleted !== undefined) return deleted;
  }

  if (offset === 0) return joinWithPreviousParagraph(doc, textPath);

  const deleted = deleteLeft(doc, textPath, selection.offset);
  return { doc: deleted.doc, selection: deleted.point };
}

export function deleteForward(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  if (isSelectionExpanded(selection)) return deleteSelectionRange(doc, selection);
  const boundaryDeleted = deleteLargeBlockBoundarySelection(doc, selection);
  if (boundaryDeleted !== undefined) return boundaryDeleted;

  const textPath = normalizeTextPath(doc, selection.path);
  const text = getTextAtPath(doc, textPath);
  const offset = clampOffset(selection.offset, text);
  if (offset < text.length && isLargeBlockLandingText(text)) {
    const deleted = deleteAdjacentLargeBlockLanding(doc, textPath, "next");
    if (deleted !== undefined) return deleted;
  }

  if (offset === text.length) return joinWithNextParagraph(doc, textPath);

  const deleted = deleteRight(doc, textPath, offset);
  return { doc: deleted.doc, selection: deleted.point };
}

export function splitParagraph(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  const boundaryInserted = insertParagraphAtLargeBlockBoundary(doc, selection);
  if (boundaryInserted !== undefined) return boundaryInserted;

  const deleted = deleteSelectionRange(doc, selection);
  const blockPath = currentTextBlockPath(deleted.doc, deleted.selection.path);
  if (blockPath === undefined) return { doc, selection };

  const block = getNodeAtPath(deleted.doc, blockPath);
  if (block === undefined || (block.type !== "paragraph" && block.type !== "heading")) {
    return { doc, selection };
  }

  const textPath = normalizeTextPath(deleted.doc, deleted.selection.path);
  const textIndex = textPath.at(-1) ?? 0;
  const text = getTextAtPath(deleted.doc, textPath);
  const offset = clampOffset(deleted.selection.offset, text);

  if (shouldExitBlockquoteOnSplit(deleted.doc, blockPath, textPath, offset)) {
    const nextDoc = cloneJsonContent(deleted.doc);
    const topIndex = blockPath[0] ?? 0;
    const childIndex = blockPath[1] ?? 0;
    const blocks = [...(nextDoc.content ?? [])];
    const blockquote = blocks[topIndex];
    if (blockquote?.type !== "blockquote") return { doc, selection };

    blockquote.content = [...(blockquote.content ?? [])];
    blockquote.content.splice(childIndex, 1);

    const insertIndex = blockquote.content.length === 0 ? topIndex : topIndex + 1;
    blocks.splice(insertIndex, blockquote.content.length === 0 ? 1 : 0, createTextParagraph(""));
    nextDoc.content = blocks;

    return { doc: nextDoc, selection: { path: [insertIndex, 0], offset: 0 } };
  }

  const nextDoc = cloneJsonContent(deleted.doc);
  const parentPath = blockPath.slice(0, -1);
  const blockIndex = blockPath.at(-1) ?? 0;
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  const nextBlock = getNodeAtPath(nextDoc, blockPath);
  const textNode = getNodeAtPath(nextDoc, textPath);
  if (
    nextParent?.content === undefined ||
    nextBlock?.content === undefined ||
    textNode?.type !== "text"
  ) {
    return { doc, selection };
  }

  const leftContent = [
    ...nextBlock.content.slice(0, textIndex).map(cloneJsonContent),
    ...textNodeSegment(textNode, 0, offset),
  ];
  const rightContent = [
    ...textNodeSegment(textNode, offset, text.length),
    ...nextBlock.content.slice(textIndex + 1).map(cloneJsonContent),
  ];

  nextParent.content.splice(
    blockIndex,
    1,
    createTextBlockFromContent(nextBlock, leftContent),
    createTextBlockFromContent(nextBlock, rightContent),
  );

  return {
    doc: nextDoc,
    selection: { path: [...parentPath, blockIndex + 1, 0], offset: 0 },
  };
}

export function setCurrentTextBlockType(
  doc: JSONContent,
  selection: EditorSelection,
  type: "paragraph" | "heading",
  attrs: Record<string, unknown> = {},
): { doc: JSONContent; selection: EditorSelection } {
  const blockPath = currentTextBlockPath(doc, selection.path);
  if (blockPath === undefined) return { doc, selection };

  const nextDoc = cloneJsonContent(doc);
  const block = getNodeAtPath(nextDoc, blockPath);
  if (block === undefined || (block.type !== "paragraph" && block.type !== "heading")) {
    return { doc, selection };
  }

  block.type = type;
  if (type === "heading") {
    block.attrs = { ...block.attrs, ...attrs };
  } else {
    delete block.attrs;
  }

  return { doc: nextDoc, selection };
}

export function toggleCurrentBlockquote(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  const topBlock = doc.content?.[topIndex];
  if (topBlock === undefined) return { doc, selection };

  const nextDoc = cloneJsonContent(doc);
  const blocks = [...(nextDoc.content ?? [])];
  const nextTopBlock = blocks[topIndex];

  if (nextTopBlock?.type === "blockquote") {
    const unwrapped = (nextTopBlock.content ?? []).map(cloneJsonContent);
    blocks.splice(topIndex, 1, ...(unwrapped.length === 0 ? [createTextParagraph("")] : unwrapped));
    nextDoc.content = blocks;

    return {
      doc: nextDoc,
      selection: {
        path:
          selection.path[0] === topIndex && selection.path.length > 2
            ? [topIndex + (selection.path[1] ?? 0), ...selection.path.slice(2)]
            : [topIndex, 0],
        offset: selection.offset,
        ...(selection.anchor === undefined
          ? {}
          : {
              anchor: {
                path:
                  selection.anchor.path[0] === topIndex && selection.anchor.path.length > 2
                    ? [
                        topIndex + (selection.anchor.path[1] ?? 0),
                        ...selection.anchor.path.slice(2),
                      ]
                    : [topIndex, 0],
                offset: selection.anchor.offset,
              },
            }),
      },
    };
  }

  blocks.splice(topIndex, 1, {
    type: "blockquote",
    content: [cloneJsonContent(nextTopBlock)],
  });
  nextDoc.content = blocks;

  return {
    doc: nextDoc,
    selection: {
      path: [topIndex, 0, ...selection.path.slice(1)],
      offset: selection.offset,
      ...(selection.anchor === undefined
        ? {}
        : {
            anchor: {
              path: [topIndex, 0, ...selection.anchor.path.slice(1)],
              offset: selection.anchor.offset,
            },
          }),
    },
  };
}

export function insertHorizontalRuleAfterCurrentBlock(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  const nextDoc = cloneJsonContent(doc);
  const blocks = [...(nextDoc.content ?? [])];
  const insertIndex = Math.min(blocks.length, topIndex + 1);

  blocks.splice(insertIndex, 0, { type: "horizontalRule" }, createTextParagraph(""));
  nextDoc.content = blocks;

  return {
    doc: nextDoc,
    selection: { path: [insertIndex + 1, 0], offset: 0 },
  };
}

export function insertBlankTableAfterCurrentBlock(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  const nextDoc = cloneJsonContent(doc);
  const blocks = [...(nextDoc.content ?? [])];
  const insertIndex = Math.min(blocks.length, topIndex + 1);
  const table = createBlankEditorTable(4, 3);

  blocks.splice(insertIndex, 0, table);
  nextDoc.content = blocks;

  return {
    doc: nextDoc,
    selection: { path: [insertIndex, 0, 0, 0, 0], offset: 0 },
  };
}

export function insertPageSpacerAfterCurrentBlock(
  doc: JSONContent,
  selection: EditorSelection,
  height: number,
): { doc: JSONContent; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  return insertPageSpacerAtIndex(doc, Math.min((doc.content ?? []).length, topIndex + 1), height);
}

export function insertPageSpacerAtDocumentEnd(
  doc: JSONContent,
  height: number,
): { doc: JSONContent; selection: EditorSelection } {
  return insertPageSpacerAtIndex(doc, doc.content?.length ?? 0, height);
}

export function insertPageBreakAtDocumentEnd(
  doc: JSONContent,
  height: number,
  options: InsertPageBreakOptions = {},
): { doc: JSONContent; selection: EditorSelection } {
  return insertPageBreakAtIndex(doc, doc.content?.length ?? 0, height, options);
}

export type InsertPageBreakOptions = {
  fontId?: string;
};

function insertPageSpacerAtIndex(
  doc: JSONContent,
  insertIndex: number,
  height: number,
): { doc: JSONContent; selection: EditorSelection } {
  const nextDoc = cloneJsonContent(doc);
  const blocks = [...(nextDoc.content ?? [])];
  const spacerHeight = Math.max(1, Math.ceil(height));

  blocks.splice(insertIndex, 0, createPageSpacerParagraph(spacerHeight));
  nextDoc.content = blocks;

  return {
    doc: nextDoc,
    selection: { path: [insertIndex, 0], offset: 0 },
  };
}

function insertPageBreakAtIndex(
  doc: JSONContent,
  insertIndex: number,
  height: number,
  options: InsertPageBreakOptions = {},
): { doc: JSONContent; selection: EditorSelection } {
  const nextDoc = cloneJsonContent(doc);
  const blocks = [...(nextDoc.content ?? [])];
  const spacerHeight = Math.max(1, Math.ceil(height));

  blocks.splice(
    insertIndex,
    0,
    createPageSpacerParagraph(spacerHeight),
    createTextParagraph("", pageBreakTextMarks(options)),
  );
  nextDoc.content = blocks;

  return {
    doc: nextDoc,
    selection: { path: [insertIndex + 1, 0], offset: 0 },
  };
}

function pageBreakTextMarks(options: InsertPageBreakOptions): EditorMarkSpec[] | undefined {
  return options.fontId === undefined
    ? undefined
    : [{ type: "textStyle", attrs: { fontId: options.fontId } }];
}

function createPageSpacerParagraph(spacerHeight: number): JSONContent {
  return {
    type: "paragraph",
    attrs: { pageSpacerHeight: spacerHeight },
    content: [{ type: "text", text: "" }],
  };
}

export function currentTextBlockType(doc: JSONContent, selection: EditorSelection) {
  const blockPath = currentTextBlockPath(doc, selection.path);
  const block = blockPath === undefined ? undefined : getNodeAtPath(doc, blockPath);

  return {
    type: block?.type,
    attrs: block?.attrs,
    inBlockquote: doc.content?.[selection.path[0] ?? 0]?.type === "blockquote",
  };
}

export function moveSelection(
  doc: JSONContent,
  selection: EditorSelection,
  direction: "left" | "right",
): EditorSelection {
  const boundaryMove = moveLargeBlockBoundarySelection(doc, selection, direction);
  if (boundaryMove !== undefined) return boundaryMove;

  const textPath = normalizeTextPath(doc, selection.path);
  const text = getTextAtPath(doc, textPath);
  const currentOffset = clampOffset(selection.offset, text);

  if (direction === "left" && currentOffset === 0) {
    const tableMove = moveSelectionAcrossTableCells(doc, textPath, "left");
    if (tableMove !== undefined) return tableMove;

    const containingBoundary = containingLargeBlockBoundarySelection(doc, textPath, "left");
    if (containingBoundary !== undefined) return containingBoundary;

    const previousBlockPath = adjacentLargeBlockPath(doc, textPath, "previous");
    if (previousBlockPath !== undefined) return { path: previousBlockPath, offset: 1 };

    const previousPoint = previousTextPoint(doc, textPath);
    if (previousPoint === undefined) return { path: textPath, offset: currentOffset };
    if (arePointsInSameTextBlock(doc, previousPoint.path, textPath)) {
      return {
        path: previousPoint.path,
        offset: Math.max(0, previousPoint.offset - 1),
      };
    }
    return previousPoint;
  }

  if (direction === "right" && currentOffset === text.length) {
    const tableMove = moveSelectionAcrossTableCells(doc, textPath, "right");
    if (tableMove !== undefined) return tableMove;

    const containingBoundary = containingLargeBlockBoundarySelection(doc, textPath, "right");
    if (containingBoundary !== undefined) return containingBoundary;

    const nextBlockPath = adjacentLargeBlockPath(doc, textPath, "next");
    if (nextBlockPath !== undefined) return { path: nextBlockPath, offset: 0 };

    const nextPoint = nextTextPoint(doc, textPath);
    if (nextPoint === undefined) return { path: textPath, offset: currentOffset };
    if (arePointsInSameTextBlock(doc, nextPoint.path, textPath)) {
      return {
        path: nextPoint.path,
        offset: Math.min(1, getTextAtPath(doc, nextPoint.path).length),
      };
    }
    return nextPoint;
  }

  return { path: textPath, offset: direction === "left" ? currentOffset - 1 : currentOffset + 1 };
}

export function deleteSelectionRange(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  if (!isSelectionExpanded(selection)) {
    return {
      doc,
      selection: {
        path: normalizeTextPath(doc, selection.path),
        offset: selection.offset,
      },
    };
  }

  const range = normalizeSelectionRange(doc, selection);
  const nextDoc = cloneJsonContent(doc);

  if (comparePaths(range.start.path, range.end.path) === 0) {
    const node = getNodeAtPath(nextDoc, range.start.path);
    const text = node?.text ?? "";

    if (node !== undefined) {
      node.type = "text";
      node.text = `${text.slice(0, range.start.offset)}${text.slice(range.end.offset)}`;
      if (node.text.length === 0) delete node.marks;
    }

    return { doc: nextDoc, selection: range.start };
  }

  const startParagraphIndex = range.start.path[0];
  const endParagraphIndex = range.end.path[0];
  const startNode = getNodeAtPath(nextDoc, range.start.path);
  const endNode = getNodeAtPath(nextDoc, range.end.path);
  const startText = startNode?.text ?? "";
  const endText = endNode?.text ?? "";
  const paragraphs = [...(nextDoc.content ?? [])];

  paragraphs.splice(
    startParagraphIndex,
    endParagraphIndex - startParagraphIndex + 1,
    createTextParagraph(
      `${startText.slice(0, range.start.offset)}${endText.slice(range.end.offset)}`,
    ),
  );
  nextDoc.content = paragraphs;

  return { doc: nextDoc, selection: range.start };
}

function joinWithPreviousParagraph(
  doc: JSONContent,
  path: number[],
): { doc: JSONContent; selection: EditorSelection } {
  const blockPath = currentTextBlockPath(doc, path);
  if (blockPath === undefined) return { doc, selection: { path, offset: 0 } };

  const blockIndex = blockPath.at(-1) ?? 0;
  if (blockIndex <= 0) {
    const lifted = liftCurrentBlockquoteChild(doc, blockPath, path, 0);
    return lifted ?? { doc, selection: { path, offset: 0 } };
  }

  const parentPath = blockPath.slice(0, -1);
  const previousBlockPath = [...parentPath, blockIndex - 1];
  const previousBlock = getNodeAtPath(doc, previousBlockPath);
  if (previousBlock?.type === "heading") {
    const joined = joinParagraphIntoPreviousTextBlock(doc, blockPath, path, previousBlockPath);
    if (joined !== undefined) return joined;
  }

  if (previousBlock?.type === "blockquote") {
    const joined = joinParagraphIntoPreviousBlockquote(doc, blockPath, path, previousBlockPath);
    if (joined !== undefined) return joined;
  }

  if (isLargeDeletionBoundaryBlock(previousBlock)) {
    const landing = moveToLargeBlockDeletionLanding(doc, blockPath, path, "previous");
    if (landing !== undefined) return landing;
  }

  const previousPath = normalizeTextPath(doc, previousBlockPath);
  const previousText = getTextAtPath(doc, previousPath);
  const currentText = getTextAtPath(doc, path);
  const nextDoc = cloneJsonContent(doc);
  const parent = getNodeAtPath(nextDoc, parentPath);
  if (parent?.content === undefined) return { doc, selection: { path, offset: 0 } };

  parent.content.splice(blockIndex - 1, 2, createTextParagraph(`${previousText}${currentText}`));

  return { doc: nextDoc, selection: { path: previousPath, offset: previousText.length } };
}

function joinWithNextParagraph(
  doc: JSONContent,
  path: number[],
): { doc: JSONContent; selection: EditorSelection } {
  const blockPath = currentTextBlockPath(doc, path);
  if (blockPath === undefined) {
    return { doc, selection: { path, offset: getTextAtPath(doc, path).length } };
  }

  const blockIndex = blockPath.at(-1) ?? 0;
  const parentPath = blockPath.slice(0, -1);
  const parent = getNodeAtPath(doc, parentPath);
  const nextBlockIndex = blockIndex + 1;
  if (nextBlockIndex >= (parent?.content?.length ?? 0)) {
    const lifted = liftCurrentBlockquoteChild(
      doc,
      blockPath,
      path,
      getTextAtPath(doc, path).length,
    );
    return lifted ?? { doc, selection: { path, offset: getTextAtPath(doc, path).length } };
  }

  const nextBlockPath = [...parentPath, nextBlockIndex];
  const nextBlock = getNodeAtPath(doc, nextBlockPath);
  if (nextBlock?.type === "heading") {
    const joined = joinNextTextBlockIntoParagraph(doc, blockPath, path, nextBlockPath);
    if (joined !== undefined) return joined;
  }

  if (nextBlock?.type === "blockquote") {
    const joined = joinNextBlockquoteIntoParagraph(doc, blockPath, path, nextBlockPath);
    if (joined !== undefined) return joined;
  }

  if (isLargeDeletionBoundaryBlock(nextBlock)) {
    const landing = moveToLargeBlockDeletionLanding(doc, blockPath, path, "next");
    if (landing !== undefined) return landing;
  }

  const currentText = getTextAtPath(doc, path);
  const nextPath = normalizeTextPath(doc, nextBlockPath);
  const nextText = getTextAtPath(doc, nextPath);
  const nextDoc = cloneJsonContent(doc);
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  if (nextParent?.content === undefined) {
    return { doc, selection: { path, offset: currentText.length } };
  }

  nextParent.content.splice(blockIndex, 2, createTextParagraph(`${currentText}${nextText}`));

  return { doc: nextDoc, selection: { path, offset: currentText.length } };
}

function joinParagraphIntoPreviousBlockquote(
  doc: JSONContent,
  blockPath: number[],
  textPath: number[],
  blockquotePath: number[],
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const quoteEnd = lastTextPathInNode(getNodeAtPath(doc, blockquotePath), blockquotePath);
  if (quoteEnd === undefined) return undefined;

  const quoteText = getTextAtPath(doc, quoteEnd.path);
  const currentText = getTextAtPath(doc, textPath);
  const nextDoc = cloneJsonContent(doc);
  const quoteTextNode = getNodeAtPath(nextDoc, quoteEnd.path);
  const parent = getNodeAtPath(nextDoc, blockPath.slice(0, -1));
  const siblings = blockPath.length === 1 ? nextDoc.content : parent?.content;
  if (quoteTextNode?.type !== "text" || siblings === undefined) return undefined;

  quoteTextNode.text = `${quoteText}${currentText}`;
  siblings.splice(blockPath.at(-1) ?? 0, 1);

  return { doc: nextDoc, selection: { path: quoteEnd.path, offset: quoteText.length } };
}

function joinParagraphIntoPreviousTextBlock(
  doc: JSONContent,
  blockPath: number[],
  textPath: number[],
  previousBlockPath: number[],
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const previousPath = normalizeTextPath(doc, previousBlockPath);
  const previousText = getTextAtPath(doc, previousPath);
  const currentText = getTextAtPath(doc, textPath);
  const nextDoc = cloneJsonContent(doc);
  const previousTextNode = getNodeAtPath(nextDoc, previousPath);
  const parent = getNodeAtPath(nextDoc, blockPath.slice(0, -1));
  const siblings = blockPath.length === 1 ? nextDoc.content : parent?.content;
  if (previousTextNode?.type !== "text" || siblings === undefined) return undefined;

  previousTextNode.text = `${previousText}${currentText}`;
  siblings.splice(blockPath.at(-1) ?? 0, 1);

  return { doc: nextDoc, selection: { path: previousPath, offset: previousText.length } };
}

function liftCurrentBlockquoteChild(
  doc: JSONContent,
  blockPath: number[],
  textPath: number[],
  selectionOffset: number,
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const topIndex = blockPath[0] ?? 0;
  const childIndex = blockPath[1];
  const blockquote = doc.content?.[topIndex];
  if (blockquote?.type !== "blockquote" || childIndex === undefined) return undefined;

  const child = blockquote.content?.[childIndex];
  if (child === undefined) return undefined;

  const before = blockquote.content?.slice(0, childIndex) ?? [];
  const after = blockquote.content?.slice(childIndex + 1) ?? [];
  const liftedIndex = topIndex + (before.length > 0 ? 1 : 0);
  const nextDoc = cloneJsonContent(doc);
  const replacement: JSONContent[] = [
    ...(before.length > 0 ? [{ type: "blockquote", content: before.map(cloneJsonContent) }] : []),
    cloneJsonContent(child),
    ...(after.length > 0 ? [{ type: "blockquote", content: after.map(cloneJsonContent) }] : []),
  ];

  nextDoc.content = [...(nextDoc.content ?? [])];
  nextDoc.content.splice(topIndex, 1, ...replacement);

  return {
    doc: nextDoc,
    selection: { path: [liftedIndex, ...textPath.slice(2)], offset: selectionOffset },
  };
}

function joinNextTextBlockIntoParagraph(
  doc: JSONContent,
  blockPath: number[],
  textPath: number[],
  nextBlockPath: number[],
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const nextPath = normalizeTextPath(doc, nextBlockPath);
  const currentText = getTextAtPath(doc, textPath);
  const nextText = getTextAtPath(doc, nextPath);
  const nextDoc = cloneJsonContent(doc);
  const nextTextNode = getNodeAtPath(nextDoc, nextPath);
  const parent = getNodeAtPath(nextDoc, blockPath.slice(0, -1));
  const siblings = blockPath.length === 1 ? nextDoc.content : parent?.content;
  if (nextTextNode?.type !== "text" || siblings === undefined) return undefined;

  nextTextNode.text = `${currentText}${nextText}`;
  siblings.splice(blockPath.at(-1) ?? 0, 1);

  return {
    doc: nextDoc,
    selection: {
      path: [
        ...nextBlockPath.slice(0, -1),
        blockPath.at(-1) ?? 0,
        ...nextPath.slice(nextBlockPath.length),
      ],
      offset: currentText.length,
    },
  };
}

function joinNextBlockquoteIntoParagraph(
  doc: JSONContent,
  blockPath: number[],
  textPath: number[],
  blockquotePath: number[],
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const quoteStart = firstTextSelectionInNode(getNodeAtPath(doc, blockquotePath), blockquotePath);
  const quoteText = getTextAtPath(doc, quoteStart.path);
  const currentText = getTextAtPath(doc, textPath);
  const nextDoc = cloneJsonContent(doc);
  const adjustedQuotePath = [
    ...blockquotePath.slice(0, -1),
    blockPath.at(-1) ?? 0,
    ...quoteStart.path.slice(blockquotePath.length),
  ];
  const quoteTextNode = getNodeAtPath(nextDoc, quoteStart.path);
  const parent = getNodeAtPath(nextDoc, blockPath.slice(0, -1));
  const siblings = blockPath.length === 1 ? nextDoc.content : parent?.content;
  if (quoteTextNode?.type !== "text" || siblings === undefined) return undefined;

  quoteTextNode.text = `${currentText}${quoteText}`;
  siblings.splice(blockPath.at(-1) ?? 0, 1);

  return { doc: nextDoc, selection: { path: adjustedQuotePath, offset: currentText.length } };
}

function moveToLargeBlockDeletionLanding(
  doc: JSONContent,
  blockPath: number[],
  textPath: number[],
  direction: "previous" | "next",
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const text = getTextAtPath(doc, textPath);
  if (text.length !== 0) return undefined;

  const adjacentBlockPath = adjacentLargeBlockPath(doc, blockPath, direction);
  if (adjacentBlockPath === undefined) return undefined;

  return {
    doc,
    selection: { path: adjacentBlockPath, offset: direction === "previous" ? 1 : 0 },
  };
}

function deleteAdjacentLargeBlockLanding(
  doc: JSONContent,
  textPath: number[],
  direction: "previous" | "next",
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const blockPath = currentTextBlockPath(doc, textPath);
  if (blockPath === undefined) return undefined;

  const blockIndex = blockPath.at(-1) ?? 0;
  const parentPath = blockPath.slice(0, -1);
  const adjacentBlockIndex = direction === "previous" ? blockIndex - 1 : blockIndex + 1;
  if (adjacentBlockIndex < 0) return undefined;

  const adjacentBlockPath = [...parentPath, adjacentBlockIndex];
  const adjacentBlock = getNodeAtPath(doc, adjacentBlockPath);
  if (!isLargeDeletionBoundaryBlock(adjacentBlock)) return undefined;

  const nextDoc = cloneJsonContent(doc);
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  const siblings = parentPath.length === 0 ? nextDoc.content : nextParent?.content;
  if (siblings === undefined) return undefined;

  const deleteStart = Math.min(blockIndex, adjacentBlockIndex);
  const hasRemainingSiblings = siblings.length > 2;
  siblings.splice(deleteStart, 2, ...(hasRemainingSiblings ? [] : [createTextParagraph("")]));

  if (!hasRemainingSiblings) {
    return { doc: nextDoc, selection: { path: [...parentPath, deleteStart, 0], offset: 0 } };
  }

  return { doc: nextDoc, selection: nearestTextSelection(nextDoc, [...parentPath, deleteStart]) };
}

function isLargeBlockLandingText(text: string) {
  return text === " ";
}

function isLargeDeletionBoundaryBlock(node: JSONContent | undefined) {
  return node?.type === "table" || node?.type === "horizontalRule";
}

function insertParagraphAtLargeBlockBoundary(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } | undefined {
  if (isSelectionExpanded(selection)) return undefined;
  if (!isLargeDeletionBoundaryBlock(getNodeAtPath(doc, selection.path))) return undefined;

  const nextDoc = cloneJsonContent(doc);
  const parentPath = selection.path.slice(0, -1);
  const blockIndex = selection.path.at(-1) ?? 0;
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  const siblings = parentPath.length === 0 ? nextDoc.content : nextParent?.content;
  if (siblings === undefined) return undefined;

  const insertIndex = blockIndex + (selection.offset > 0 ? 1 : 0);
  siblings.splice(insertIndex, 0, createTextParagraph(""));

  return {
    doc: nextDoc,
    selection: { path: [...parentPath, insertIndex, 0], offset: 0 },
  };
}

function moveLargeBlockBoundarySelection(
  doc: JSONContent,
  selection: EditorSelection,
  direction: "left" | "right",
): EditorSelection | undefined {
  if (!isLargeDeletionBoundaryBlock(getNodeAtPath(doc, selection.path))) return undefined;

  if (direction === "left") {
    if (selection.offset > 0) return { path: selection.path, offset: 0 };
    return previousTextPoint(doc, selection.path) ?? selection;
  }

  if (selection.offset <= 0) return { path: selection.path, offset: 1 };
  return nextTextPointAfterBlock(doc, selection.path) ?? selection;
}

function nextTextPointAfterBlock(
  doc: JSONContent,
  blockPath: number[],
): EditorSelection | undefined {
  const parentPath = blockPath.slice(0, -1);
  const blockIndex = blockPath.at(-1);
  if (blockIndex === undefined) return undefined;

  const afterBlockPath = [...parentPath, blockIndex + 1];
  const nextPath = collectTextPaths(doc).find(
    (textPath) => comparePaths(textPath, afterBlockPath) >= 0,
  );
  return nextPath === undefined ? undefined : { path: nextPath, offset: 0 };
}

function deleteLargeBlockBoundarySelection(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } | undefined {
  if (!isLargeDeletionBoundaryBlock(getNodeAtPath(doc, selection.path))) return undefined;
  return deleteLargeBlockAtPath(doc, selection.path);
}

function deleteLargeBlockAtPath(
  doc: JSONContent,
  blockPath: number[],
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const nextDoc = cloneJsonContent(doc);
  const parentPath = blockPath.slice(0, -1);
  const blockIndex = blockPath.at(-1) ?? 0;
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  const siblings = parentPath.length === 0 ? nextDoc.content : nextParent?.content;
  if (siblings === undefined) return undefined;

  const hasRemainingSiblings = siblings.length > 1;
  siblings.splice(blockIndex, 1, ...(hasRemainingSiblings ? [] : [createTextParagraph("")]));

  if (!hasRemainingSiblings) {
    return { doc: nextDoc, selection: { path: [...parentPath, blockIndex, 0], offset: 0 } };
  }

  return { doc: nextDoc, selection: nearestTextSelection(nextDoc, blockPath) };
}

function adjacentLargeBlockPath(
  doc: JSONContent,
  path: number[],
  direction: "previous" | "next",
): number[] | undefined {
  const blockPath = currentTextBlockPath(doc, path) ?? path;
  const blockIndex = blockPath.at(-1) ?? 0;
  const parentPath = blockPath.slice(0, -1);
  const adjacentIndex = direction === "previous" ? blockIndex - 1 : blockIndex + 1;
  if (adjacentIndex < 0) return undefined;

  const adjacentPath = [...parentPath, adjacentIndex];
  return isLargeDeletionBoundaryBlock(getNodeAtPath(doc, adjacentPath)) ? adjacentPath : undefined;
}

function moveSelectionAcrossTableCells(
  doc: JSONContent,
  textPath: number[],
  direction: "left" | "right",
): EditorSelection | undefined {
  const position = tablePositionForPath(doc, textPath);
  if (position === undefined) return undefined;

  const table = getNodeAtPath(doc, position.tablePath);
  const rows = table?.content ?? [];
  const currentRow = rows[position.rowIndex];
  const currentCellCount = currentRow?.content?.length ?? 0;
  const nextCell =
    direction === "left"
      ? previousTableCellPath(rows, position)
      : nextTableCellPath(rows, position);

  if (nextCell !== undefined) {
    const cell = getNodeAtPath(doc, nextCell);
    return direction === "left"
      ? lastEditableSelectionInNode(cell, nextCell)
      : firstEditableSelectionInNode(cell, nextCell);
  }

  if (direction === "left" && position.rowIndex === 0 && position.cellIndex === 0) {
    return { path: position.tablePath, offset: 0 };
  }

  if (
    direction === "right" &&
    position.rowIndex === rows.length - 1 &&
    position.cellIndex === currentCellCount - 1
  ) {
    return { path: position.tablePath, offset: 1 };
  }

  return undefined;
}

function previousTableCellPath(
  rows: JSONContent[],
  position: NonNullable<ReturnType<typeof tablePositionForPath>>,
) {
  if (position.cellIndex > 0) {
    return [...position.tablePath, position.rowIndex, position.cellIndex - 1];
  }

  for (let rowIndex = position.rowIndex - 1; rowIndex >= 0; rowIndex -= 1) {
    const previousRowCellCount = rows[rowIndex]?.content?.length ?? 0;
    if (previousRowCellCount > 0) {
      return [...position.tablePath, rowIndex, previousRowCellCount - 1];
    }
  }

  return undefined;
}

function nextTableCellPath(
  rows: JSONContent[],
  position: NonNullable<ReturnType<typeof tablePositionForPath>>,
) {
  const currentCellCount = rows[position.rowIndex]?.content?.length ?? 0;
  if (position.cellIndex < currentCellCount - 1) {
    return [...position.tablePath, position.rowIndex, position.cellIndex + 1];
  }

  for (let rowIndex = position.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const nextRowCellCount = rows[rowIndex]?.content?.length ?? 0;
    if (nextRowCellCount > 0) return [...position.tablePath, rowIndex, 0];
  }

  return undefined;
}

function containingLargeBlockBoundarySelection(
  doc: JSONContent,
  textPath: number[],
  direction: "left" | "right",
): EditorSelection | undefined {
  const blockPath = containingLargeBlockPath(doc, textPath);
  if (blockPath === undefined) return undefined;

  const block = getNodeAtPath(doc, blockPath);
  const edgePoint =
    direction === "left"
      ? firstEditableSelectionInNode(block, blockPath)
      : lastEditableSelectionInNode(block, blockPath);
  if (
    edgePoint === undefined ||
    comparePoints(edgePoint, { path: textPath, offset: edgePoint.offset }) !== 0
  ) {
    return undefined;
  }

  return { path: blockPath, offset: direction === "left" ? 0 : 1 };
}

function containingLargeBlockPath(doc: JSONContent, path: number[]) {
  for (let length = path.length - 1; length > 0; length -= 1) {
    const candidate = path.slice(0, length);
    if (isLargeDeletionBoundaryBlock(getNodeAtPath(doc, candidate))) return candidate;
  }

  return undefined;
}

function firstEditableSelectionInNode(
  node: JSONContent | undefined,
  path: number[],
): EditorSelection | undefined {
  if (node?.type === "text") return { path, offset: 0 };
  if (isTextBlock(node ?? { type: "" })) {
    const firstText = firstTextSelectionInNode(node, path);
    return comparePaths(firstText.path, path) === 0 ? { path: [...path, 0], offset: 0 } : firstText;
  }

  for (const [index, child] of (node?.content ?? []).entries()) {
    const point = firstEditableSelectionInNode(child, [...path, index]);
    if (point !== undefined) return point;
  }

  return undefined;
}

function lastEditableSelectionInNode(
  node: JSONContent | undefined,
  path: number[],
): EditorSelection | undefined {
  if (node?.type === "text") return { path, offset: (node.text ?? "").length };
  if (isTextBlock(node ?? { type: "" })) {
    return lastTextPathInNode(node, path) ?? { path: [...path, 0], offset: 0 };
  }

  const content = node?.content ?? [];
  for (let index = content.length - 1; index >= 0; index -= 1) {
    const point = lastEditableSelectionInNode(content[index], [...path, index]);
    if (point !== undefined) return point;
  }

  return undefined;
}

function shouldExitBlockquoteOnSplit(
  doc: JSONContent,
  blockPath: number[],
  textPath: number[],
  offset: number,
) {
  const topIndex = blockPath[0] ?? 0;
  const topBlock = doc.content?.[topIndex];
  if (topBlock?.type !== "blockquote") return false;

  const childIndex = blockPath[1] ?? 0;
  if (childIndex !== (topBlock.content?.length ?? 0) - 1) return false;

  const block = getNodeAtPath(doc, blockPath);
  if (!isTextBlock(block ?? { type: "" })) return false;

  return getTextBlockText(block ?? { type: "" }).length === 0 && offset === 0;
}
