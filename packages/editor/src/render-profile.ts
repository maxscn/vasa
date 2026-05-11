import {
  createCanvasFontValue,
  createFontScriptStyle,
  createFontStrikeoutStyle,
  type VasaFont,
} from "@vasa/font";
import {
  layoutDocument,
  type AnyLayoutExtension,
  type BoxNode,
  type LayoutNode,
  type LayoutOptions,
  type TextMeasurer,
  type TextStyle,
} from "@vasa/layout";
import { createEditorTextStyleForFont } from "./font.ts";
import { defaultEditorMarkExtensions, type EditorTextStyleAttributes } from "./font-attributes.ts";
import { createEditorLayoutTree, type EditorJson } from "./index.ts";

export type EditorRenderProfileOptions = {
  fonts: VasaFont[];
  defaultFontId: string;
  fallbackFont: VasaFont;
  fontSize: number;
  lineHeight: number;
  textColor?: string;
  whiteSpace?: TextStyle["whiteSpace"];
  wordBreak?: TextStyle["wordBreak"];
  italicSkewX?: number;
  outlinePixelSnap?: number;
  scriptScale?: number;
};

export type EditorTextLineSource = {
  sourceId?: string;
  font?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
};

export type EditorCanvasTextPaint = {
  fill: string;
  font: string;
  fontSize: number;
  outlineFont?: VasaFont["outlineFont"];
  embolden?: number;
  pixelSnap?: number;
  skewX?: number;
};

export type EditorPdfOutlineText = {
  font: NonNullable<VasaFont["outlineFont"]>;
  fontSize: number;
  fill: string;
  embolden?: number;
  pixelSnap?: number;
  skewX?: number;
};

type EditorTextBoxSource = {
  id?: string;
  lines?: EditorTextLineSource[];
};

type EditorRenderTextNodeSource = {
  sourceId?: string;
  lines: EditorTextLineSource[];
};

