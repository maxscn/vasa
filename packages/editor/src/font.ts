import {
  createCanvasFontValue,
  type FontDescriptor,
  type FontRegistry,
  type FontSource,
  type SkrivaFont,
} from "@skriva/font";
import type { TextStyle } from "@skriva/layout";

export const editorCodeFontId = "courier-new";

export const editorCodeFontDescriptor: FontDescriptor = {
  id: editorCodeFontId,
  family: "Courier New",
  displayName: "Courier New",
  fallbackFamilies: ["Courier", "Menlo", "Consolas", "monospace"],
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
  font: Pick<SkrivaFont, "cssFamily" | "style" | "weight">,
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

export function mergeFonts(seed: SkrivaFont[], next: SkrivaFont[]) {
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
  bundledFont: SkrivaFont;
  fallbackFont: SkrivaFont;
  bundledFontSource?: FontSource;
  fallbackFontSource?: FontSource;
  fontFamilies?: Array<string | FontDescriptor>;
};

export async function registerEditorFonts(options: RegisterEditorFontsOptions) {
  await options.registry.register(fontDescriptorMetadata(options.fallbackFont));

  for (const font of options.fontFamilies ?? []) {
    await options.registry.register(fontDescriptorMetadata(editorFontDescriptorFromInput(font)));
  }

  await options.registry.register(fontDescriptorMetadata(options.bundledFont));

  return mergeFonts([options.bundledFont, options.fallbackFont], options.registry.list());
}

export function editorFontDescriptorFromInput(font: string | FontDescriptor): FontDescriptor {
  return typeof font === "string"
    ? {
        id: fontIdFromFamily(font),
        family: font,
        displayName: font,
        fallbackFamilies: ["Arial", "sans-serif"],
      }
    : font;
}

export function fontDescriptorMetadata(font: FontDescriptor): FontDescriptor {
  return {
    ...font,
    source: undefined,
    runtimeSource: undefined,
  };
}
