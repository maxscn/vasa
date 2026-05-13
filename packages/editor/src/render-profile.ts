import type { FontCatalog, SkrivaFont } from "@skriva/font";
import { createFontCatalog } from "@skriva/font";
import {
  layoutDocument,
  type AnyLayoutExtension,
  type BoxNode,
  type LayoutNode,
  type LayoutOptions,
  type TextMeasurer,
  type TextStyle,
} from "@skriva/layout";
import type { EditorMarkExtension, EditorTextStyleAttributes } from "./font-attributes.ts";
import { createEditorLayoutTree } from "./layout-tree.ts";
import type { JSONContent } from "@skriva/core";
import {
  createEditorRenderTextStyle,
  createEditorTextStyleResolver,
  resolveEditorCanvasTextPaint,
  resolveEditorPdfOutlineText,
  resolveEditorTextStyle,
  textStyleAttrsForSourceId as resolveTextStyleAttrsForSourceId,
  type EditorCanvasTextPaint,
  type EditorPdfOutlineText,
  type EditorRenderProfileOptions,
  type EditorRenderTextNodeSource,
  type EditorTextBoxSource,
} from "./style-resolver.ts";

export {
  createEditorTextStyleResolver,
  createEditorRenderTextStyle,
  resolveEditorCanvasTextPaint,
  resolveEditorPdfOutlineText,
  resolveEditorTextStyle,
  type EditorCanvasTextPaint,
  type EditorPdfOutlineText,
  type EditorRenderProfileOptions,
  type EditorRenderTextNodeSource,
  type EditorTextBoxSource,
  type EditorTextLineSource,
  type EditorTextStylesheet,
  type EditorTextStylesheetContext,
} from "./style-resolver.ts";

export type CreateEditorRenderDocumentOptions<TRenderDocument, TRendererExtension = unknown> = {
  doc: JSONContent;
  page: LayoutOptions["page"];
  measurer: TextMeasurer;
  profile: EditorRenderProfileOptions;
  rootStyle?: BoxNode["style"];
  paragraphStyle?: BoxNode["style"];
  extraChildren?: LayoutNode[];
  layoutExtensions?: AnyLayoutExtension[];
  markExtensions?: EditorMarkExtension[];
  rendererExtensions?: TRendererExtension[];
  textGrid?: boolean;
  createRenderDocument: (
    layout: ReturnType<typeof layoutDocument>,
    options: { extensions?: TRendererExtension[] },
  ) => TRenderDocument;
};

export type EditorRenderDocumentContract<TRenderDocument> = {
  layoutTree: BoxNode;
  layout: ReturnType<typeof layoutDocument>;
  renderDocument: TRenderDocument;
  canvasTextPaint: (box: EditorTextBoxSource, lineIndex: number) => EditorCanvasTextPaint;
  pdfOutlineText: (
    node: EditorRenderTextNodeSource,
    lineIndex: number,
  ) => EditorPdfOutlineText | undefined;
};

const defaultFontCatalogCache = new WeakMap<EditorRenderProfileOptions, FontCatalog>();

export function createEditorRenderDocument<TRenderDocument, TRendererExtension = unknown>(
  options: CreateEditorRenderDocumentOptions<TRenderDocument, TRendererExtension>,
): EditorRenderDocumentContract<TRenderDocument> {
  return createEditorRenderPipeline(options);
}

