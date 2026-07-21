import { expect, test } from "vite-plus/test";
import {
  createFontCatalog,
  createFontRegistry,
  createNativeFont,
  googleFontManifest,
} from "@openinspection/skriva/font";
import { registerEditorFonts } from "@openinspection/skriva/font";
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

test("validates complete local Google families as controlled", async () => {
  const fonts = await registerEditorFonts({
    registry: createFontRegistry(),
    bundledFont: webEditorConfig.bundledFont,
    fallbackFont: webEditorConfig.fallbackFont,
    fontFamilies: webEditorConfig.fontFamilies,
  });

  expect(webEditorConfig.controlledFontFamilies).toEqual(
    googleFontManifest.map((entry) => entry.family),
  );
  expect(() =>
    createFontCatalog({
      fonts,
      controlledFamilies: webEditorConfig.controlledFontFamilies,
    }),
  ).not.toThrow();
});

test("resolves controlled faces from initial web font metadata", () => {
  const metadataFonts = webEditorConfig.fontFamilies
    .filter((font) => typeof font !== "string")
    .map((font) =>
      createNativeFont({
        id: font.id ?? font.family.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
        family: font.family,
        displayName: font.displayName ?? font.family,
        weight: String(font.weight ?? "400"),
        style: font.style ?? "normal",
        fallbackFamilies: font.fallbackFamilies,
      }),
    );
  const catalog = createFontCatalog({
    fonts: [webEditorConfig.bundledFont, webEditorConfig.fallbackFont, ...metadataFonts],
    controlledFamilies: webEditorConfig.controlledFontFamilies,
  });

  expect(catalog.resolveFace({ family: "Arimo", weight: "700", style: "italic" }).id).toBe(
    "arimo-700-italic",
  );
});
