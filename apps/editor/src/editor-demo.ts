import { HorizontalRule } from "@vasa/extension-horizontal-rule";
import { createSvgNode, SvgExtension } from "@vasa/extension-svg";
import { TableExtension } from "@vasa/extension-table";
import type { EditorConfig } from "@vasa/editor";
import {
  arimoFallbackFont,
  arimoRegularFont,
  createGoogleFontDescriptors,
  createGoogleFontSource,
} from "@vasa/font";

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
export const fontSizeOptions = [12, 14, 16, 18, 22, 28, 36];
export const bundledEditorFontSource = createGoogleFontSource("Arimo", "400");
export const fallbackEditorFontSource = bundledEditorFontSource;
export const googleFontFamilies = createGoogleFontDescriptors();

export const editorConfig = {
  bundledFont: arimoRegularFont,
  bundledFontSource: bundledEditorFontSource,
  fallbackFont: arimoFallbackFont,
  fallbackFontSource: fallbackEditorFontSource,
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
  canvasTextMode: "outline",
  canvasBitmapScale: 1.5,
  pageBackground: "#fffdfa",
  textColor: "#1f2937",
} satisfies EditorConfig;