export function createEditorRenderPipeline<TRenderDocument, TRendererExtension = unknown>(
  options: CreateEditorRenderDocumentOptions<TRenderDocument, TRendererExtension>,
): EditorRenderDocumentContract<TRenderDocument> {
  const textStyle = createEditorRenderTextStyle(options.profile);
  const styleResolver = createEditorTextStyleResolver({
    profile: options.profile,
    doc: options.doc,
    markExtensions: options.markExtensions,
  });
  const tree = createEditorLayoutTree(options.doc, {
    rootStyle: options.rootStyle,
    paragraphStyle: options.paragraphStyle,
    textStyle,
    markExtensions: options.markExtensions,
    resolveTextStyle: styleResolver.resolveTextStyle,
  });
  const layoutTree =
    options.extraChildren === undefined || options.extraChildren.length === 0
      ? tree
      : { ...tree, children: [...(tree.children ?? []), ...options.extraChildren] };
  const layout = layoutDocument(layoutTree, {
    page: options.page,
    measurer: options.measurer,
    extensions: options.layoutExtensions,
    textGrid: options.textGrid ?? false,
  } as LayoutOptions & { textGrid: boolean });
  const renderDocument = options.createRenderDocument(layout, {
    extensions: options.rendererExtensions,
  });

  return {
    layoutTree,
    layout,
    renderDocument,
    canvasTextPaint: styleResolver.canvasTextPaint,
    pdfOutlineText: styleResolver.pdfOutlineText,
  };
}

export function createEditorRenderResolveTextStyle(options: EditorRenderProfileOptions) {
  return (attrs: EditorTextStyleAttributes): TextStyle => resolveEditorTextStyle(options, attrs);
}

export function createEditorCanvasTextPaint(
  doc: JSONContent,
  options: EditorRenderProfileOptions,
  box: EditorTextBoxSource,
  lineIndex: number,
): EditorCanvasTextPaint {
  const line = box.lines?.[lineIndex];
  const attrs = textStyleAttrsForSourceId(doc, line?.sourceId ?? box.id);
  return resolveEditorCanvasTextPaint(options, attrs, line);
}

export function createEditorPdfOutlineText(
  doc: JSONContent,
  options: EditorRenderProfileOptions,
  node: EditorRenderTextNodeSource,
  lineIndex: number,
): EditorPdfOutlineText | undefined {
  const line = node.lines[lineIndex];
  const attrs = textStyleAttrsForSourceId(doc, line?.sourceId ?? node.sourceId);
  return resolveEditorPdfOutlineText(options, attrs, line);
}

export function textStyleAttrsForSourceId(
  doc: JSONContent,
  sourceId: string | undefined,
): EditorTextStyleAttributes {
  return resolveTextStyleAttrsForSourceId(doc, sourceId);
}

export function createEditorCanvasTextMeasurer(
  measureText: (text: string, font?: string) => number,
): TextMeasurer {
  const cache = new Map<string, ReturnType<TextMeasurer["measureText"]>>();
  const cacheLimit = 2000;

  return {
    measureText(input) {
      const cacheKey = [
        input.text,
        input.font,
        input.lineHeight,
        input.maxWidth,
        input.whiteSpace,
        input.wordBreak,
        input.letterSpacing,
      ].join("\u0000");
      const cached = cache.get(cacheKey);
      if (cached !== undefined) return cached;

      const maxWidth = Math.max(1, input.maxWidth);
      const rawLines =
        input.whiteSpace === "pre-wrap"
          ? input.text.split("\n")
          : [input.text.replaceAll(/\s+/g, " ").trim()];
      const lines = rawLines.flatMap((line, index) =>
        wrapMeasuredLineWithStarts(measureText, line, maxWidth, input.font).map((wrappedLine) => ({
          ...wrappedLine,
          start: lineStartOffset(rawLines, index) + wrappedLine.start,
        })),
      );

      const result = {
        width: lines.reduce((max, line) => Math.max(max, measureText(line.text, input.font)), 0),
        height: lines.length * input.lineHeight,
        lineCount: lines.length,
        lines: lines.map((line) => ({
          text: line.text,
          start: line.start,
          width: measureText(line.text, input.font),
        })),
      };
      if (cache.size >= cacheLimit) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) cache.delete(oldestKey);
      }
      cache.set(cacheKey, result);
      return result;
    },
  };
}

export function createEditorRenderTextMeasurer(
  options: EditorRenderProfileOptions,
  fallbackMeasureText?: (text: string, font?: string) => number,
): TextMeasurer {
  return createEditorCanvasTextMeasurer(
    createEditorRenderMeasureText(options, fallbackMeasureText),
  );
}

