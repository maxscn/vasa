import {
  createCanvasFontValue,
  createFontScriptStyle,
  createFontStrikeoutStyle,
  type VasaFont,
} from "@vasa/font";
import type { TextStyle } from "@vasa/layout";
import { createEditorTextStyleForFont } from "./font.ts";
import {
  defaultEditorMarkExtensions,
  type EditorMarkExtension,
  type EditorTextStyleAttributes,
} from "./font-attributes.ts";
import type { EditorJson } from "./index.ts";

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
  font: VasaFont;
  familyFont: VasaFont;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  syntheticBold: boolean;
  syntheticItalic: boolean;
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
  doc?: EditorJson;
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
    embolden: boldOutlineOffset(context),
    pixelSnap: options.outlinePixelSnap,
    skewX: context.syntheticItalic
      ? (createEditorFontItalicSkew(context.familyFont) ?? options.italicSkewX ?? 0.35)
      : undefined,
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
          embolden: boldOutlineOffset(context),
          pixelSnap: options.outlinePixelSnap,
          skewX: context.syntheticItalic
            ? (createEditorFontItalicSkew(context.familyFont) ?? options.italicSkewX ?? 0.35)
            : undefined,
        };
  const resolved = applyPdfOutlineTextStylesheets(options, context, paint);
  return resolved?.font === undefined ? undefined : resolved;
}

export function textStyleAttrsForSourceId(
  doc: EditorJson | undefined,
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
    attrs.fontId === undefined ? editorRenderDefaultFont(options) : fontById(options, attrs.fontId);
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
  const {
    font: familyFont,
    syntheticBold,
    syntheticItalic,
  } = fontFaceForStyle(options, font, fontWeight, fontStyle);

  return {
    attrs,
    profile: options,
    font,
    familyFont,
    fontSize,
    fontWeight,
    fontStyle,
    syntheticBold,
    syntheticItalic,
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
  font: VasaFont,
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

function fontFaceForStyle(
  options: EditorRenderProfileOptions,
  font: VasaFont,
  weight: string,
  style: string,
): { font: VasaFont; syntheticBold: boolean; syntheticItalic: boolean } {
  const face = options.fonts.find(
    (candidate) =>
      candidate.family === font.family && candidate.weight === weight && candidate.style === style,
  );

  if (face !== undefined) return { font: face, syntheticBold: false, syntheticItalic: false };

  const weightFace = options.fonts.find(
    (candidate) => candidate.family === font.family && candidate.weight === weight,
  );
  if (weightFace !== undefined) {
    return {
      font: weightFace,
      syntheticBold: false,
      syntheticItalic: isItalicFontStyle(style) && !isItalicFontStyle(weightFace.style),
    };
  }

  const styleFace = options.fonts.find(
    (candidate) => candidate.family === font.family && candidate.style === style,
  );
  if (styleFace !== undefined) {
    return {
      font: styleFace,
      syntheticBold: isSyntheticBoldWeight(weight, styleFace.weight),
      syntheticItalic: false,
    };
  }

  return {
    font,
    syntheticBold: isSyntheticBoldWeight(weight, font.weight),
    syntheticItalic: isItalicFontStyle(style) && !isItalicFontStyle(font.style),
  };
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

function isItalicFontStyle(fontStyle: string | undefined) {
  return fontStyle === "italic" || fontStyle === "oblique";
}

function isSyntheticBoldWeight(requestedWeight: string, sourceWeight: string) {
  return isBoldFontWeight(requestedWeight) && !isBoldFontWeight(sourceWeight);
}

function isBoldFontWeight(weight: string | undefined) {
  const parsed = Number.parseInt(weight ?? "", 10);
  if (Number.isFinite(parsed)) return parsed >= 600;
  return weight === "bold" || weight === "bolder";
}

function boldOutlineOffset(
  context: Pick<
    EditorTextStylesheetContext,
    "fontSize" | "fontWeight" | "familyFont" | "syntheticBold"
  >,
) {
  if (!isBoldFontWeight(context.fontWeight)) return undefined;
  if (context.syntheticBold) {
    return fauxBoldOffset(context.fontWeight, context.familyFont.weight, context.fontSize);
  }
  return undefined;
}

function createEditorFontUnderlineStyle(
  font: Pick<VasaFont, "data">,
  options: { fontSize: number },
) {
  const metrics = font.data.metrics as
    | (NonNullable<VasaFont["data"]["metrics"]> & {
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

function createEditorFontItalicSkew(font: Pick<VasaFont, "data">) {
  const metrics = font.data.metrics as
    | (NonNullable<VasaFont["data"]["metrics"]> & { italicAngle?: number })
    | undefined;
  const angle = metrics?.italicAngle;
  if (angle === undefined || angle === 0) return undefined;
  return Math.tan((-angle * Math.PI) / 180);
}

function positive(value: number | undefined) {
  return value === undefined || value <= 0 ? undefined : value;
}

function fauxBoldOffset(requestedWeight: string, sourceWeight: string, fontSize: number) {
  const requested = Number.parseInt(requestedWeight, 10);
  const source = Number.parseInt(sourceWeight, 10);
  if (!Number.isFinite(requested) || !Number.isFinite(source)) return undefined;
  if (requested < 600) return undefined;
  return Math.max(0.75, Math.min(1.4, fontSize * 0.07));
}

function getEditorNodeAtSourceId(doc: EditorJson | undefined, sourceId: string | undefined) {
  if (doc === undefined || sourceId === undefined || sourceId.length === 0) return undefined;

  return sourceId.split(".").reduce<EditorJson | undefined>((node, segment) => {
    const index = Number(segment);
    if (!Number.isInteger(index)) return undefined;
    return node?.content?.[index];
  }, doc);
}
