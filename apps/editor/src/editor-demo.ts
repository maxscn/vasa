import { HorizontalRule } from "@vasa/extension-horizontal-rule";
import { createSvgNode, SvgExtension } from "@vasa/extension-svg";
import { TableExtension } from "@vasa/extension-table";
import type { EditorConfig } from "@vasa/editor";
import { createStandardFontMetrics, type FontDescriptor, type VasaFont } from "@vasa/font";

export const page = {
  width: 612,
  height: 792,
  margin: { top: 56, right: 64, bottom: 56, left: 64 },
};

export const canvasPageGap = 40;
export const documentExtensions = [HorizontalRule, SvgExtension, TableExtension];
export const demoSvgNode = createSvgNode({
  id: "demo-svg",
  width: 180,
  height: 92,
  viewBox: "0 0 180 92",
  title: "Vector badge",
  style: { margin: { top: 10 } },
  paths: [
    {
      d: "M12 46 C12 23 31 8 54 8 L126 8 C149 8 168 23 168 46 C168 69 149 84 126 84 L54 84 C31 84 12 69 12 46 Z",
      fill: "#f8fafc",
      stroke: "#0f172a",
      strokeWidth: 2,
    },
    {
      d: "M44 58 L70 24 L96 58 Z",
      fill: "#14b8a6",
    },
    {
      d: "M84 58 L110 24 L136 58 Z",
      fill: "#f97316",
    },
    {
      d: "M70 66 L136 66",
      stroke: "#334155",
      strokeWidth: 4,
    },
  ],
});

export const textCharWidth = 8;
export const textFontSize = 16;
export const textLineHeight = 16;
export const fallbackEditorFont: VasaFont = {
  id: "arimo",
  family: "Arimo",
  displayName: "Arimo",
  weight: "400",
  style: "normal",
  fallbackFamilies: ["Arial", "sans-serif"],
  cssFamily: "Arimo, Arial, sans-serif",
  data: { kind: "native", metrics: createStandardFontMetrics({ family: "Arimo" }) },
};

export const bundledEditorFont: VasaFont = {
  id: "arimo-400",
  family: "Arimo",
  displayName: "Arimo",
  weight: "400",
  style: "normal",
  fallbackFamilies: ["Arial", "sans-serif"],
  cssFamily: "Arimo, Arial, sans-serif",
  data: { kind: "native", metrics: createStandardFontMetrics({ family: "Arimo" }) },
};

export const fontSizeOptions = [12, 14, 16, 18, 22, 28, 36];
export const googleFontFamilies = [
  googleFont("Arimo", "arimo/Arimo-Regular.ttf"),
  googleFont("Arimo", "arimo/Arimo-700.ttf", "700"),
  googleFont("Inter", "inter/Inter-Regular.ttf"),
  googleFont("Inter", "inter/Inter-700.ttf", "700"),
  googleFont("Lora", "lora/Lora-Regular.ttf"),
  googleFont("Lora", "lora/Lora-700.ttf", "700"),
  googleFont("Merriweather", "merriweather/Merriweather-Regular.ttf"),
  googleFont("Merriweather", "merriweather/Merriweather-700.ttf", "700"),
  googleFont("Montserrat", "montserrat/Montserrat-Regular.ttf"),
  googleFont("Montserrat", "montserrat/Montserrat-700.ttf", "700"),
  googleFont("Nunito", "nunito/Nunito-Regular.ttf"),
  googleFont("Nunito", "nunito/Nunito-700.ttf", "700"),
  googleFont("Oswald", "oswald/Oswald-Regular.ttf"),
  googleFont("Oswald", "oswald/Oswald-700.ttf", "700"),
  googleFont("Playfair Display", "playfairdisplay/PlayfairDisplay-Regular.ttf"),
  googleFont("Playfair Display", "playfairdisplay/PlayfairDisplay-700.ttf", "700"),
  googleFont("Roboto", "roboto/Roboto-Regular.ttf"),
  googleFont("Roboto", "roboto/Roboto-700.ttf", "700"),
  googleFont("Source Serif 4", "sourceserif4/SourceSerif4-Regular.ttf"),
  googleFont("Source Serif 4", "sourceserif4/SourceSerif4-700.ttf", "700"),
  googleFont("Space Grotesk", "spacegrotesk/SpaceGrotesk-Regular.ttf"),
  googleFont("Space Grotesk", "spacegrotesk/SpaceGrotesk-700.ttf", "700"),
] satisfies FontDescriptor[];

export const editorConfig = {
  bundledFont: bundledEditorFont,
  fallbackFont: fallbackEditorFont,
  page,
  pageGap: canvasPageGap,
  textCharWidth,
  textFontSize,
  textLineHeight,
  extensions: documentExtensions,
  extraChildren: [],
  fontFamilies: googleFontFamilies,
  fontSizeOptions,
  initialColor: "#2563eb",
  pageBackground: "#fffdfa",
  textColor: "#1f2937",
} satisfies EditorConfig;

function googleFont(family: string, file: string, weight = "400"): FontDescriptor {
  return {
    id: `${family.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${weight}`,
    family,
    displayName: family,
    source: `/__vasa-assets/fonts/google/${file}`,
    weight,
    fallbackFamilies: ["Arial", "sans-serif"],
  };
}