export type CreateEditorRenderDocumentOptions<TRenderDocument, TRendererExtension = unknown> = {
  doc: EditorJson;
  page: LayoutOptions["page"];
  measurer: TextMeasurer;
  profile: EditorRenderProfileOptions;
  rootStyle?: BoxNode["style"];
  paragraphStyle?: BoxNode["style"];
  extraChildren?: LayoutNode[];
  layoutExtensions?: AnyLayoutExtension[];
  rendererExtensions?: TRendererExtension[];
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

export function createEditorRenderDocument<TRenderDocument, TRendererExtension = unknown>(
  options: CreateEditorRenderDocumentOptions<TRenderDocument, TRendererExtension>,
): EditorRenderDocumentContract<TRenderDocument> {
  const textStyle = createEditorRenderTextStyle(options.profile);
  const resolveTextStyle = createEditorRenderResolveTextStyle(options.profile);
  const tree = createEditorLayoutTree(options.doc, {
    rootStyle: options.rootStyle,
    paragraphStyle: options.paragraphStyle,
    textStyle,
    resolveTextStyle,
  });
  const layoutTree =
    options.extraChildren === undefined || options.extraChildren.length === 0
      ? tree
      : { ...tree, children: [...(tree.children ?? []), ...options.extraChildren] };
  const layout = layoutDocument(layoutTree, {
    page: options.page,
    measurer: options.measurer,
    extensions: options.layoutExtensions,
    textGrid: false,
  } as LayoutOptions & { textGrid: boolean });
  const renderDocument = options.createRenderDocument(layout, {
    extensions: options.rendererExtensions,
  });

  return {
    layoutTree,
    layout,
    renderDocument,
    canvasTextPaint: (box, lineIndex) =>
      createEditorCanvasTextPaint(options.doc, options.profile, box, lineIndex),
    pdfOutlineText: (node, lineIndex) =>
      createEditorPdfOutlineText(options.doc, options.profile, node, lineIndex),
  };
}

export function createEditorRenderTextStyle(options: EditorRenderProfileOptions): TextStyle {
  return createEditorTextStyleForFont(editorRenderDefaultFont(options), {
    fontSize: options.fontSize,
    lineHeight: options.lineHeight,
    whiteSpace: options.whiteSpace,
    wordBreak: options.wordBreak,
    color: options.textColor,
  });
}

export function createEditorRenderResolveTextStyle(options: EditorRenderProfileOptions) {
  return (attrs: EditorTextStyleAttributes): TextStyle => {
    const font =
      attrs.fontId === undefined
        ? editorRenderDefaultFont(options)
        : fontById(options, attrs.fontId);
    const fontSizeBase = attrs.fontSize ?? options.fontSize;
    const fontSize =
      attrs.verticalAlign === "sub" || attrs.verticalAlign === "super"
        ? createFontScriptStyle(font, {
            fontSize: fontSizeBase,
            kind: attrs.verticalAlign,
            fallbackScale: options.scriptScale,
          }).fontSize
        : fontSizeBase;
    const scriptBaselineShift =
      attrs.verticalAlign === "sub" || attrs.verticalAlign === "super"
        ? createFontScriptStyle(font, {
            fontSize: fontSizeBase,
            kind: attrs.verticalAlign,
            fallbackScale: options.scriptScale,
          }).baselineShift
        : undefined;
    const baselineShift =
      scriptBaselineShift ??
      mixedFontBaselineShift(editorRenderDefaultFont(options), font, fontSizeBase);
    const strikeout =
      attrs.textDecorationLine === "line-through"
        ? createFontStrikeoutStyle(font, { fontSize })
        : undefined;
    const fontWeight = attrs.fontWeight ?? font.weight;
    const fontStyle = attrs.fontStyle ?? font.style;
    const familyFont = fontFaceForStyle(options, font, fontWeight, fontStyle);
    const lineHeight =
      attrs.lineHeight === undefined
        ? Math.ceil(fontSize * (options.lineHeight / options.fontSize))
        : Math.ceil(fontSize * attrs.lineHeight);

    return createEditorTextStyleForFont(familyFont, {
      fontSize,
      lineHeight,
      whiteSpace: options.whiteSpace,
      wordBreak: options.wordBreak,
      color: attrs.color,
      backgroundColor: attrs.backgroundColor,
      textDecorationLine: attrs.textDecorationLine,
      textDecorationColor: attrs.textDecorationColor,
      textDecorationOffset: strikeout?.offset,
      textDecorationThickness: strikeout?.thickness,
      verticalAlign: attrs.verticalAlign,
      baselineShift,
    });
  };
}

export function createEditorCanvasTextPaint(
  doc: EditorJson,
  options: EditorRenderProfileOptions,
  box: EditorTextBoxSource,
  lineIndex: number,
): EditorCanvasTextPaint {
  const line = box.lines?.[lineIndex];
  const attrs = textStyleAttrsForSourceId(doc, line?.sourceId ?? box.id);
  const font =
    attrs.fontId === undefined ? editorRenderDefaultFont(options) : fontById(options, attrs.fontId);
  const fontSize = line?.fontSize ?? attrs.fontSize ?? options.fontSize;
  const fontWeight = line?.fontWeight ?? attrs.fontWeight ?? font.weight;
  const fontStyle = line?.fontStyle ?? attrs.fontStyle ?? font.style;
  const familyFont = fontFaceForStyle(options, font, fontWeight, fontStyle);

  return {
    fill: line?.color ?? attrs.color ?? options.textColor ?? "#111111",
    font:
      line?.font ??
      createCanvasFontValue({ ...familyFont, weight: fontWeight, style: fontStyle }, { fontSize }),
    fontSize,
    outlineFont: familyFont.outlineFont,
    embolden: fauxBoldOffset(fontWeight, familyFont.weight, fontSize),
    pixelSnap: options.outlinePixelSnap,
    skewX: isItalicFontStyle(fontStyle) ? (options.italicSkewX ?? 0.35) : undefined,
  };
}

export function createEditorPdfOutlineText(
  doc: EditorJson,
  options: EditorRenderProfileOptions,
  node: EditorRenderTextNodeSource,
  lineIndex: number,
): EditorPdfOutlineText | undefined {
  const line = node.lines[lineIndex];
  const attrs = textStyleAttrsForSourceId(doc, line?.sourceId ?? node.sourceId);
  const font =
    attrs.fontId === undefined ? editorRenderDefaultFont(options) : fontById(options, attrs.fontId);

  const fontSize = line?.fontSize ?? attrs.fontSize ?? options.fontSize;
  const fontWeight = line?.fontWeight ?? attrs.fontWeight ?? font.weight;
  const fontStyle = line?.fontStyle ?? attrs.fontStyle ?? font.style;
  const familyFont = fontFaceForStyle(options, font, fontWeight, fontStyle);
  if (familyFont.outlineFont === undefined) return undefined;

  return {
    font: familyFont.outlineFont,
    fontSize,
    fill: line?.color ?? attrs.color ?? options.textColor ?? "#111111",
    embolden: fauxBoldOffset(fontWeight, familyFont.weight, fontSize),
    pixelSnap: options.outlinePixelSnap,
    skewX: isItalicFontStyle(fontStyle) ? (options.italicSkewX ?? 0.35) : undefined,
  };
}

export function textStyleAttrsForSourceId(
  doc: EditorJson,
  sourceId: string | undefined,
): EditorTextStyleAttributes {
  const node = getEditorNodeAtSourceId(doc, sourceId);

  return (node?.marks ?? []).reduce<EditorTextStyleAttributes>((attrs, mark) => {
    const renderer = defaultEditorMarkExtensions.find((extension) => extension.name === mark.type)
      ?.renderers?.textStyle;
    const renderers = renderer === undefined ? [] : Array.isArray(renderer) ? renderer : [renderer];

    return renderers.reduce<EditorTextStyleAttributes>(
      (nextAttrs, render) => ({ ...nextAttrs, ...render({ mark }) }),
      attrs,
    );
  }, {});
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
      return measureOutlineText(fontFace.outlineFont, text, fontSize);
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

function fontFaceForStyle(
  options: EditorRenderProfileOptions,
  font: VasaFont,
  weight: string,
  style: string,
) {
  return (
    options.fonts.find(
      (candidate) =>
        candidate.family === font.family &&
        candidate.weight === weight &&
        candidate.style === style,
    ) ?? { ...font, weight, style }
  );
}

function mixedFontBaselineShift(referenceFont: VasaFont, font: VasaFont, fontSize: number) {
  if (font.id === referenceFont.id) return undefined;

  const referenceAscent = ascentRatio(referenceFont);
  const fontAscent = ascentRatio(font);
  if (referenceAscent === undefined || fontAscent === undefined) return undefined;

  const shift = (referenceAscent - fontAscent) * fontSize;
  return Math.abs(shift) < 0.01 ? undefined : shift;
}

function ascentRatio(font: Pick<VasaFont, "data">) {
  const metrics = font.data.metrics;
  if (metrics === undefined || metrics.unitsPerEm <= 0) return undefined;
  return metrics.ascender / metrics.unitsPerEm;
}

function fontForCssFont(options: EditorRenderProfileOptions, font: string | undefined) {
  return (
    options.fonts.find((candidate) => font?.includes(candidate.family)) ??
    options.fonts.find((candidate) => font?.includes(candidate.cssFamily)) ??
    editorRenderDefaultFont(options)
  );
}

function measureOutlineText(
  font: NonNullable<VasaFont["outlineFont"]>,
  text: string,
  fontSize: number,
) {
  return Array.from(text).reduce((width, character) => {
    const glyph = font.source.charToGlyph(character);
    return width + (glyph.advanceWidth / font.unitsPerEm) * fontSize;
  }, 0);
}

function parseCssFontSize(font: string | undefined) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font ?? "");
  return match === null ? undefined : Number(match[1]);
}

function isItalicFontStyle(fontStyle: string | undefined) {
  return fontStyle === "italic" || fontStyle === "oblique";
}

function fauxBoldOffset(requestedWeight: string, sourceWeight: string, fontSize: number) {
  const requested = Number.parseInt(requestedWeight, 10);
  const source = Number.parseInt(sourceWeight, 10);
  if (!Number.isFinite(requested) || !Number.isFinite(source)) return undefined;
  if (requested < 600) return undefined;
  return Math.max(0.75, Math.min(1.4, fontSize * 0.07));
}

function getEditorNodeAtSourceId(doc: EditorJson, sourceId: string | undefined) {
  if (sourceId === undefined || sourceId.length === 0) return undefined;

  return sourceId.split(".").reduce<EditorJson | undefined>((node, segment) => {
    const index = Number(segment);
    if (!Number.isInteger(index)) return undefined;
    return node?.content?.[index];
  }, doc);
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
