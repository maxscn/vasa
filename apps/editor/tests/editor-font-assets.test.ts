import { describe, expect, it } from "vitest";
import { localArimoRegularFontSource, localGoogleFontDescriptors } from "../src/editor-font-assets";

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
});
