import {
  createCanvasFontValue,
  createFontCatalog,
  createFontScriptStyle,
  createFontStrikeoutStyle,
  type FontCatalog,
  type SkrivaFont,
} from "@skriva/font";
import type { TextStyle } from "@skriva/layout";
import { createEditorTextStyleForFont } from "./font.ts";
import {
  defaultEditorMarkExtensions,
  type EditorMarkExtension,
  type EditorTextStyleAttributes,
} from "./font-attributes.ts";
import type { JSONContent } from "@skriva/core";

export type EditorRenderProfileOptions = {
  fonts: SkrivaFont[];
  defaultFontId: string;
  fallbackFont: SkrivaFont;
  fontSize: number;
  lineHeight: number;
  textColor?: string;
  whiteSpace?: TextStyle["whiteSpace"];
  wordBreak?: TextStyle["wordBreak"];
  italicSkewX?: number;
  outlinePixelSnap?: number;
  scriptScale?: number;
  fontCatalog?: FontCatalog;
  stylesheets?: EditorTextStylesheet[];
};

export type EditorTextLineSource = {
  sourceId?: string;
  font?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
};

const defaultFontCatalogCache = new WeakMap<EditorRenderProfileOptions, FontCatalog>();

export type EditorCanvasTextPaint = {
  fill: string;
  font: string;
  fontSize: number;
  outlineFont?: SkrivaFont["outlineFont"];
  embolden?: number;
  pixelSnap?: number;
  skewX?: number;
};

export type EditorPdfOutlineText = {
  font: NonNullable<SkrivaFont["outlineFont"]>;
  fontSize: number;
  fill: string;
  embolden?: number;
  pixelSnap?: number;
  skewX?: number;
};

export type EditorTextBoxSource = {
  id?: string;
  lines?: EditorTextLineSource[];
};

export type EditorRenderTextNodeSource = {
  sourceId?: string;
  lines: EditorTextLineSource[];
};

export type EditorTextStylesheetContext = {
  attrs: EditorTextStyleAttributes;
  profile: EditorRenderProfileOptions;
  font: SkrivaFont;
  familyFont: SkrivaFont;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  line?: EditorTextLineSource;
  sourceId?: string;
};

export type EditorTextPaintStylesheetContext = EditorTextStylesheetContext & {
  textStyle?: TextStyle;
};

export type EditorTextStylesheet = {
  name: string;
  textStyle?: (context: EditorTextStylesheetContext) => TextStyle | undefined;
  canvasTextPaint?: (
    context: EditorTextPaintStylesheetContext & { paint: EditorCanvasTextPaint },
  ) => Partial<EditorCanvasTextPaint> | undefined;
  pdfOutlineText?: (
    context: EditorTextPaintStylesheetContext & { paint?: EditorPdfOutlineText },
  ) => Partial<EditorPdfOutlineText> | undefined;
};

export type CreateEditorTextStyleResolverOptions = {
  profile: EditorRenderProfileOptions;
  doc?: JSONContent;
  markExtensions?: EditorMarkExtension[];
};

export type EditorTextStyleResolver = {
  baseTextStyle: () => TextStyle;
  resolveTextStyle: (attrs: EditorTextStyleAttributes) => TextStyle;
  canvasTextPaint: (box: EditorTextBoxSource, lineIndex: number) => EditorCanvasTextPaint;
  pdfOutlineText: (
    node: EditorRenderTextNodeSource,
    lineIndex: number,
  ) => EditorPdfOutlineText | undefined;
};

