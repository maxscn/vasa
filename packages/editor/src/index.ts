import type { Extensions } from "@vasa/core";
import { Document } from "@vasa/extension-document";
import { createHorizontalRuleNode } from "@vasa/extension-horizontal-rule";
import { Paragraph } from "@vasa/extension-paragraph";
import { createTableNode, type TableCellNode } from "@vasa/extension-table";
import { Text } from "@vasa/extension-text";
import type {
  BoxNode,
  InlineTextNode,
  LayoutNode,
  LayoutStyle,
  TextNode,
  TextStyle,
} from "@vasa/layout";
import {
  defaultEditorMarkExtensions,
  editorTextStyleAttrsFromMarks,
  type EditorMarkExtension,
  type EditorMarkSpec,
  type EditorTextStyleAttributes,
} from "./font-attributes.ts";
import { deleteLeft, deleteRight, insertAt } from "./primitives.ts";

export * from "./actions.ts";
export * from "./controller.ts";
export * from "./fixtures.ts";
export * from "./font-attributes.ts";
export * from "./font.ts";
export * from "./interaction.ts";
export * from "./keyboard.ts";
export * from "../react/editor.tsx";
export * from "./primitives.ts";
export * from "./render-profile.ts";
export * from "./session.ts";
export * from "../react/keymap.ts";

export type EditorJson = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorJson[];
  marks?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
  }>;
  text?: string;
};

export type EditorSelection = {
  path: number[];
  offset: number;
  anchor?: EditorSelectionPoint;
};

export type EditorSelectionPoint = {
  path: number[];
  offset: number;
};

export const editorClipboardMimeType = "application/x-vasa-editor+json";

export type CreateEditorLayoutTreeOptions = {
  rootStyle?: LayoutStyle;
  paragraphStyle?: LayoutStyle;
  textStyle?: TextStyle;
  fontStyles?: Record<string, TextStyle>;
  markExtensions?: EditorMarkExtension[];
  resolveTextStyle?: (attrs: EditorTextStyleAttributes) => TextStyle | undefined;
};

type EditorNodeContext = {
  node: EditorJson;
  path: string;
  children: LayoutNode[];
  text: string;
  options: CreateEditorLayoutTreeOptions;
};

const headingScaleByLevel: Record<number, { fontSize: number; lineHeight: number }> = {
  1: { fontSize: 32, lineHeight: 40 },
  2: { fontSize: 26, lineHeight: 34 },
  3: { fontSize: 22, lineHeight: 30 },
  4: { fontSize: 18, lineHeight: 26 },
  5: { fontSize: 16, lineHeight: 24 },
  6: { fontSize: 14, lineHeight: 22 },
};

export function editorHeadingTextStyleAttrs(attrs: Record<string, unknown> | undefined = {}) {
  const level = headingLevel(attrs.level);
  const scale = headingScaleByLevel[level];

  return {
    fontSize: scale.fontSize,
    fontWeight: "700",
  };
}

export function createEditorLayoutTree(
  doc: EditorJson,
  options: CreateEditorLayoutTreeOptions = {},
): BoxNode {
  return {
    type: "box",
    style: { flexDirection: "column", ...options.rootStyle },
    children:
      doc.type === "doc"
        ? convertBlockChildren(doc.content, options)
        : convertEditorNode(doc, options, "0"),
  };
}

export function createBarebonesEditorExtensions(): Extensions {
  return [Document.tiptap, Paragraph.tiptap, Text.tiptap].filter(
    (extension): extension is NonNullable<typeof extension> => extension !== undefined,
  );
}

function convertBlockChildren(
  children: EditorJson[] | undefined,
  options: CreateEditorLayoutTreeOptions,
  path = "",
): LayoutNode[] {
  return (children ?? []).flatMap((child, index) =>
    convertEditorNode(child, options, path.length === 0 ? String(index) : `${path}.${index}`),
  );
}

function convertEditorNode(
  node: EditorJson,
  options: CreateEditorLayoutTreeOptions,
  path: string,
): LayoutNode[] {
  const children = convertBlockChildren(node.content, options, path);
  const text = node.type === "text" ? (node.text ?? "") : collectTextFromLayoutChildren(children);
  const context: EditorNodeContext = { node, path, children, text, options };

  if (context.node.type === "text") {
    return [createParagraphBox(context.text, context.options, path, path)];
  }

  if (context.node.type === "paragraph") {
    return [createParagraphBoxFromNode(context.node, context.options, path)];
  }

  if (context.node.type === "heading") {
    return [createHeadingBoxFromNode(context.node, context.options, path)];
  }

  if (context.node.type === "blockquote") {
    return [createBlockquoteBox(context.children, path)];
  }

  if (context.node.type === "horizontalRule") {
    return [
      createHorizontalRuleNode({
        id: path,
        color: typeof context.node.attrs?.color === "string" ? context.node.attrs.color : undefined,
        thickness:
          typeof context.node.attrs?.thickness === "number"
            ? context.node.attrs.thickness
            : undefined,
        style: { margin: { vertical: 8 }, height: 12 },
      }),
    ];
  }

  if (context.node.type === "table") {
    return [createTableBoxFromNode(context.node, context.options, path)];
  }

  return context.text.length === 0
    ? []
    : [createParagraphBox(context.text, context.options, path, firstTextPath(context.node, path))];
}

function createTableBoxFromNode(
  node: EditorJson,
  options: CreateEditorLayoutTreeOptions,
  path: string,
) {
  return createTableNode({
    id: path,
    borderColor: "#cbd5e1",
    borderWidth: 1,
    rows: (node.content ?? [])
      .filter((row) => row.type === "tableRow")
      .map((row, rowIndex) => ({
        id: `${path}.${rowIndex}`,
        cells: (row.content ?? [])
          .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
          .map((cell, cellIndex) => ({
            id: `${path}.${rowIndex}.${cellIndex}`,
            type: cell.type as TableCellNode["type"],
            colspan: tableSpan(cell.attrs?.colspan),
            rowspan: tableSpan(cell.attrs?.rowspan),
            colwidth: tableColwidth(cell.attrs?.colwidth),
            backgroundColor:
              typeof cell.attrs?.backgroundColor === "string"
                ? cell.attrs.backgroundColor
                : undefined,
            children: convertBlockChildren(
              cell.content,
              options,
              `${path}.${rowIndex}.${cellIndex}`,
            ),
          })),
      })),
  });
}

