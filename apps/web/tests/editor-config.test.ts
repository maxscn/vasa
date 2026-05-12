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

test("uses local web editor sources for remote-style font families", () => {
  const fonts = webEditorConfig.fontFamilies.filter((font) => typeof font !== "string");
  const inter = fonts.find((font) => font.id === "inter-400");
  const geist = fonts.find((font) => font.id === "geist-400");

  expect(webEditorConfig.bundledFontSource).toEqual(expect.any(String));
  expect(webEditorConfig.bundledFontSource).not.toMatch(/^https?:\/\//);
  expect(inter?.source).toEqual(expect.any(String));
  expect(inter?.source).not.toMatch(/^https?:\/\//);
  expect(geist?.source).toEqual(expect.any(String));
  expect(geist?.source).not.toMatch(/^https?:\/\//);
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
