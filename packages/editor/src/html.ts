import { getSelectedContent } from "./selection.ts";
import { cloneJsonContent, headingLevel, type JSONContent, type EditorSelection } from "./model.ts";
import { editorContentFromFragment } from "./paste.ts";

export function getSelectedHtml(doc: JSONContent, selection: EditorSelection): string {
  const content = getSelectedContent(doc, selection);
  return content === undefined ? "" : serializeEditorHtml(content);
}

export function serializeEditorHtml(fragment: JSONContent): string {
  return editorContentFromFragment(fragment).map(serializeBlockHtml).join("");
}

export function parseEditorHtml(html: string): JSONContent | undefined {
  if (html.trim().length === 0 || typeof DOMParser === "undefined") return undefined;

  const body = new DOMParser().parseFromString(html, "text/html").body;
  const content = parseHtmlChildren(body, []);
  return content.length === 0 ? undefined : { type: "doc", content };
}

function serializeBlockHtml(node: JSONContent): string {
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

function serializeTableRowHtml(node: JSONContent): string {
  if (node.type !== "tableRow") return "";
  return `<tr>${(node.content ?? []).map(serializeTableCellHtml).join("")}</tr>`;
}

function serializeTableCellHtml(node: JSONContent): string {
  const tag = node.type === "tableHeader" ? "th" : "td";
  if (node.type !== "tableCell" && node.type !== "tableHeader") return "";
  return `<${tag}>${(node.content ?? []).map(serializeBlockHtml).join("")}</${tag}>`;
}

function serializeInlineHtml(content: JSONContent[]): string {
  return content.map(serializeInlineNodeHtml).join("");
}

function serializeInlineNodeHtml(node: JSONContent): string {
  if (node.type !== "text") return serializeInlineHtml(node.content ?? []);

  return (node.marks ?? []).reduceRight(
    (html, mark) => wrapMarkHtml(html, mark),
    escapeHtml(node.text ?? ""),
  );
}

function wrapMarkHtml(html: string, mark: NonNullable<JSONContent["marks"]>[number]) {
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

function parseHtmlChildren(parent: ParentNode, marks: JSONContent["marks"]): JSONContent[] {
  const blocks: JSONContent[] = [];
  const looseInline: JSONContent[] = [];

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

function parseHtmlBlock(element: HTMLElement, marks: JSONContent["marks"]): JSONContent[] {
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

function parseTableRow(element: Element, marks: JSONContent["marks"]): JSONContent[] {
  if (!(element instanceof HTMLElement) || element.tagName.toLowerCase() !== "tr") return [];
  const content = Array.from(element.children).flatMap((cell) => parseTableCell(cell, marks));
  return content.length === 0 ? [] : [{ type: "tableRow", content }];
}

function parseTableCell(element: Element, marks: JSONContent["marks"]): JSONContent[] {
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

function parseHtmlInlineChildren(parent: ParentNode, marks: JSONContent["marks"]): JSONContent[] {
  const content: JSONContent[] = [];

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

function parseTextNode(node: Node, marks: JSONContent["marks"]): JSONContent[] {
  const text = (node.textContent ?? "").replaceAll("\u00a0", " ");
  if (text.length === 0 || text.trim().length === 0) return [];
  return [{ type: "text", text, ...(marks?.length ? { marks } : {}) }];
}

function marksForElement(
  element: HTMLElement,
  sourceMarks: JSONContent["marks"],
): JSONContent["marks"] {
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

function flushLooseInline(blocks: JSONContent[], inline: JSONContent[]) {
  if (inline.length === 0) return;
  blocks.push({ type: "paragraph", content: textContentOrEmpty(mergeAdjacentTextNodes(inline)) });
  inline.splice(0, inline.length);
}

function textContentOrEmpty(content: JSONContent[]) {
  return content.length === 0 ? [{ type: "text", text: "" }] : content;
}

function mergeAdjacentTextNodes(content: JSONContent[]): JSONContent[] {
  const merged: JSONContent[] = [];

  for (const node of content) {
    const previous = merged.at(-1);
    if (
      previous?.type === "text" &&
      node.type === "text" &&
      JSON.stringify(previous.marks ?? []) === JSON.stringify(node.marks ?? [])
    ) {
      previous.text = `${previous.text ?? ""}${node.text ?? ""}`;
    } else {
      merged.push(cloneJsonContent(node));
    }
  }

  return merged;
}

function addMark(
  marks: NonNullable<JSONContent["marks"]>,
  mark: NonNullable<JSONContent["marks"]>[number],
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