function createHeadingBoxFromNode(
  node: EditorJson,
  options: CreateEditorLayoutTreeOptions,
  path: string,
): BoxNode {
  const level = headingLevel(node.attrs?.level);
  const headingAttrs = editorHeadingTextStyleAttrs(node.attrs);
  const inlineTextNodes = collectParagraphTextNodes(node, options, path, headingAttrs);
  const children: LayoutNode[] =
    inlineTextNodes.length === 0
      ? [createTextLayoutNode("", options, firstTextPath(node, path), headingAttrs)]
      : inlineTextNodes.length === 1
        ? [
            createTextLayoutNode(
              inlineTextNodes[0].text,
              options,
              inlineTextNodes[0].path,
              inlineTextNodes[0].attrs,
            ),
          ]
        : [createInlineTextLayoutNode(inlineTextNodes, options, path)];

  return {
    type: "box",
    id: path,
    style: {
      ...options.paragraphStyle,
      margin: mergeEdges(options.paragraphStyle?.margin, { top: level <= 2 ? 10 : 8, bottom: 4 }),
      flexDirection: options.paragraphStyle?.flexDirection ?? "column",
    },
    children,
  };
}

function createBlockquoteBox(children: LayoutNode[], path: string): BoxNode {
  return {
    type: "box",
    id: path,
    blockquoteBorderColor: "#d1d5db",
    blockquoteBorderWidth: 3,
    style: {
      flexDirection: "column",
      padding: { left: 16 },
      margin: { vertical: 24 },
    },
    children,
  } as BoxNode;
}

function createParagraphBoxFromNode(
  node: EditorJson,
  options: CreateEditorLayoutTreeOptions,
  path: string,
): BoxNode {
  const spacerHeight =
    typeof node.attrs?.pageSpacerHeight === "number" ? node.attrs.pageSpacerHeight : undefined;
  const inlineTextNodes = collectParagraphTextNodes(node, options, path);
  const children: LayoutNode[] =
    inlineTextNodes.length === 0
      ? [createTextLayoutNode("", options, firstTextPath(node, path))]
      : inlineTextNodes.length === 1
        ? [
            createTextLayoutNode(
              inlineTextNodes[0].text,
              options,
              inlineTextNodes[0].path,
              inlineTextNodes[0].attrs,
            ),
          ]
        : [createInlineTextLayoutNode(inlineTextNodes, options, path)];

  return {
    type: "box",
    id: path,
    ...(spacerHeight === undefined ? {} : { pagination: { preserveEmptyHeight: true } }),
    style: {
      ...options.paragraphStyle,
      ...(spacerHeight === undefined ? {} : { height: spacerHeight, minHeight: spacerHeight }),
      flexDirection: options.paragraphStyle?.flexDirection ?? "column",
    },
    children,
  };
}

function createInlineTextLayoutNode(
  children: Array<{ path: string; text: string; attrs: EditorTextStyleAttributes }>,
  options: CreateEditorLayoutTreeOptions,
  path: string,
): InlineTextNode {
  return {
    type: "inlineText",
    id: path,
    runs: children.map((child) => ({
      id: child.path,
      text: child.text,
      style: resolveEditorTextStyle(options, child.attrs),
    })),
    ...(options.textStyle === undefined ? {} : { style: options.textStyle }),
  };
}

function createParagraphBox(
  text: string,
  options: CreateEditorLayoutTreeOptions,
  path: string,
  textPath: string,
): BoxNode {
  const textNode: TextNode = {
    type: "text",
    id: textPath,
    text,
    ...(options.textStyle === undefined ? {} : { style: options.textStyle }),
  };
  const children: LayoutNode[] = [textNode];

  return {
    type: "box",
    id: path,
    style: { flexDirection: "column", ...options.paragraphStyle },
    children,
  };
}

function createTextLayoutNode(
  text: string,
  options: CreateEditorLayoutTreeOptions,
  path: string,
  attrs: EditorTextStyleAttributes = {},
): TextNode {
  const style = resolveEditorTextStyle(options, attrs);

  return {
    type: "text",
    id: path,
    text,
    ...(Object.keys(style).length === 0 ? {} : { style }),
  };
}

function resolveEditorTextStyle(
  options: CreateEditorLayoutTreeOptions,
  attrs: EditorTextStyleAttributes = {},
): TextStyle {
  const fontStyle = attrs.fontId === undefined ? undefined : options.fontStyles?.[attrs.fontId];
  const resolvedStyle = options.resolveTextStyle?.(attrs);

  return {
    ...options.textStyle,
    ...fontStyle,
    ...resolvedStyle,
  };
}

function collectParagraphTextNodes(
  node: EditorJson,
  options: CreateEditorLayoutTreeOptions,
  path: string,
  baseAttrs: EditorTextStyleAttributes = {},
): Array<{ path: string; text: string; attrs: EditorTextStyleAttributes }> {
  const nodes: Array<{ path: string; text: string; attrs: EditorTextStyleAttributes }> = [];

  for (const [index, child] of (node.content ?? []).entries()) {
    const childPath = `${path}.${index}`;
    if (child.type !== "text") continue;

    const previous = nodes.at(-1);
    const attrs = {
      ...baseAttrs,
      ...textStyleAttrsFromNode(child, options.markExtensions ?? defaultEditorMarkExtensions),
    };
    const text = child.text ?? "";

    if (previous !== undefined && sameTextStyleAttrs(previous.attrs, attrs)) {
      previous.text += text;
    } else {
      nodes.push({ path: childPath, text, attrs });
    }
  }

  return nodes;
}

function textStyleAttrsFromNode(
  node: EditorJson,
  markExtensions: EditorMarkExtension[],
): EditorTextStyleAttributes {
  return textStyleAttrsFromMarks(node.marks, markExtensions);
}

function textStyleAttrsFromMarks(
  marks: EditorMarkSpec[] | undefined,
  markExtensions: EditorMarkExtension[],
): EditorTextStyleAttributes {
  return editorTextStyleAttrsFromMarks(marks, markExtensions);
}

function sameTextStyleAttrs(left: EditorTextStyleAttributes, right: EditorTextStyleAttributes) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function headingLevel(value: unknown) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
    ? value
    : 1;
}

