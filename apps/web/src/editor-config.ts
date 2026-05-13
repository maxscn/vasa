import { HorizontalRule } from "@opeinspection/skriva/enrichments/horizontal-rule";
import { LineHeight } from "@opeinspection/skriva/enrichments/line-height";
import { SvgExtension } from "@opeinspection/skriva/enrichments/svg";
import { TableExtension } from "@opeinspection/skriva/enrichments/table";
import type { SkrivaEditorConfig } from "@opeinspection/skriva";
import {
  arimoFallbackFont,
  arimoRegularFont,
  type FontDescriptor,
} from "@opeinspection/skriva/font";
import {
  localControlledGoogleFontFamilies,
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

const webEditorExtensions: NonNullable<SkrivaEditorConfig["extensions"]> = [
  HorizontalRule,
  LineHeight,
  SvgExtension,
  TableExtension,
];

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
  extensions: webEditorExtensions,
  extraChildren: [],
  fontFamilies: defaultFontFamilies,
  controlledFontFamilies: localControlledGoogleFontFamilies,
  fontSizeOptions: [12, 14, 16, 18, 22, 28, 36],
  initialColor: "#2563eb",
  canvasTextMode: "outline",
  canvasBitmapScale: 1.5,
  pageBackground: "#fffdfa",
  textColor: "#1f2937",
} satisfies SkrivaEditorConfig;

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