export function createEditorRenderMeasureText(
  options: EditorRenderProfileOptions,
  fallbackMeasureText?: (text: string, font?: string) => number,
) {
  return (text: string, font?: string) => {
    const fontSize = parseCssFontSize(font) ?? options.fontSize;
    const fontFace = fontForCssFont(options, font);
    if (fontFace?.outlineFont !== undefined) {
      return measureOutlineText(
        fontFace.outlineFont,
        text,
        fontSize,
        isItalicFontStyle(parseCssFontStyle(font)),
      );
    }

    return fallbackMeasureText?.(text, font) ?? text.length * fontSize * 0.5;
  };
}

function editorRenderDefaultFont(options: EditorRenderProfileOptions) {
  return fontById(options, options.defaultFontId);
}

function fontById(options: EditorRenderProfileOptions, fontId: string) {
  return options.fonts.find((font) => font.id === fontId) ?? options.fallbackFont;
}

function fontForCssFont(options: EditorRenderProfileOptions, font: string | undefined) {
  const style = parseCssFontStyle(font);
  const weight = parseCssFontWeight(font);
  const catalog = editorFontCatalog(options);

  for (const family of cssFontFamilies(font)) {
    const registeredFamily = options.fonts.find(
      (candidate) => normalizeCssFontFamily(candidate.family) === family,
    )?.family;
    if (registeredFamily === undefined) continue;

    return catalog.resolveFace({
      family: registeredFamily,
      weight: weight ?? "400",
      style: style ?? "normal",
    });
  }

  return editorRenderDefaultFont(options);
}

function editorFontCatalog(options: EditorRenderProfileOptions) {
  if (options.fontCatalog !== undefined) return options.fontCatalog;

  const cached = defaultFontCatalogCache.get(options);
  if (cached !== undefined) return cached;

  const catalog = createFontCatalog({
    fonts: options.fonts,
    controlledFamilies: [],
  });
  defaultFontCatalogCache.set(options, catalog);
  return catalog;
}

function cssFontFamilies(font: string | undefined) {
  const source = font ?? "";
  const sizeMatch = /(?:^|\s)(\d+(?:\.\d+)?)px(?:\/|\s|$)/.exec(source);
  if (sizeMatch === null) return [];

  return splitCssFontFamilyList(source.slice(sizeMatch.index + sizeMatch[0].length))
    .map(normalizeCssFontFamily)
    .filter((family) => family.length > 0);
}

