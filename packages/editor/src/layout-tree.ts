import type { Extensions, JSONContent } from "@skriva/core";
import { Document } from "@skriva/extension-document";
import { createHorizontalRuleNode } from "@skriva/extension-horizontal-rule";
import { Paragraph } from "@skriva/extension-paragraph";
import { createTableNode, type TableCellNode } from "@skriva/extension-table";
import { Text } from "@skriva/extension-text";
import type {
  BoxNode,
  InlineTextNode,
  LayoutNode,
  LayoutStyle,
  TextNode,
  TextStyle,
} from "@skriva/layout";
import {
  defaultEditorMarkExtensions,
  editorTextStyleAttrsFromMarks,
  type EditorMarkExtension,
  type EditorMarkSpec,
  type EditorTextStyleAttributes,
} from "./font-attributes.ts";
import {
  BLOCKQUOTE_BORDER_COLOR,
  BLOCKQUOTE_BORDER_WIDTH,
  BLOCKQUOTE_PADDING_LEFT,
  BLOCKQUOTE_VERTICAL_MARGIN,
  DEFAULT_HEADING_FONT_WEIGHT,
  DEFAULT_TABLE_BORDER_COLOR,
  DEFAULT_TABLE_BORDER_WIDTH,
  EMPTY_BLOCK_GAP,
  HEADING_BOTTOM_MARGIN,
  HORIZONTAL_RULE_HEIGHT,
  HORIZONTAL_RULE_VERTICAL_MARGIN,
  LARGE_HEADING_TOP_MARGIN,
  MIN_PAGE_BREAK_SPACER_HEIGHT,
  SMALL_HEADING_TOP_MARGIN,
} from "./constants.js";
import { headingLevel, tableColwidth, tableSpan } from "./model.ts";

export type CreateEditorLayoutTreeOptions = {
  rootStyle?: LayoutStyle;
  paragraphStyle?: LayoutStyle;
  textStyle?: TextStyle;
  fontStyles?: Record<string, TextStyle>;
  markExtensions?: EditorMarkExtension[];
  resolveTextStyle?: (attrs: EditorTextStyleAttributes) => TextStyle | undefined;
};

type EditorNodeContext = {
  node: JSONContent;
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
    fontWeight: DEFAULT_HEADING_FONT_WEIGHT,
  };
}

export function createEditorLayoutTree(
  doc: JSONContent,
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

export type PageBreakSpacerHeightOptions = {
  remainingHeight: number;
  precedingBlockGap?: number;
};

export function pageBreakSpacerHeightForRemainingPage({
  remainingHeight,
  precedingBlockGap = EMPTY_BLOCK_GAP,
}: PageBreakSpacerHeightOptions) {
  return Math.max(MIN_PAGE_BREAK_SPACER_HEIGHT, Math.floor(remainingHeight - precedingBlockGap));
}

export function createBarebonesEditorExtensions(): Extensions {
  return [Document.tiptap, Paragraph.tiptap, Text.tiptap].filter(
    (extension): extension is NonNullable<typeof extension> => extension !== undefined,
  );
}

function convertBlockChildren(
  children: JSONContent[] | undefined,
  options: CreateEditorLayoutTreeOptions,
  path = "",
): LayoutNode[] {
  return (children ?? []).flatMap((child, index) =>
    convertEditorNode(child, options, path.length === 0 ? String(index) : `${path}.${index}`),
  );
}

function convertEditorNode(
  node: JSONContent,
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
        style: {
          margin: { vertical: HORIZONTAL_RULE_VERTICAL_MARGIN },
          height: HORIZONTAL_RULE_HEIGHT,
        },
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
  node: JSONContent,
  options: CreateEditorLayoutTreeOptions,
  path: string,
) {
  return createTableNode({
    id: path,
    borderColor: DEFAULT_TABLE_BORDER_COLOR,
    borderWidth: DEFAULT_TABLE_BORDER_WIDTH,
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
  node: JSONContent,
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
      margin: mergeEdges(options.paragraphStyle?.margin, {
        top: level <= 2 ? LARGE_HEADING_TOP_MARGIN : SMALL_HEADING_TOP_MARGIN,
        bottom: HEADING_BOTTOM_MARGIN,
      }),
      flexDirection: options.paragraphStyle?.flexDirection ?? "column",
    },
    children,
  };
}

function createBlockquoteBox(children: LayoutNode[], path: string): BoxNode {
  return {
    type: "box",
    id: path,
    blockquoteBorderColor: BLOCKQUOTE_BORDER_COLOR,
    blockquoteBorderWidth: BLOCKQUOTE_BORDER_WIDTH,
    style: {
      flexDirection: "column",
      padding: { left: BLOCKQUOTE_PADDING_LEFT },
      margin: { vertical: BLOCKQUOTE_VERTICAL_MARGIN },
    },
    children,
  } as BoxNode;
}

function createParagraphBoxFromNode(
  node: JSONContent,
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

function firstTextPath(node: JSONContent, path: string): string {
  const textIndex = node.content?.findIndex((child) => child.type === "text") ?? -1;
  return textIndex >= 0 ? `${path}.${textIndex}` : `${path}.0`;
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
  node: JSONContent,
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
  node: JSONContent,
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