function tableSpan(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function tableColwidth(value: unknown) {
  return Array.isArray(value)
    ? value.filter((width): width is number => typeof width === "number" && Number.isFinite(width))
    : undefined;
}

function mergeEdges(
  base: LayoutStyle["margin"] | undefined,
  next: Exclude<LayoutStyle["margin"], number> | undefined,
): LayoutStyle["margin"] {
  if (typeof base === "number" || base === undefined) return { ...next };
  return { ...base, ...next };
}

function collectTextFromLayoutChildren(children: LayoutNode[]): string {
  return children.map((child) => collectTextFromLayoutNode(child)).join("");
}

function collectTextFromLayoutNode(node: LayoutNode): string {
  if (node.type === "text") return node.text;
  if (node.type === "inlineText") return node.runs.map((run) => run.text).join("");
  if (!hasLayoutChildren(node)) return "";
  return node.children.map((child) => collectTextFromLayoutNode(child)).join("");
}

function hasLayoutChildren(node: LayoutNode): node is LayoutNode & { children: LayoutNode[] } {
  return Array.isArray((node as { children?: unknown }).children);
}

export function getTextAtPath(doc: EditorJson, path: number[]): string {
  const node = getNodeAtPath(doc, path);
  if (node?.type === "text") return node.text ?? "";
  return "";
}

export function getSelectedText(doc: EditorJson, selection: EditorSelection): string {
  if (!isSelectionExpanded(selection)) return "";

  const range = normalizeSelectionRange(doc, selection);
  const blocks = collectTextBlocksInRange(doc, range);
  return blocks.map(({ path }) => getTextBlockTextInRange(doc, path, range)).join("\n\n");
}

export function getSelectedContent(
  doc: EditorJson,
  selection: EditorSelection,
): EditorJson | undefined {
  if (!isSelectionExpanded(selection)) return undefined;

  const range = normalizeSelectionRange(doc, selection);
  const content = (doc.content ?? [])
    .map((node, index) => cloneSelectedNode(node, [index], range))
    .filter((node): node is EditorJson => node !== undefined);

  return content.length === 0 ? undefined : { type: "doc", content };
}

export function getSelectedHtml(doc: EditorJson, selection: EditorSelection): string {
  const content = getSelectedContent(doc, selection);
  return content === undefined ? "" : serializeEditorHtml(content);
}

export function serializeEditorHtml(fragment: EditorJson): string {
  return editorContentFromFragment(fragment).map(serializeBlockHtml).join("");
}

export function parseEditorHtml(html: string): EditorJson | undefined {
  if (html.trim().length === 0 || typeof DOMParser === "undefined") return undefined;

  const body = new DOMParser().parseFromString(html, "text/html").body;
  const content = parseHtmlChildren(body, []);
  return content.length === 0 ? undefined : { type: "doc", content };
}

export function insertEditorContent(
  doc: EditorJson,
  selection: EditorSelection,
  fragment: EditorJson,
): { doc: EditorJson; selection: EditorSelection } {
  const content = editorContentFromFragment(fragment);
  if (content.length === 0) return { doc, selection };

  if (isSelectionExpanded(selection)) {
    const range = normalizeSelectionRange(doc, selection);
    const startText = getTextAtPath(doc, range.start.path);
    const endText = getTextAtPath(doc, range.end.path);
    if (range.start.offset === 0 && range.end.offset === endText.length) {
      const nextDoc = cloneEditorJson(doc);
      const startIndex = range.start.path[0] ?? 0;
      const endIndex = range.end.path[0] ?? startIndex;
      nextDoc.content = [...(nextDoc.content ?? [])];
      nextDoc.content.splice(
        startIndex,
        endIndex - startIndex + 1,
        ...content.map(cloneEditorJson),
      );

      return {
        doc: nextDoc,
        selection: selectionAtEndOfInsertedContent(content, [startIndex]),
      };
    }

    if (range.start.offset === 0 && range.end.offset === 0 && startText.length === 0) {
      const nextDoc = cloneEditorJson(doc);
      const startIndex = range.start.path[0] ?? 0;
      nextDoc.content = [...(nextDoc.content ?? [])];
      nextDoc.content.splice(startIndex, 1, ...content.map(cloneEditorJson));

      return {
        doc: nextDoc,
        selection: selectionAtEndOfInsertedContent(content, [startIndex]),
      };
    }
  }

  const deleted = deleteSelectionRange(doc, selection);
  return insertContentAtPoint(deleted.doc, deleted.selection, content);
}

export function insertText(
  doc: EditorJson,
  selection: EditorSelection,
  text: string,
): { doc: EditorJson; selection: EditorSelection } {
  if (text.length === 0) return { doc, selection };

  const deleted = deleteSelectionRange(doc, selection);
  const inserted = insertAt(deleted.doc, deleted.selection.path, text, deleted.selection.offset);
  return { doc: inserted.doc, selection: inserted.point };
}

export function insertTextWithMarks(
  doc: EditorJson,
  selection: EditorSelection,
  text: string,
  marks: EditorJson["marks"] = [],
): { doc: EditorJson; selection: EditorSelection } {
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

  const nextDoc = cloneEditorJson(deleted.doc);
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
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
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
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
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
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
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
    const nextDoc = cloneEditorJson(deleted.doc);
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

  const nextDoc = cloneEditorJson(deleted.doc);
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
    ...nextBlock.content.slice(0, textIndex).map(cloneEditorJson),
    ...textNodeSegment(textNode, 0, offset),
  ];
  const rightContent = [
    ...textNodeSegment(textNode, offset, text.length),
    ...nextBlock.content.slice(textIndex + 1).map(cloneEditorJson),
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
  doc: EditorJson,
  selection: EditorSelection,
  type: "paragraph" | "heading",
  attrs: Record<string, unknown> = {},
): { doc: EditorJson; selection: EditorSelection } {
  const blockPath = currentTextBlockPath(doc, selection.path);
  if (blockPath === undefined) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  const topBlock = doc.content?.[topIndex];
  if (topBlock === undefined) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
  const blocks = [...(nextDoc.content ?? [])];
  const nextTopBlock = blocks[topIndex];

  if (nextTopBlock?.type === "blockquote") {
    const unwrapped = (nextTopBlock.content ?? []).map(cloneEditorJson);
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
    content: [cloneEditorJson(nextTopBlock)],
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
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
  selection: EditorSelection,
  height: number,
): { doc: EditorJson; selection: EditorSelection } {
  const topIndex = selection.path[0] ?? 0;
  return insertPageSpacerAtIndex(doc, Math.min((doc.content ?? []).length, topIndex + 1), height);
}

export function insertPageSpacerAtDocumentEnd(
  doc: EditorJson,
  height: number,
): { doc: EditorJson; selection: EditorSelection } {
  return insertPageSpacerAtIndex(doc, doc.content?.length ?? 0, height);
}

export function insertPageBreakAtDocumentEnd(
  doc: EditorJson,
  height: number,
  options: InsertPageBreakOptions = {},
): { doc: EditorJson; selection: EditorSelection } {
  return insertPageBreakAtIndex(doc, doc.content?.length ?? 0, height, options);
}

export type InsertPageBreakOptions = {
  fontId?: string;
};

function insertPageSpacerAtIndex(
  doc: EditorJson,
  insertIndex: number,
  height: number,
): { doc: EditorJson; selection: EditorSelection } {
  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
  insertIndex: number,
  height: number,
  options: InsertPageBreakOptions = {},
): { doc: EditorJson; selection: EditorSelection } {
  const nextDoc = cloneEditorJson(doc);
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

function createPageSpacerParagraph(spacerHeight: number): EditorJson {
  return {
    type: "paragraph",
    attrs: { pageSpacerHeight: spacerHeight },
    content: [{ type: "text", text: "" }],
  };
}

export function insertTableRowBefore(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  return insertTableRow(doc, selection, "before");
}

export function insertTableRowAfter(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  return insertTableRow(doc, selection, "after");
}

export function insertTableColumnBefore(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  return insertTableColumn(doc, selection, "before");
}

export function insertTableColumnAfter(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  return insertTableColumn(doc, selection, "after");
}

export function deleteCurrentTableRow(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  if (table?.content === undefined) return { doc, selection };

  table.content.splice(position.rowIndex, 1);
  if (table.content.length === 0) return deleteCurrentTable(doc, selection);

  const nextRowIndex = Math.min(position.rowIndex, table.content.length - 1);
  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(table.content[nextRowIndex], [
      ...position.tablePath,
      nextRowIndex,
    ]),
  };
}

export function deleteCurrentTableColumn(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  if (table?.content === undefined) return { doc, selection };

  for (const row of table.content) {
    row.content?.splice(position.cellIndex, 1);
  }

  table.content = table.content.filter((row) => (row.content ?? []).length > 0);
  if (table.content.length === 0) return deleteCurrentTable(doc, selection);

  const nextRowIndex = Math.min(position.rowIndex, table.content.length - 1);
  const nextCellIndex = Math.min(
    position.cellIndex,
    Math.max(0, (table.content[nextRowIndex]?.content ?? []).length - 1),
  );

  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(table.content[nextRowIndex]?.content?.[nextCellIndex], [
      ...position.tablePath,
      nextRowIndex,
      nextCellIndex,
    ]),
  };
}

export function deleteCurrentTable(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
  const parent = getNodeAtPath(nextDoc, position.tablePath.slice(0, -1));
  const tableIndex = position.tablePath.at(-1) ?? 0;
  const siblings = parent?.content ?? nextDoc.content;
  if (siblings === undefined) return { doc, selection };

  siblings.splice(tableIndex, 1);

  return {
    doc: nextDoc,
    selection: nearestTextSelection(nextDoc, position.tablePath),
  };
}

export function ensureParagraphAfterCurrentTable(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return undefined;

  const tableIndex = position.tablePath.at(-1) ?? 0;
  const parentPath = position.tablePath.slice(0, -1);
  const parent = getNodeAtPath(doc, parentPath);
  const siblings = parentPath.length === 0 ? doc.content : parent?.content;
  if (siblings === undefined) return undefined;

  const nextSiblingPath = [...parentPath, tableIndex + 1];
  const nextSibling = siblings[tableIndex + 1];
  if (nextSibling !== undefined) {
    return {
      doc,
      selection: firstTextSelectionInNode(nextSibling, nextSiblingPath),
    };
  }

  const nextDoc = cloneEditorJson(doc);
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  const nextSiblings = parentPath.length === 0 ? nextDoc.content : nextParent?.content;
  if (nextSiblings === undefined) return undefined;

  nextSiblings.splice(tableIndex + 1, 0, createTextParagraph(""));

  return {
    doc: nextDoc,
    selection: { path: [...nextSiblingPath, 0], offset: 0 },
  };
}

export function isSelectionPointAtCurrentTableEnd(
  doc: EditorJson,
  selection: EditorSelection,
  point: EditorSelectionPoint,
) {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return false;
  if (tablePositionForPath(doc, point.path)?.tablePath.join(".") !== position.tablePath.join(".")) {
    return false;
  }

  const table = getNodeAtPath(doc, position.tablePath);
  const end = lastTextPathInNode(table, position.tablePath);
  return end !== undefined && comparePoints(end, point) === 0;
}

function insertTableRow(
  doc: EditorJson,
  selection: EditorSelection,
  placement: "before" | "after",
): { doc: EditorJson; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  const sourceRow = table?.content?.[position.rowIndex];
  if (table?.content === undefined || sourceRow === undefined) return { doc, selection };

  const insertIndex = position.rowIndex + (placement === "after" ? 1 : 0);
  const row = createEmptyTableRowLike(
    sourceRow,
    placement === "before" && position.rowIndex === 0 ? "preserve" : "body",
  );
  table.content.splice(insertIndex, 0, row);

  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(row, [...position.tablePath, insertIndex]),
  };
}