function splitCssFontFamilyList(source: string) {
  const families: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === undefined) continue;

    if (quote !== undefined) {
      current += character;
      if (character === "\\" && source[index + 1] !== undefined) {
        current += source[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }

    if (character === ",") {
      families.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  families.push(current);
  return families;
}

function normalizeCssFontFamily(family: string) {
  const trimmed = family.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted.replaceAll(/\\(["'\\])/g, "$1").toLowerCase();
}

function measureOutlineText(
  font: NonNullable<SkrivaFont["outlineFont"]>,
  text: string,
  fontSize: number,
  includeRightOverhang = false,
) {
  let inkRight = 0;
  const advance = Array.from(text).reduce((width, character) => {
    const glyph = font.source.charToGlyph(character);
    if (includeRightOverhang) {
      const path = glyph.getPath(width, 0, fontSize, undefined, font.source);
      const bounds = openTypePathXBounds(path.commands);
      if (bounds !== undefined) inkRight = Math.max(inkRight, bounds.maxX);
    }
    return width + (glyph.advanceWidth / font.unitsPerEm) * fontSize;
  }, 0);
  return includeRightOverhang ? Math.max(advance, inkRight) : advance;
}

type OutlineFont = NonNullable<SkrivaFont["outlineFont"]>;
type OutlinePathCommand = ReturnType<
  ReturnType<OutlineFont["source"]["charToGlyph"]>["getPath"]
>["commands"][number];

function openTypePathXBounds(commands: OutlinePathCommand[]) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;

  for (const command of commands) {
    for (const x of openTypeCommandXValues(command)) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  return Number.isFinite(minX) && Number.isFinite(maxX) ? { minX, maxX } : undefined;
}

function openTypeCommandXValues(command: OutlinePathCommand) {
  switch (command.type) {
    case "M":
    case "L":
      return [command.x];
    case "C":
      return [command.x1, command.x2, command.x];
    case "Q":
      return [command.x1, command.x];
    case "Z":
      return [];
  }
  return [];
}

function parseCssFontSize(font: string | undefined) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font ?? "");
  return match === null ? undefined : Number(match[1]);
}

function parseCssFontStyle(font: string | undefined) {
  const source = font ?? "";
  const sizeMatch = /(?:^|\s)(\d+(?:\.\d+)?)px(?:\/|\s|$)/.exec(source);
  const prefix = sizeMatch === null ? source : source.slice(0, sizeMatch.index);
  if (/(^|\s)italic(\s|$)/.test(prefix)) return "italic";
  if (/(^|\s)oblique(\s|$)/.test(prefix)) return "oblique";
  if (/(^|\s)normal(\s|$)/.test(prefix)) return "normal";
  return undefined;
}

function isItalicFontStyle(style: string | undefined) {
  return style === "italic" || style === "oblique";
}

function parseCssFontWeight(font: string | undefined) {
  const source = font ?? "";
  const sizeMatch = /(?:^|\s)(\d+(?:\.\d+)?)px(?:\/|\s|$)/.exec(source);
  const prefix = sizeMatch === null ? source : source.slice(0, sizeMatch.index);
  const numeric = /(?:^|\s)([1-9]00)(?:\s|$)/.exec(prefix)?.[1];
  if (numeric !== undefined) return numeric;
  if (/(^|\s)bold(\s|$)/.test(prefix)) return "700";
  if (/(^|\s)normal(\s|$)/.test(prefix)) return "400";
  return undefined;
}

function wrapMeasuredLineWithStarts(
  measureText: (text: string, font?: string) => number,
  line: string,
  maxWidth: number,
  font?: string,
): Array<{ text: string; start: number }> {
  if (line.length === 0) return [{ text: "", start: 0 }];

  const tokens = [...line.matchAll(/\s+|\S+/g)].map((match) => ({
    text: match[0],
    start: match.index ?? 0,
  }));
  const wrapped: Array<{ text: string; start: number }> = [];
  let current: { text: string; start: number } | undefined;

  for (const token of tokens) {
    if (measureText(token.text, font) > maxWidth) {
      if (current !== undefined) {
        wrapped.push(current);
        current = undefined;
      }

      wrapped.push(
        ...breakMeasuredWordWithStarts(measureText, token.text, token.start, maxWidth, font),
      );
      continue;
    }

    if (current === undefined) {
      current = token;
      continue;
    }

    const candidate = `${current.text}${token.text}`;
    if (measureText(candidate, font) <= maxWidth) {
      current = { text: candidate, start: current.start };
    } else {
      wrapped.push(current);
      current = token;
    }
  }

  if (current !== undefined) wrapped.push(current);
  return wrapped;
}

function breakMeasuredWordWithStarts(
  measureText: (text: string, font?: string) => number,
  word: string,
  start: number,
  maxWidth: number,
  font?: string,
): Array<{ text: string; start: number }> {
  const lines: Array<{ text: string; start: number }> = [];
  let current = "";
  let currentStart = start;
  let cursor = start;

  for (const character of word) {
    const candidate = current + character;
    if (current.length > 0 && measureText(candidate, font) > maxWidth) {
      if (shouldKeepWithPreviousLineCharacter(character)) {
        current = candidate;
        cursor += character.length;
        continue;
      }

      lines.push({ text: current, start: currentStart });
      current = character;
      currentStart = cursor;
    } else {
      current = candidate;
    }
    cursor += character.length;
  }

  if (current.length > 0) lines.push({ text: current, start: currentStart });
  return lines;
}

function shouldKeepWithPreviousLineCharacter(character: string | undefined) {
  if (character === undefined || character.length === 0) return false;
  if (/\s/u.test(character)) return false;
  return !/[\p{L}\p{N}\p{M}]/u.test(character);
}

function lineStartOffset(lines: string[], index: number) {
  return lines.slice(0, index).reduce((offset, line) => offset + line.length + 1, 0);
}
