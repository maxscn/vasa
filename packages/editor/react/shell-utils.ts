import type { RenderDocument } from "@skriva/renderer";
import type { UseSkrivaEditorReturn } from "./use-editor.ts";

type JSONContentNodeLike = {
  type: string;
  content?: unknown[];
};

type RenderPage = RenderDocument["pages"][number];

export function preferredSelectableFonts(fonts: UseSkrivaEditorReturn["fonts"]) {
  return fonts.reduce<UseSkrivaEditorReturn["fonts"]>((selectable, font) => {
    const index = selectable.findIndex((candidate) => candidate.family === font.family);
    if (index === -1) return [...selectable, font];
    if (isPreferredSelectableFont(font, selectable[index])) {
      return selectable.map((candidate, candidateIndex) =>
        candidateIndex === index ? font : candidate,
      );
    }
    return selectable;
  }, []);
}

function isPreferredSelectableFont(
  font: UseSkrivaEditorReturn["fonts"][number],
  selected: UseSkrivaEditorReturn["fonts"][number] | undefined,
) {
  if (selected === undefined) return true;
  if (font.style === "normal" && selected.style !== "normal") return true;
  if (font.style !== selected.style) return false;
  return isRegularFontWeight(font.weight) && !isRegularFontWeight(selected.weight);
}

export function isSelectionInsideEditorNodeType(doc: unknown, path: number[], nodeType: string) {
  let node: unknown = doc;

  for (const index of path) {
    if (isJSONContentNode(node) && node.type === nodeType) return true;
    node = isJSONContentNode(node) ? node.content?.[index] : undefined;
  }

  return isJSONContentNode(node) && node.type === nodeType;
}

export function selectedRenderPageIndex(document: RenderDocument, selectionPathParts: number[]) {
  const selectionPath = selectionPathParts.join(".");
  const page = document.pages.find((candidate) =>
    renderPageContainsSourcePath(candidate, selectionPath),
  );

  return page?.index ?? document.pages[0]?.index ?? 0;
}

export function renderPageContainsSourcePath(page: RenderPage, selectionPath: string) {
  return findRenderNode(page.nodes, (sourceId) => {
    if (sourceId.length === 0) return false;
    return sourceId === selectionPath || selectionPath.startsWith(`${sourceId}.`);
  });
}

export function pageCanvasY(page: RenderPage, ordinal: number, pageGap: number) {
  return page.rect.y + ordinal * (page.rect.height + pageGap);
}

export function scrollEditorCanvasToPage(
  editor: UseSkrivaEditorReturn,
  pageIndex: number,
  behavior: ScrollBehavior,
) {
  const renderedPage = editor.renderDocument.pages.find(
    (candidate) => candidate.index === pageIndex,
  );
  const ordinal = editor.renderDocument.pages.findIndex(
    (candidate) => candidate.index === pageIndex,
  );
  const frame = editor.canvasRef.current?.parentElement;
  if (renderedPage === undefined || ordinal < 0 || frame === undefined || frame === null) return;

  const scale = canvasVisualScale(editor.canvasRef.current);
  const pageY = pageCanvasY(renderedPage, ordinal, editor.renderLineOptions.pageGap ?? 0);

  frame.scrollTo({ top: Math.max(0, pageY * scale - 24), behavior });
}

export function canvasVisualScale(canvas: HTMLCanvasElement | null) {
  if (canvas === null) return 1;

  const rect = canvas.getBoundingClientRect();
  const styleWidth = Number.parseFloat(canvas.style.width);

  return styleWidth > 0 ? rect.width / styleWidth : 1;
}

function findRenderNode(nodes: RenderPage["nodes"], match: (sourceId: string) => boolean) {
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.shift();
    if (node === undefined) continue;
    if (match(node.sourceId ?? "")) return true;
    stack.push(...node.children);
  }

  return false;
}

function isJSONContentNode(value: unknown): value is JSONContentNodeLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function isRegularFontWeight(weight: string | number | undefined) {
  return String(weight ?? "400") === "400";
}