function insertTableColumn(
  doc: EditorJson,
  selection: EditorSelection,
  placement: "before" | "after",
): { doc: EditorJson; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  if (table?.content === undefined) return { doc, selection };

  const insertIndex = position.cellIndex + (placement === "after" ? 1 : 0);
  for (const row of table.content) {
    const sourceCell = row.content?.[position.cellIndex] ?? row.content?.at(-1);
    row.content = [...(row.content ?? [])];
    row.content.splice(insertIndex, 0, createEmptyTableCellLike(sourceCell));
  }

  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(table.content[position.rowIndex]?.content?.[insertIndex], [
      ...position.tablePath,
      position.rowIndex,
      insertIndex,
    ]),
  };
}

export function currentTextBlockType(doc: EditorJson, selection: EditorSelection) {
  const blockPath = currentTextBlockPath(doc, selection.path);
  const block = blockPath === undefined ? undefined : getNodeAtPath(doc, blockPath);

  return {
    type: block?.type,
    attrs: block?.attrs,
    inBlockquote: doc.content?.[selection.path[0] ?? 0]?.type === "blockquote",
  };
}

export function moveSelection(
  doc: EditorJson,
  selection: EditorSelection,
  direction: "left" | "right",
): EditorSelection {
  const boundaryMove = moveLargeBlockBoundarySelection(doc, selection, direction);
  if (boundaryMove !== undefined) return boundaryMove;

  const textPath = normalizeTextPath(doc, selection.path);
  const text = getTextAtPath(doc, textPath);
  const currentOffset = clampOffset(selection.offset, text);

  if (direction === "left" && currentOffset === 0) {
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

function deleteSelectionRange(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
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
  const nextDoc = cloneEditorJson(doc);

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
  doc: EditorJson,
  path: number[],
): { doc: EditorJson; selection: EditorSelection } {
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
  const nextDoc = cloneEditorJson(doc);
  const parent = getNodeAtPath(nextDoc, parentPath);
  if (parent?.content === undefined) return { doc, selection: { path, offset: 0 } };

  parent.content.splice(blockIndex - 1, 2, createTextParagraph(`${previousText}${currentText}`));

  return { doc: nextDoc, selection: { path: previousPath, offset: previousText.length } };
}

function joinWithNextParagraph(
  doc: EditorJson,
  path: number[],
): { doc: EditorJson; selection: EditorSelection } {
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
  const nextDoc = cloneEditorJson(doc);
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  if (nextParent?.content === undefined) {
    return { doc, selection: { path, offset: currentText.length } };
  }

  nextParent.content.splice(blockIndex, 2, createTextParagraph(`${currentText}${nextText}`));

  return { doc: nextDoc, selection: { path, offset: currentText.length } };
}

function joinParagraphIntoPreviousBlockquote(
  doc: EditorJson,
  blockPath: number[],
  textPath: number[],
  blockquotePath: number[],
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const quoteEnd = lastTextPathInNode(getNodeAtPath(doc, blockquotePath), blockquotePath);
  if (quoteEnd === undefined) return undefined;

  const quoteText = getTextAtPath(doc, quoteEnd.path);
  const currentText = getTextAtPath(doc, textPath);
  const nextDoc = cloneEditorJson(doc);
  const quoteTextNode = getNodeAtPath(nextDoc, quoteEnd.path);
  const parent = getNodeAtPath(nextDoc, blockPath.slice(0, -1));
  const siblings = blockPath.length === 1 ? nextDoc.content : parent?.content;
  if (quoteTextNode?.type !== "text" || siblings === undefined) return undefined;

  quoteTextNode.text = `${quoteText}${currentText}`;
  siblings.splice(blockPath.at(-1) ?? 0, 1);

  return { doc: nextDoc, selection: { path: quoteEnd.path, offset: quoteText.length } };
}

function joinParagraphIntoPreviousTextBlock(
  doc: EditorJson,
  blockPath: number[],
  textPath: number[],
  previousBlockPath: number[],
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const previousPath = normalizeTextPath(doc, previousBlockPath);
  const previousText = getTextAtPath(doc, previousPath);
  const currentText = getTextAtPath(doc, textPath);
  const nextDoc = cloneEditorJson(doc);
  const previousTextNode = getNodeAtPath(nextDoc, previousPath);
  const parent = getNodeAtPath(nextDoc, blockPath.slice(0, -1));
  const siblings = blockPath.length === 1 ? nextDoc.content : parent?.content;
  if (previousTextNode?.type !== "text" || siblings === undefined) return undefined;

  previousTextNode.text = `${previousText}${currentText}`;
  siblings.splice(blockPath.at(-1) ?? 0, 1);

  return { doc: nextDoc, selection: { path: previousPath, offset: previousText.length } };
}

function liftCurrentBlockquoteChild(
  doc: EditorJson,
  blockPath: number[],
  textPath: number[],
  selectionOffset: number,
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const topIndex = blockPath[0] ?? 0;
  const childIndex = blockPath[1];
  const blockquote = doc.content?.[topIndex];
  if (blockquote?.type !== "blockquote" || childIndex === undefined) return undefined;

  const child = blockquote.content?.[childIndex];
  if (child === undefined) return undefined;

  const before = blockquote.content?.slice(0, childIndex) ?? [];
  const after = blockquote.content?.slice(childIndex + 1) ?? [];
  const liftedIndex = topIndex + (before.length > 0 ? 1 : 0);
  const nextDoc = cloneEditorJson(doc);
  const replacement: EditorJson[] = [
    ...(before.length > 0 ? [{ type: "blockquote", content: before.map(cloneEditorJson) }] : []),
    cloneEditorJson(child),
    ...(after.length > 0 ? [{ type: "blockquote", content: after.map(cloneEditorJson) }] : []),
  ];

  nextDoc.content = [...(nextDoc.content ?? [])];
  nextDoc.content.splice(topIndex, 1, ...replacement);

  return {
    doc: nextDoc,
    selection: { path: [liftedIndex, ...textPath.slice(2)], offset: selectionOffset },
  };
}

function joinNextTextBlockIntoParagraph(
  doc: EditorJson,
  blockPath: number[],
  textPath: number[],
  nextBlockPath: number[],
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const nextPath = normalizeTextPath(doc, nextBlockPath);
  const currentText = getTextAtPath(doc, textPath);
  const nextText = getTextAtPath(doc, nextPath);
  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
  blockPath: number[],
  textPath: number[],
  blockquotePath: number[],
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const quoteStart = firstTextSelectionInNode(getNodeAtPath(doc, blockquotePath), blockquotePath);
  const quoteText = getTextAtPath(doc, quoteStart.path);
  const currentText = getTextAtPath(doc, textPath);
  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
  blockPath: number[],
  textPath: number[],
  direction: "previous" | "next",
): { doc: EditorJson; selection: EditorSelection } | undefined {
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
  doc: EditorJson,
  textPath: number[],
  direction: "previous" | "next",
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const blockPath = currentTextBlockPath(doc, textPath);
  if (blockPath === undefined) return undefined;

  const blockIndex = blockPath.at(-1) ?? 0;
  const parentPath = blockPath.slice(0, -1);
  const adjacentBlockIndex = direction === "previous" ? blockIndex - 1 : blockIndex + 1;
  if (adjacentBlockIndex < 0) return undefined;

  const adjacentBlockPath = [...parentPath, adjacentBlockIndex];
  const adjacentBlock = getNodeAtPath(doc, adjacentBlockPath);
  if (!isLargeDeletionBoundaryBlock(adjacentBlock)) return undefined;

  const nextDoc = cloneEditorJson(doc);
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

function isLargeDeletionBoundaryBlock(node: EditorJson | undefined) {
  return node?.type === "table" || node?.type === "horizontalRule";
}

function insertParagraphAtLargeBlockBoundary(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } | undefined {
  if (isSelectionExpanded(selection)) return undefined;
  if (!isLargeDeletionBoundaryBlock(getNodeAtPath(doc, selection.path))) return undefined;

  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
  selection: EditorSelection,
  direction: "left" | "right",
): EditorSelection | undefined {
  if (!isLargeDeletionBoundaryBlock(getNodeAtPath(doc, selection.path))) return undefined;

  if (direction === "left") {
    if (selection.offset > 0) return { path: selection.path, offset: 0 };
    return previousTextPoint(doc, selection.path) ?? selection;
  }

  if (selection.offset <= 0) return { path: selection.path, offset: 1 };
  return nextTextPoint(doc, selection.path) ?? selection;
}

function deleteLargeBlockBoundarySelection(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } | undefined {
  if (!isLargeDeletionBoundaryBlock(getNodeAtPath(doc, selection.path))) return undefined;
  return deleteLargeBlockAtPath(doc, selection.path);
}

function deleteLargeBlockAtPath(
  doc: EditorJson,
  blockPath: number[],
): { doc: EditorJson; selection: EditorSelection } | undefined {
  const nextDoc = cloneEditorJson(doc);
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
  doc: EditorJson,
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

function isSelectionExpanded(selection: EditorSelection) {
  return (
    selection.anchor !== undefined &&
    (comparePaths(selection.anchor.path, selection.path) !== 0 ||
      selection.anchor.offset !== selection.offset)
  );
}

function normalizeSelectionRange(
  doc: EditorJson,
  selection: EditorSelection,
): { start: EditorSelectionPoint; end: EditorSelectionPoint } {
  const focus = normalizeSelectionPoint(doc, selection);
  const anchor = normalizeSelectionPoint(doc, selection.anchor ?? selection);

  return comparePoints(anchor, focus) <= 0
    ? { start: anchor, end: focus }
    : { start: focus, end: anchor };
}

function normalizeSelectionPoint(
  doc: EditorJson,
  point: EditorSelectionPoint,
): EditorSelectionPoint {
  const path = normalizeTextPath(doc, point.path);
  const text = getTextAtPath(doc, path);

  return { path, offset: clampOffset(point.offset, text) };
}

function previousTextPoint(doc: EditorJson, path: number[]): EditorSelectionPoint | undefined {
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

function nextTextPoint(doc: EditorJson, path: number[]): EditorSelectionPoint | undefined {
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

function collectTextPaths(node: EditorJson, path: number[] = []): number[][] {
  if (node.type === "text") return [path];

  return (node.content ?? []).flatMap((child, index) => collectTextPaths(child, [...path, index]));
}

function arePointsInSameTextBlock(doc: EditorJson, left: number[], right: number[]) {
  const leftBlockPath = currentTextBlockPath(doc, left);
  const rightBlockPath = currentTextBlockPath(doc, right);
  return (
    leftBlockPath !== undefined &&
    rightBlockPath !== undefined &&
    comparePaths(leftBlockPath, rightBlockPath) === 0
  );
}

function currentTextBlockPath(doc: EditorJson, path: number[]): number[] | undefined {
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

function tablePositionForPath(doc: EditorJson, path: number[]) {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const tablePath = path.slice(0, index + 1);
    const table = getNodeAtPath(doc, tablePath);
    if (table?.type !== "table") continue;

    const rowIndex = path[index + 1];
    const cellIndex = path[index + 2];
    const row = typeof rowIndex === "number" ? table.content?.[rowIndex] : undefined;
    const cell = typeof cellIndex === "number" ? row?.content?.[cellIndex] : undefined;

    if (row?.type === "tableRow" && (cell?.type === "tableCell" || cell?.type === "tableHeader")) {
      return { tablePath, rowIndex, cellIndex };
    }
  }

  return undefined;
}

function createEmptyTableRowLike(row: EditorJson, kind: "body" | "preserve" = "body"): EditorJson {
  return {
    type: "tableRow",
    content: (row.content ?? []).map((cell) =>
      createEmptyTableCellLike(kind === "preserve" ? cell : undefined),
    ),
  };
}

function createEmptyTableCellLike(cell: EditorJson | undefined): EditorJson {
  return {
    type: cell?.type === "tableHeader" ? "tableHeader" : "tableCell",
    ...(cell?.attrs === undefined
      ? {}
      : { attrs: JSON.parse(JSON.stringify(cell.attrs)) as Record<string, unknown> }),
    content: [createTextParagraph("")],
  };
}

function createBlankEditorTable(rows: number, columns: number): EditorJson {
  return {
    type: "table",
    content: Array.from({ length: rows }, (_, rowIndex) => ({
      type: "tableRow",
      content: Array.from({ length: columns }, () => ({
        type: rowIndex === 0 ? "tableHeader" : "tableCell",
        content: [createTextParagraph("")],
      })),
    })),
  };
}

function shouldExitBlockquoteOnSplit(
  doc: EditorJson,
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

function getTextBlockText(block: EditorJson) {
  return (block.content ?? [])
    .filter((child) => child.type === "text")
    .map((child) => child.text ?? "")
    .join("");
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

function getNodeAtPath(doc: EditorJson, path: number[]): EditorJson | undefined {
  let current: EditorJson | undefined = doc;

  for (const index of path) {
    current = current?.content?.[index];
  }

  return current;
}

function collectTextBlocksInRange(
  node: EditorJson,
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
  doc: EditorJson,
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
  block: EditorJson,
  blockPath: number[],
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
) {
  const firstPoint = firstTextPointInBlock(block, blockPath);
  const lastPoint = lastTextPointInBlock(block, blockPath);
  if (firstPoint === undefined || lastPoint === undefined) return false;

  return comparePoints(lastPoint, range.start) >= 0 && comparePoints(firstPoint, range.end) <= 0;
}

function firstTextPointInBlock(
  block: EditorJson,
  blockPath: number[],
): EditorSelectionPoint | undefined {
  const textIndex = block.content?.findIndex((child) => child.type === "text") ?? -1;
  return textIndex < 0 ? undefined : { path: [...blockPath, textIndex], offset: 0 };
}

function lastTextPointInBlock(
  block: EditorJson,
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

function isTextBlock(node: EditorJson) {
  return node.type === "paragraph" || node.type === "heading";
}

function isPointInsideBlock(point: EditorSelectionPoint, blockPath: number[]) {
  return (
    point.path.length > blockPath.length &&
    blockPath.every((pathSegment, index) => point.path[index] === pathSegment)
  );
}

function serializeBlockHtml(node: EditorJson): string {
  if (node.type === "table") {
    return `<table><tbody>${(node.content ?? []).map(serializeTableRowHtml).join("")}</tbody></table>`;
  }

  if (node.type === "blockquote") {
    return `<blockquote>${(node.content ?? []).map(serializeBlockHtml).join("")}</blockquote>`;
  }

  if (node.type === "heading") {
    const level = headingLevel(node.attrs?.level);
    return `<h${level}>${serializeInlineHtml(node.content ?? [])}</h${level}>`;
  }

  return `<p>${serializeInlineHtml(node.content ?? [])}</p>`;
}

function serializeTableRowHtml(node: EditorJson): string {
  if (node.type !== "tableRow") return "";
  return `<tr>${(node.content ?? []).map(serializeTableCellHtml).join("")}</tr>`;
}

function serializeTableCellHtml(node: EditorJson): string {
  const tag = node.type === "tableHeader" ? "th" : "td";
  if (node.type !== "tableCell" && node.type !== "tableHeader") return "";
  return `<${tag}>${(node.content ?? []).map(serializeBlockHtml).join("")}</${tag}>`;
}

function serializeInlineHtml(content: EditorJson[]): string {
  return content.map(serializeInlineNodeHtml).join("");
}

function serializeInlineNodeHtml(node: EditorJson): string {
  if (node.type !== "text") return serializeInlineHtml(node.content ?? []);

  return (node.marks ?? []).reduceRight(
    (html, mark) => wrapMarkHtml(html, mark),
    escapeHtml(node.text ?? ""),
  );
}

function wrapMarkHtml(html: string, mark: NonNullable<EditorJson["marks"]>[number]) {
  if (mark.type === "bold") return `<strong>${html}</strong>`;
  if (mark.type === "italic") return `<em>${html}</em>`;
  if (mark.type === "underline") return `<u>${html}</u>`;
  if (mark.type === "strike") return `<s>${html}</s>`;
  if (mark.type === "code") return `<code>${html}</code>`;
  if (mark.type === "subscript") return `<sub>${html}</sub>`;
  if (mark.type === "superscript") return `<sup>${html}</sup>`;

  if (mark.type === "highlight") {
    const color = typeof mark.attrs?.color === "string" ? mark.attrs.color : "#fef08a";
    return `<mark style="background-color: ${escapeAttribute(color)}">${html}</mark>`;
  }

  if (mark.type === "textStyle") {
    const style = serializeTextStyle(mark.attrs ?? {});
    return style.length === 0 ? html : `<span style="${style}">${html}</span>`;
  }

  return html;
}

function serializeTextStyle(attrs: Record<string, unknown>) {
  const styles: string[] = [];
  if (typeof attrs.color === "string") styles.push(`color: ${escapeAttribute(attrs.color)}`);
  if (typeof attrs.fontSize === "number") styles.push(`font-size: ${attrs.fontSize}px`);
  if (typeof attrs.fontId === "string")
    styles.push(`font-family: ${escapeAttribute(attrs.fontId)}`);
  return styles.join("; ");
}

function parseHtmlChildren(parent: ParentNode, marks: EditorJson["marks"]): EditorJson[] {
  const blocks: EditorJson[] = [];
  const looseInline: EditorJson[] = [];

  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      looseInline.push(...parseTextNode(child, marks));
      continue;
    }

    if (!(child instanceof HTMLElement)) continue;

    const childMarks = marksForElement(child, marks);
    if (isHtmlBlockElement(child)) {
      flushLooseInline(blocks, looseInline);
      blocks.push(...parseHtmlBlock(child, childMarks));
    } else {
      looseInline.push(...parseHtmlInlineChildren(child, childMarks));
    }
  }

  flushLooseInline(blocks, looseInline);
  return blocks;
}

function parseHtmlBlock(element: HTMLElement, marks: EditorJson["marks"]): EditorJson[] {
  const tag = element.tagName.toLowerCase();

  if (tag === "blockquote") {
    const content = parseHtmlChildren(element, marks);
    return content.length === 0 ? [] : [{ type: "blockquote", content }];
  }

  if (tag === "table") {
    const content = Array.from(
      element.querySelectorAll(":scope > tbody > tr, :scope > tr"),
    ).flatMap((row) => parseTableRow(row, marks));
    return content.length === 0 ? [] : [{ type: "table", content }];
  }

  if (isHeadingTag(tag)) {
    return [
      {
        type: "heading",
        attrs: { level: Number.parseInt(tag.slice(1), 10) },
        content: textContentOrEmpty(parseHtmlInlineChildren(element, marks)),
      },
    ];
  }

  if (tag === "br") return [{ type: "paragraph", content: [{ type: "text", text: "" }] }];

  const nestedBlocks = Array.from(element.children).some((child) =>
    isHtmlBlockElement(child as HTMLElement),
  );
  if (nestedBlocks && tag !== "li") return parseHtmlChildren(element, marks);

  return [
    { type: "paragraph", content: textContentOrEmpty(parseHtmlInlineChildren(element, marks)) },
  ];
}

function parseTableRow(element: Element, marks: EditorJson["marks"]): EditorJson[] {
  if (!(element instanceof HTMLElement) || element.tagName.toLowerCase() !== "tr") return [];
  const content = Array.from(element.children).flatMap((cell) => parseTableCell(cell, marks));
  return content.length === 0 ? [] : [{ type: "tableRow", content }];
}

function parseTableCell(element: Element, marks: EditorJson["marks"]): EditorJson[] {
  if (!(element instanceof HTMLElement)) return [];
  const tag = element.tagName.toLowerCase();
  if (tag !== "td" && tag !== "th") return [];

  const content = parseHtmlChildren(element, marks);
  return [
    {
      type: tag === "th" ? "tableHeader" : "tableCell",
      content:
        content.length === 0
          ? [{ type: "paragraph", content: [{ type: "text", text: "" }] }]
          : content,
    },
  ];
}

function parseHtmlInlineChildren(parent: ParentNode, marks: EditorJson["marks"]): EditorJson[] {
  const content: EditorJson[] = [];

  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      content.push(...parseTextNode(child, marks));
      continue;
    }

    if (!(child instanceof HTMLElement)) continue;

    if (child.tagName.toLowerCase() === "br") {
      content.push({ type: "text", text: "\n", ...(marks?.length ? { marks } : {}) });
      continue;
    }

    content.push(...parseHtmlInlineChildren(child, marksForElement(child, marks)));
  }

  return mergeAdjacentTextNodes(content);
}

function parseTextNode(node: Node, marks: EditorJson["marks"]): EditorJson[] {
  const text = (node.textContent ?? "").replaceAll("\u00a0", " ");
  if (text.length === 0 || text.trim().length === 0) return [];
  return [{ type: "text", text, ...(marks?.length ? { marks } : {}) }];
}

function marksForElement(
  element: HTMLElement,
  sourceMarks: EditorJson["marks"],
): EditorJson["marks"] {
  const marks = [...(sourceMarks ?? [])];
  const tag = element.tagName.toLowerCase();
  const style = element.style;
  const decoration = `${style.textDecoration} ${style.textDecorationLine}`;

  if (tag === "strong" || tag === "b" || isBoldFontWeight(style.fontWeight)) {
    addMark(marks, { type: "bold" });
  }
  if (tag === "em" || tag === "i" || style.fontStyle === "italic")
    addMark(marks, { type: "italic" });
  if (tag === "u" || decoration.includes("underline")) addMark(marks, { type: "underline" });
  if (tag === "s" || tag === "del" || tag === "strike" || decoration.includes("line-through")) {
    addMark(marks, { type: "strike" });
  }
  if (tag === "code") addMark(marks, { type: "code" });
  if (tag === "sub" || style.verticalAlign === "sub") addMark(marks, { type: "subscript" });
  if (tag === "sup" || style.verticalAlign === "super") addMark(marks, { type: "superscript" });
  if (tag === "mark" || style.backgroundColor.length > 0) {
    addMark(marks, {
      type: "highlight",
      attrs: { color: style.backgroundColor || "#fef08a" },
    });
  }
  if (style.color.length > 0) addMark(marks, { type: "textStyle", attrs: { color: style.color } });

  return marks;
}

function flushLooseInline(blocks: EditorJson[], inline: EditorJson[]) {
  if (inline.length === 0) return;
  blocks.push({ type: "paragraph", content: textContentOrEmpty(mergeAdjacentTextNodes(inline)) });
  inline.splice(0, inline.length);
}

function textContentOrEmpty(content: EditorJson[]) {
  return content.length === 0 ? [{ type: "text", text: "" }] : content;
}

function mergeAdjacentTextNodes(content: EditorJson[]): EditorJson[] {
  const merged: EditorJson[] = [];

  for (const node of content) {
    const previous = merged.at(-1);
    if (
      previous?.type === "text" &&
      node.type === "text" &&
      JSON.stringify(previous.marks ?? []) === JSON.stringify(node.marks ?? [])
    ) {
      previous.text = `${previous.text ?? ""}${node.text ?? ""}`;
    } else {
      merged.push(cloneEditorJson(node));
    }
  }

  return merged;
}

function addMark(
  marks: NonNullable<EditorJson["marks"]>,
  mark: NonNullable<EditorJson["marks"]>[number],
) {
  if (!marks.some((candidate) => candidate.type === mark.type)) marks.push(mark);
}

function isHtmlBlockElement(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  return (
    tag === "p" ||
    tag === "div" ||
    tag === "blockquote" ||
    tag === "li" ||
    tag === "br" ||
    tag === "table" ||
    tag === "tr" ||
    tag === "td" ||
    tag === "th" ||
    isHeadingTag(tag)
  );
}

function isHeadingTag(tag: string) {
  return (
    tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6"
  );
}

function isBoldFontWeight(value: string) {
  if (value === "bold" || value === "bolder") return true;
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric >= 600;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll(";", "");
}

function cloneSelectedNode(
  node: EditorJson,
  path: number[],
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
): EditorJson | undefined {
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
    .filter((child): child is EditorJson => child !== undefined);
  if (content.length === 0) return undefined;

  return {
    type: node.type,
    ...(node.attrs === undefined
      ? {}
      : { attrs: JSON.parse(JSON.stringify(node.attrs)) as Record<string, unknown> }),
    content,
  };
}

function normalizeTextPath(doc: EditorJson, path: number[]): number[] {
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

function normalizeTextPointForOffset(
  doc: EditorJson,
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

function firstTextPath(node: EditorJson, path: string): string {
  const textIndex = node.content?.findIndex((child) => child.type === "text") ?? -1;
  return textIndex >= 0 ? `${path}.${textIndex}` : `${path}.0`;
}

function editorContentFromFragment(fragment: EditorJson): EditorJson[] {
  const content = fragment.type === "doc" ? (fragment.content ?? []) : [fragment];
  return content.map(cloneEditorJson).filter(hasTextContent);
}

function insertContentAtPoint(
  doc: EditorJson,
  selection: EditorSelection,
  content: EditorJson[],
): { doc: EditorJson; selection: EditorSelection } {
  const inlineContent = inlineContentForInlinePaste(content);
  if (inlineContent !== undefined) {
    return insertInlineContentAtPoint(doc, selection, inlineContent);
  }

  const blockPath = currentTextBlockPath(doc, selection.path);
  if (blockPath === undefined) {
    const nextDoc = cloneEditorJson(doc);
    nextDoc.content = [...(nextDoc.content ?? []), ...content.map(cloneEditorJson)];
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
  const nextDoc = cloneEditorJson(doc);
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  if (nextParent?.content === undefined) return { doc, selection };

  const leftContent = [
    ...block.content.slice(0, textIndex).map(cloneEditorJson),
    ...textNodeSegment(textNode, 0, offset),
  ];
  const rightContent = [
    ...textNodeSegment(textNode, offset, text.length),
    ...block.content.slice(textIndex + 1).map(cloneEditorJson),
  ];
  const replacement = [
    ...textBlockFromNonEmptyContent(block, leftContent),
    ...content.map(cloneEditorJson),
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
  doc: EditorJson,
  selection: EditorSelection,
  content: EditorJson[],
): { doc: EditorJson; selection: EditorSelection } {
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
  const nextDoc = cloneEditorJson(doc);
  const nextBlock = getNodeAtPath(nextDoc, blockPath);
  if (nextBlock?.content === undefined) return { doc, selection };

  const leftContent = [
    ...block.content.slice(0, textIndex).map(cloneEditorJson),
    ...textNodeSegment(textNode, 0, offset),
  ];
  const rightContent = [
    ...textNodeSegment(textNode, offset, text.length),
    ...block.content.slice(textIndex + 1).map(cloneEditorJson),
  ];
  const insertedIndex = leftContent.length;
  const merged = mergeTextNodesWithPoint(
    [...leftContent, ...content.map(cloneEditorJson), ...rightContent],
    insertedIndex + content.length - 1,
    getTextAtPath({ type: "doc", content }, [content.length - 1]),
  );

  nextBlock.content = merged.content;

  return {
    doc: nextDoc,
    selection: { path: [...blockPath, merged.pointIndex], offset: merged.offset },
  };
}

function inlineContentForInlinePaste(content: EditorJson[]) {
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
    ? textContent.map(cloneEditorJson)
    : undefined;
}

function mergeTextNodesWithPoint(content: EditorJson[], targetIndex: number, targetOffset: string) {
  const merged: EditorJson[] = [];
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

    merged.push(cloneEditorJson(node));
    if (index === targetIndex) {
      pointIndex = merged.length - 1;
      offset = targetOffset.length;
    }
  }

  return { content: merged, pointIndex, offset };
}

function sameMarks(left: EditorJson["marks"], right: EditorJson["marks"]) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function textBlockFromNonEmptyContent(block: EditorJson, content: EditorJson[]) {
  return hasTextContent({ type: block.type, content })
    ? [createTextBlockFromContent(block, content)]
    : [];
}

function selectionAtEndOfInsertedContent(
  content: EditorJson[],
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

function lastTextPathInNode(
  node: EditorJson | undefined,
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

function firstTextSelectionInNode(node: EditorJson | undefined, path: number[]): EditorSelection {
  return firstTextPathInNode(node, path) ?? { path, offset: 0 };
}

function firstTextPathInNode(
  node: EditorJson | undefined,
  path: number[],
): EditorSelectionPoint | undefined {
  if (node?.type === "text") return { path, offset: 0 };

  for (const [index, child] of (node?.content ?? []).entries()) {
    const point = firstTextPathInNode(child, [...path, index]);
    if (point !== undefined) return point;
  }

  return undefined;
}

function nearestTextSelection(doc: EditorJson, deletedPath: number[]): EditorSelection {
  return (
    firstTextPathInNode(doc.content?.[deletedPath[0] ?? 0], [deletedPath[0] ?? 0]) ??
    firstTextPathInNode(doc, []) ?? { path: [0, 0], offset: 0 }
  );
}

function hasTextContent(node: EditorJson): boolean {
  if (node.type === "text") return (node.text ?? "").length > 0;
  return (node.content ?? []).some(hasTextContent);
}

function createTextParagraph(text: string, marks?: EditorJson["marks"]): EditorJson {
  return { type: "paragraph", content: [createTextNode(text, marks)] };
}

function createTextBlockFromContent(source: EditorJson, content: EditorJson[]): EditorJson {
  return {
    type: source.type,
    ...(source.attrs === undefined
      ? {}
      : { attrs: JSON.parse(JSON.stringify(source.attrs)) as Record<string, unknown> }),
    content: content.length === 0 ? [{ type: "text", text: "" }] : content,
  };
}

function textNodeSegment(node: EditorJson, from: number, to: number): EditorJson[] {
  const text = node.text ?? "";
  const segment = text.slice(from, to);
  return segment.length === 0 ? [] : [createTextNode(segment, node.marks)];
}

function createTextNode(text: string, marks: EditorJson["marks"]): EditorJson {
  return {
    type: "text",
    text,
    ...(marks === undefined || marks.length === 0
      ? {}
      : { marks: JSON.parse(JSON.stringify(marks)) as EditorJson["marks"] }),
  };
}

function cloneEditorJson(doc: EditorJson): EditorJson {
  return JSON.parse(JSON.stringify(doc)) as EditorJson;
}

function clampOffset(offset: number, text: string) {
  return Math.max(0, Math.min(offset, text.length));
}