export function createEditorTextStyleResolver(
  options: CreateEditorTextStyleResolverOptions,
): EditorTextStyleResolver {
  const markExtensions = options.markExtensions ?? defaultEditorMarkExtensions;

  return {
    baseTextStyle: () => createEditorRenderTextStyle(options.profile),
    resolveTextStyle: (attrs) => resolveEditorTextStyle(options.profile, attrs),
    canvasTextPaint: (box, lineIndex) => {
      const line = box.lines?.[lineIndex];
      const attrs = textStyleAttrsForSourceId(
        options.doc,
        line?.sourceId ?? box.id,
        markExtensions,
      );
      return resolveEditorCanvasTextPaint(options.profile, attrs, line);
    },
    pdfOutlineText: (node, lineIndex) => {
      const line = node.lines[lineIndex];
      const attrs = textStyleAttrsForSourceId(
        options.doc,
        line?.sourceId ?? node.sourceId,
        markExtensions,
      );
      return resolveEditorPdfOutlineText(options.profile, attrs, line);
    },
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

export function resolveEditorTextStyle(
  options: EditorRenderProfileOptions,
  attrs: EditorTextStyleAttributes,
): TextStyle {
  const context = createTextStylesheetContext(options, attrs);
  const metricsFont = context.familyFont;
  const textDecoration =
    attrs.textDecorationLine === "line-through"
      ? createFontStrikeoutStyle(metricsFont, { fontSize: context.fontSize })
      : attrs.textDecorationLine === "underline"
        ? createEditorFontUnderlineStyle(metricsFont, { fontSize: context.fontSize })
        : undefined;
  const lineHeight =
    attrs.lineHeight === undefined
      ? Math.ceil(context.fontSize * (options.lineHeight / options.fontSize))
      : Math.ceil(context.fontSize * attrs.lineHeight);
  const baseStyle = createEditorTextStyleForFont(
    { ...context.familyFont, weight: context.fontWeight, style: context.fontStyle },
    {
      fontSize: context.fontSize,
      lineHeight,
      whiteSpace: options.whiteSpace,
      wordBreak: options.wordBreak,
      color: attrs.color,
      backgroundColor: attrs.backgroundColor,
      textDecorationLine: attrs.textDecorationLine,
      textDecorationColor: attrs.textDecorationColor,
      textDecorationOffset: textDecoration?.offset,
      textDecorationThickness: textDecoration?.thickness,
      verticalAlign: attrs.verticalAlign,
      baselineShift: resolveBaselineShift(options, metricsFont, attrs),
    },
  );

  return applyTextStyleStylesheets(options, context, baseStyle);
}

export function resolveEditorCanvasTextPaint(
  options: EditorRenderProfileOptions,
  attrs: EditorTextStyleAttributes,
  line?: EditorTextLineSource,
): EditorCanvasTextPaint {
  const context = createTextStylesheetContext(options, attrs, line);
  const paint: EditorCanvasTextPaint = {
    fill: line?.color ?? attrs.color ?? options.textColor ?? "#111111",
    font:
      line?.font ??
      createCanvasFontValue(
        { ...context.familyFont, weight: context.fontWeight, style: context.fontStyle },
        { fontSize: context.fontSize },
      ),
    fontSize: context.fontSize,
    outlineFont: context.familyFont.outlineFont,
    pixelSnap: options.outlinePixelSnap,
  };

  return applyCanvasTextPaintStylesheets(options, context, paint);
}

export function resolveEditorPdfOutlineText(
  options: EditorRenderProfileOptions,
  attrs: EditorTextStyleAttributes,
  line?: EditorTextLineSource,
): EditorPdfOutlineText | undefined {
  const context = createTextStylesheetContext(options, attrs, line);
  const paint =
    context.familyFont.outlineFont === undefined
      ? undefined
      : {
          font: context.familyFont.outlineFont,
          fontSize: context.fontSize,
          fill: line?.color ?? attrs.color ?? options.textColor ?? "#111111",
          pixelSnap: options.outlinePixelSnap,
        };
  const resolved = applyPdfOutlineTextStylesheets(options, context, paint);
  return resolved?.font === undefined ? undefined : resolved;
}

export function textStyleAttrsForSourceId(
  doc: JSONContent | undefined,
  sourceId: string | undefined,
  markExtensions: EditorMarkExtension[] = defaultEditorMarkExtensions,
): EditorTextStyleAttributes {
  const node = getEditorNodeAtSourceId(doc, sourceId);

  return (node?.marks ?? []).reduce<EditorTextStyleAttributes>((attrs, mark) => {
    const renderer = markExtensions.find((extension) => extension.name === mark.type)?.renderers
      ?.textStyle;
    const renderers = renderer === undefined ? [] : Array.isArray(renderer) ? renderer : [renderer];

    return renderers.reduce<EditorTextStyleAttributes>(
      (nextAttrs, render) => ({ ...nextAttrs, ...render({ mark }) }),
      attrs,
    );
  }, {});
}

function createTextStylesheetContext(
  options: EditorRenderProfileOptions,
  attrs: EditorTextStyleAttributes,
  line?: EditorTextLineSource,
): EditorTextStylesheetContext {
  const font =
    attrs.fontId === undefined
      ? (fontByFamily(options, attrs.fontFamily) ?? editorRenderDefaultFont(options))
      : fontById(options, attrs.fontId);
  const fontSizeBase = line?.fontSize ?? attrs.fontSize ?? options.fontSize;
  const shouldScaleScript =
    line?.fontSize === undefined &&
    (attrs.verticalAlign === "sub" || attrs.verticalAlign === "super");
  const fontSize = shouldScaleScript
    ? createFontScriptStyle(font, {
        fontSize: fontSizeBase,
        kind: attrs.verticalAlign!,
        fallbackScale: options.scriptScale,
      }).fontSize
    : fontSizeBase;
  const fontWeight = line?.fontWeight ?? attrs.fontWeight ?? font.weight;
  const fontStyle = line?.fontStyle ?? attrs.fontStyle ?? font.style;
  const familyFont = fontFaceForStyle(options, font, fontWeight, fontStyle);

  return {
    attrs,
    profile: options,
    font,
    familyFont,
    fontSize,
    fontWeight,
    fontStyle,
    line,
    sourceId: line?.sourceId,
  };
}

function applyTextStyleStylesheets(
  options: EditorRenderProfileOptions,
  context: EditorTextStylesheetContext,
  baseStyle: TextStyle,
) {
  if (options.stylesheets === undefined || options.stylesheets.length === 0) return baseStyle;

  return (options.stylesheets ?? []).reduce<TextStyle>((style, stylesheet) => {
    const next = stylesheet.textStyle?.(context);
    return next === undefined ? style : { ...style, ...next };
  }, baseStyle);
}

function applyCanvasTextPaintStylesheets(
  options: EditorRenderProfileOptions,
  context: EditorTextStylesheetContext,
  basePaint: EditorCanvasTextPaint,
) {
  if (options.stylesheets === undefined || options.stylesheets.length === 0) return basePaint;

  return (options.stylesheets ?? []).reduce<EditorCanvasTextPaint>((paint, stylesheet) => {
    const next = stylesheet.canvasTextPaint?.({ ...context, paint });
    return next === undefined ? paint : { ...paint, ...next };
  }, basePaint);
}

function applyPdfOutlineTextStylesheets(
  options: EditorRenderProfileOptions,
  context: EditorTextStylesheetContext,
  basePaint: EditorPdfOutlineText | undefined,
) {
  if (options.stylesheets === undefined || options.stylesheets.length === 0) return basePaint;

  return (options.stylesheets ?? []).reduce<EditorPdfOutlineText | undefined>(
    (paint, stylesheet) => {
      const next = stylesheet.pdfOutlineText?.({ ...context, paint });
      return next === undefined ? paint : ({ ...paint, ...next } as EditorPdfOutlineText);
    },
    basePaint,
  );
}

function resolveBaselineShift(
  options: EditorRenderProfileOptions,
  font: SkrivaFont,
  attrs: EditorTextStyleAttributes,
) {
  const fontSizeBase = attrs.fontSize ?? options.fontSize;
  const scriptBaselineShift =
    attrs.verticalAlign === "sub" || attrs.verticalAlign === "super"
      ? createFontScriptStyle(font, {
          fontSize: fontSizeBase,
          kind: attrs.verticalAlign,
          fallbackScale: options.scriptScale,
        }).baselineShift
      : undefined;

  return (
    scriptBaselineShift ??
    mixedFontBaselineShift(editorRenderDefaultFont(options), font, fontSizeBase)
  );
}

function editorRenderDefaultFont(options: EditorRenderProfileOptions) {
  return fontById(options, options.defaultFontId);
}

function fontById(options: EditorRenderProfileOptions, fontId: string) {
  return options.fonts.find((font) => font.id === fontId) ?? options.fallbackFont;
}

function fontByFamily(options: EditorRenderProfileOptions, fontFamily: string | undefined) {
  if (fontFamily === undefined) return undefined;

  const requested = normalizeCssFontFamily(fontFamily);
  return options.fonts.find((font) => normalizeCssFontFamily(font.family) === requested);
}

function normalizeCssFontFamily(family: string) {
  return family
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
}

function fontFaceForStyle(
  options: EditorRenderProfileOptions,
  font: SkrivaFont,
  weight: string,
  style: string,
): SkrivaFont {
  return editorFontCatalog(options).resolveFace({ family: font.family, weight, style });
}

function mixedFontBaselineShift(referenceFont: SkrivaFont, font: SkrivaFont, fontSize: number) {
  if (font.id === referenceFont.id) return undefined;

  const referenceAscent = ascentRatio(referenceFont);
  const fontAscent = ascentRatio(font);
  if (referenceAscent === undefined || fontAscent === undefined) return undefined;

  const shift = (referenceAscent - fontAscent) * fontSize;
  return Math.abs(shift) < 0.01 ? undefined : shift;
}

function ascentRatio(font: Pick<SkrivaFont, "data">) {
  const metrics = font.data.metrics;
  if (metrics === undefined || metrics.unitsPerEm <= 0) return undefined;
  return metrics.ascender / metrics.unitsPerEm;
}

function createEditorFontUnderlineStyle(
  font: Pick<SkrivaFont, "data">,
  options: { fontSize: number },
) {
  const metrics = font.data.metrics as
    | (NonNullable<SkrivaFont["data"]["metrics"]> & {
        underlinePosition?: number;
        underlineThickness?: number;
      })
    | undefined;
  if (metrics === undefined) {
    return {
      offset: options.fontSize,
      thickness: Math.max(1, Math.round(options.fontSize * 0.06)),
    };
  }

  const unitsPerEm = positive(metrics.unitsPerEm) ?? 1;
  const ascender = metrics.ascender / unitsPerEm;
  const position = (metrics.underlinePosition ?? -unitsPerEm * 0.1) / unitsPerEm;
  const thickness = Math.max(
    1,
    Math.round(
      ((positive(metrics.underlineThickness) ?? unitsPerEm * 0.05) / unitsPerEm) * options.fontSize,
    ),
  );

  return {
    offset: ascender * options.fontSize - position * options.fontSize,
    thickness,
  };
}

function positive(value: number | undefined) {
  return value === undefined || value <= 0 ? undefined : value;
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

function getEditorNodeAtSourceId(doc: JSONContent | undefined, sourceId: string | undefined) {
  if (doc === undefined || sourceId === undefined || sourceId.length === 0) return undefined;

  return sourceId.split(".").reduce<JSONContent | undefined>((node, segment) => {
    const index = Number(segment);
    if (!Number.isInteger(index)) return undefined;
    return node?.content?.[index];
  }, doc);
}
