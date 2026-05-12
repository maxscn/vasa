import { expect, test } from "vite-plus/test";
import { createFontRegistry } from "@vasa/font";
import { registerEditorFonts } from "@vasa/editor";
import { webEditorConfig } from "../src/editor-config.ts";

test("keeps the web editor Google font catalog available", () => {
  const families = new Set(
    webEditorConfig.fontFamilies
      .filter((font) => typeof font !== "string")
      .map((font) => font.family),
  );

  expect(families).toContain("Arimo");
  expect(families).toContain("Roboto");
  expect(families).toContain("Merriweather");
  expect(families.size).toBeGreaterThan(8);
});

test("registers web editor font metadata without eagerly loading every font", async () => {
  const fonts = await registerEditorFonts({
    registry: createFontRegistry(),
    bundledFont: webEditorConfig.bundledFont,
    fallbackFont: webEditorConfig.fallbackFont,
    fontFamilies: webEditorConfig.fontFamilies,
  });
  const families = new Set(fonts.map((font) => font.family));

  expect(families).toContain("Arimo");
  expect(families).toContain("Roboto");
  expect(families).toContain("Merriweather");
  expect(fonts.filter((font) => font.data.kind === "outline")).toHaveLength(0);
});
