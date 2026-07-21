import { Extension, type SkrivaExtension } from "@skriva/core";
import { Fragment, Slice, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";

const emptyLineSentinel = "\u200b";

export const GoogleDocsPaste: SkrivaExtension = {
  name: "googleDocsPaste",
  tiptap: Extension.create({
    name: "googleDocsPaste",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            transformPastedHTML(html) {
              return normalizeGoogleDocsPasteHtml(html);
            },
            transformPasted(slice) {
              return stripEmptyLineSentinels(slice);
            },
          },
        }),
      ];
    },
  } as Parameters<typeof Extension.create>[0]),
};

export function normalizeGoogleDocsPasteHtml(html: string) {
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  unwrapBlockCodeMarkers(doc.body);
  removeBlockBackgroundStyles(doc.body);
  removeDominantInlineBackground(doc.body);
  preserveStandaloneBreaks(doc.body);
  preserveEmptyParagraphs(doc.body);
  return doc.body.innerHTML;
}

function unwrapBlockCodeMarkers(root: HTMLElement) {
  for (const element of Array.from(root.querySelectorAll("code, kbd, samp, tt"))) {
    if (!(element instanceof HTMLElement) || !hasBlockChild(element)) continue;
    element.replaceWith(...Array.from(element.childNodes));
  }
}

function preserveEmptyParagraphs(root: HTMLElement) {
  for (const element of Array.from(root.querySelectorAll("p, div"))) {
    if (!(element instanceof HTMLElement) || !isVisuallyEmptyBlock(element)) continue;
    element.replaceChildren(document.createTextNode(emptyLineSentinel));
  }
}

function preserveStandaloneBreaks(root: HTMLElement) {
  for (const br of Array.from(root.querySelectorAll("br"))) {
    if (!(br instanceof HTMLBRElement)) continue;

    const parent = br.parentElement;
    if (
      parent === null ||
      isVisuallyEmptyBlock(parent) ||
      (parent !== root && !hasBlockChild(parent) && hasVisibleSiblingText(br))
    ) {
      continue;
    }

    const paragraph = document.createElement("p");
    paragraph.appendChild(document.createTextNode(emptyLineSentinel));
    br.replaceWith(paragraph);
  }
}

function stripEmptyLineSentinels(slice: Slice) {
  return new Slice(
    mapFragment(slice.content, stripEmptyLineSentinelFromNode),
    slice.openStart,
    slice.openEnd,
  );
}

function stripEmptyLineSentinelFromNode(node: ProseMirrorNode): ProseMirrorNode | null {
  if (node.isText) {
    const text = (node.text ?? "").replaceAll(emptyLineSentinel, "");
    return text.length === 0 ? null : node.type.schema.text(text, node.marks);
  }

  if (node.isLeaf) return node;
  return node.copy(mapFragment(node.content, stripEmptyLineSentinelFromNode));
}

function mapFragment(
  fragment: Fragment,
  mapNode: (node: ProseMirrorNode) => ProseMirrorNode | null,
) {
  const children: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    const next = mapNode(node);
    if (next !== null) children.push(next);
  });
  return Fragment.fromArray(children);
}

function removeBlockBackgroundStyles(root: HTMLElement) {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (!(element instanceof HTMLElement)) continue;
    if (!isBlockElement(element) && !hasBlockChild(element)) continue;
    element.style.backgroundColor = "";
    element.style.removeProperty("background-color");
  }
}

function hasVisibleSiblingText(node: ChildNode) {
  const siblings = Array.from(node.parentNode?.childNodes ?? []);
  return siblings.some((sibling) => sibling !== node && visibleText(sibling).length > 0);
}

function visibleText(node: ChildNode) {
  return (node.textContent ?? "").replaceAll("\u00a0", "").trim();
}

function removeDominantInlineBackground(root: HTMLElement) {
  const spans = Array.from(root.querySelectorAll("span")).filter(
    (element): element is HTMLSpanElement =>
      element instanceof HTMLSpanElement &&
      element.style.backgroundColor.length > 0 &&
      !hasBlockChild(element) &&
      (element.textContent ?? "").trim().length > 0,
  );
  if (spans.length < 2) return;

  const textLengthByBackground = new Map<string, number>();
  let totalTextLength = 0;

  for (const span of spans) {
    const textLength = (span.textContent ?? "").trim().length;
    totalTextLength += textLength;
    textLengthByBackground.set(
      span.style.backgroundColor,
      (textLengthByBackground.get(span.style.backgroundColor) ?? 0) + textLength,
    );
  }

  const dominant = Array.from(textLengthByBackground.entries()).find(
    ([, textLength]) => textLength / Math.max(1, totalTextLength) >= 0.8,
  )?.[0];
  if (dominant === undefined) return;

  for (const span of spans) {
    if (span.style.backgroundColor !== dominant) continue;
    span.style.backgroundColor = "";
    span.style.removeProperty("background-color");
  }
}

function hasBlockChild(element: HTMLElement) {
  return Array.from(element.children).some((child) => isBlockElement(child));
}

function isVisuallyEmptyBlock(element: HTMLElement) {
  const text = (element.textContent ?? "").replaceAll("\u00a0", "").trim();
  if (text.length > 0) return false;

  return Array.from(element.querySelectorAll("*")).every(
    (child) =>
      child instanceof HTMLElement &&
      (child.tagName.toLowerCase() === "br" || isInlineElement(child)),
  );
}

function isBlockElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  return (
    tag === "address" ||
    tag === "article" ||
    tag === "aside" ||
    tag === "blockquote" ||
    tag === "div" ||
    tag === "dl" ||
    tag === "figure" ||
    tag === "h1" ||
    tag === "h2" ||
    tag === "h3" ||
    tag === "h4" ||
    tag === "h5" ||
    tag === "h6" ||
    tag === "hr" ||
    tag === "ol" ||
    tag === "p" ||
    tag === "pre" ||
    tag === "table" ||
    tag === "ul"
  );
}

function isInlineElement(element: HTMLElement) {
  return !isBlockElement(element);
}
