import { HorizontalRule } from "@vasa/extension-horizontal-rule";
import { LineHeight } from "@vasa/extension-line-height";
import { SvgExtension } from "@vasa/extension-svg";
import { TableExtension } from "@vasa/extension-table";
import type { EditorConfig } from "@vasa/editor";
import { arimoFallbackFont, arimoRegularFont, type FontDescriptor } from "@vasa/font";
import {
  localArimoRegularFontSource,
  localGoogleFontDescriptors,
} from "../../editor/src/editor-font-assets";

const defaultFontFamilies = [
  systemFont("Arial", ["Helvetica", "sans-serif"]),
  systemFont("Times New Roman", ["Times", "serif"]),
  systemFont("Georgia", ["serif"]),
  systemFont("Verdana", ["Geneva", "sans-serif"]),
  ...localGoogleFontDescriptors,
] satisfies FontDescriptor[];

export const webEditorConfig = {
  bundledFont: arimoRegularFont,
  bundledFontSource: localArimoRegularFontSource,
  fallbackFont: arimoFallbackFont,
  fallbackFontSource: localArimoRegularFontSource,
  page: {
    width: 612,
    height: 792,
    margin: { top: 56, right: 64, bottom: 56, left: 64 },
  },
  pageGap: 40,
  textCharWidth: 8,
  textFontSize: 16,
  textLineHeight: 16,
  lineHeightOptions: [1, 1.15, 1.5, 2],
  extensions: [HorizontalRule, LineHeight, SvgExtension, TableExtension],
  extraChildren: [],
  fontFamilies: defaultFontFamilies,
  fontSizeOptions: [12, 14, 16, 18, 22, 28, 36],
  initialColor: "#2563eb",
  canvasTextMode: "outline",
  canvasBitmapScale: 1.5,
  pageBackground: "#fffdfa",
  textColor: "#1f2937",
} satisfies EditorConfig;

function systemFont(family: string, fallbackFamilies: string[]): FontDescriptor {
  return {
    id: family
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/(^-|-$)/g, ""),
    family,
    displayName: family,
    fallbackFamilies,
  };
}
