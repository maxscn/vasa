import { describe, expect, it } from "vitest";
import { googleFontManifest } from "@opeinspection/skriva/font";
import {
  localArimoRegularFontSource,
  localControlledGoogleFontFamilies,
  localGoogleFontDescriptors,
  localGoogleFontDescriptorsForAssets,
} from "../src/editor-font-assets";

describe("editor font assets", () => {
  it("uses bundled local font URLs for switchable editor fonts", () => {
    expect(localArimoRegularFontSource).toEqual(expect.any(String));
    expect(localArimoRegularFontSource).not.toMatch(/^https?:\/\//);

    for (const font of localGoogleFontDescriptors) {
      expect(font.source).toEqual(expect.any(String));
      expect(font.source).not.toMatch(/^https?:\/\//);
    }
  });

  it("keeps the default Arimo family backed by real italic local sources", () => {
    const fontsByFamily = new Map(localGoogleFontDescriptors.map((font) => [font.id, font]));

    expect(fontsByFamily.get("arimo-400")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("arimo-700")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("arimo-400-italic")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("arimo-700-italic")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("arimo-700-italic")?.style).toBe("italic");
  });

  it("keeps Inter and Geist backed by local sources", () => {
    const fontsByFamily = new Map(localGoogleFontDescriptors.map((font) => [font.id, font]));

    expect(fontsByFamily.get("inter-400")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("inter-700")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("inter-400-italic")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("inter-700-italic")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("inter-700-italic")?.style).toBe("italic");
    expect(fontsByFamily.get("geist-400")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("geist-700")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("geist-400-italic")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("geist-700-italic")?.source).toEqual(expect.any(String));
    expect(fontsByFamily.get("geist-700-italic")?.style).toBe("italic");
  });

  it("marks complete local Google families as controlled", () => {
    expect(localControlledGoogleFontFamilies).toEqual(
      googleFontManifest.map((entry) => entry.family),
    );
  });

  it("excludes incomplete local Google families from selectable descriptors", () => {
    const descriptors = localGoogleFontDescriptorsForAssets({
      ...completeFamilyAssetUrls("Arimo"),
      "./assets/fonts/google/roboto/Roboto-Regular.ttf": "/assets/Roboto-Regular.ttf",
      "./assets/fonts/google/roboto/Roboto-700.ttf": "/assets/Roboto-700.ttf",
    });
    const families = new Set(descriptors.map((font) => font.family));

    expect(families).toContain("Arimo");
    expect(families).not.toContain("Roboto");
  });

  it("only exposes descriptor families that are complete enough for app font controls", () => {
    const controlledFamilies = new Set(localControlledGoogleFontFamilies);

    expect(localGoogleFontDescriptors.every((font) => controlledFamilies.has(font.family))).toBe(
      true,
    );
  });
});

function completeFamilyAssetUrls(family: string) {
  const entry = googleFontManifest.find((candidate) => candidate.family === family);
  if (entry === undefined) throw new Error(`Unknown Google font family: ${family}`);
  const slug = family.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const compactFamily = family.replace(/\s+/g, "");

  return Object.fromEntries(
    entry.faces.map((face) => {
      const suffix = face.style === "normal" ? "" : `-${face.style}`;
      const file =
        face.weight === "400" && face.style === "normal"
          ? `${compactFamily}-Regular.ttf`
          : `${compactFamily}-${face.weight}${suffix}.ttf`;

      return [`./assets/fonts/google/${slug}/${file}`, `/assets/${file}`];
    }),
  );
}
