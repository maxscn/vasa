import {
  createCanvasFontValue,
  type FontDescriptor,
  type FontRegistry,
  type FontSource,
  type VasaFont,
} from "@vasa/font";
import type { TextStyle } from "@vasa/layout";

export const editorCodeFontId = "ui-monospace";

export const editorCodeFontDescriptor: FontDescriptor = {
  id: editorCodeFontId,
  family: "ui-monospace",
  displayName: "UI Monospace",
  fallbackFamilies: ["SFMono-Regular", "Menlo", "Consolas", "monospace"],
};

export type EditorFontStyleOptions = {
  fontSize: number;
  lineHeight?: number;
  letterSpacing?: number;
  whiteSpace?: TextStyle["whiteSpace"];
  wordBreak?: TextStyle["wordBreak"];
  color?: TextStyle["color"];
  backgroundColor?: TextStyle["backgroundColor"];
  textDecorationLine?: TextStyle["textDecorationLine"];
  textDecorationColor?: TextStyle["textDecorationColor"];
  textDecorationOffset?: TextStyle["textDecorationOffset"];
  textDecorationThickness?: TextStyle["textDecorationThickness"];
  verticalAlign?: TextStyle["verticalAlign"];
  baselineShift?: TextStyle["baselineShift"];
};

export function createEditorTextStyleForFont(
  font: Pick<VasaFont, "cssFamily" | "style" | "weight">,
  options: EditorFontStyleOptions,
): TextStyle {
  return {
    font: createCanvasFontValue(font, options),
    lineHeight: options.lineHeight,
    letterSpacing: options.letterSpacing,
    whiteSpace: options.whiteSpace,
    wordBreak: options.wordBreak,
    color: options.color,
    backgroundColor: options.backgroundColor,
    textDecorationLine: options.textDecorationLine,
    textDecorationColor: options.textDecorationColor,
    textDecorationOffset: options.textDecorationOffset,
    textDecorationThickness: options.textDecorationThickness,
    verticalAlign: options.verticalAlign,
    baselineShift: options.baselineShift,
  };
}

export function mergeFonts(seed: VasaFont[], next: VasaFont[]) {
  const byId = new Map(seed.map((font) => [font.id, font]));
  for (const font of next) byId.set(font.id, font);
  return [...byId.values()];
}

export function fontIdFromFamily(family: string) {
  return family
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}

export type RegisterEditorFontsOptions = {
  registry: FontRegistry;
  bundledFont: VasaFont;
  fallbackFont: VasaFont;
  bundledFontSource?: FontSource;
  fallbackFontSource?: FontSource;
  fontFamilies?: Array<string | FontDescriptor>;
};

export async function registerEditorFonts(options: RegisterEditorFontsOptions) {
  await Promise.allSettled([
    options.registry.register({
      ...options.fallbackFont,
      ...(options.fallbackFontSource === undefined ? {} : { source: options.fallbackFontSource }),
    }),
    ...(options.fontFamilies ?? []).map((font) =>
      options.registry.register(
        typeof font === "string"
          ? {
              id: fontIdFromFamily(font),
              family: font,
              displayName: font,
              fallbackFamilies: ["Arial", "sans-serif"],
            }
          : font,
      ),
    ),
    options.registry.register({
      ...options.bundledFont,
      ...(options.bundledFontSource === undefined ? {} : { source: options.bundledFontSource }),
    }),
  ]);

  return mergeFonts([options.bundledFont, options.fallbackFont], options.registry.list());
}
