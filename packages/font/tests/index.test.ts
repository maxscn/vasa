import { expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createCanvasFontValue,
  createCssFontFamily,
  createFontRegistry,
  createFontScriptStyle,
  createFontStrikeoutStyle,
  createStandardFontMetrics,
} from "../src/index.ts";

const liberationSansBytes = () =>
  readFileSync(
    fileURLToPath(
      new URL("../../pdf/tests/fixtures/fonts/LiberationSans-Regular.ttf", import.meta.url),
    ),
  );
const arimoBytes = () =>
  readFileSync(
    fileURLToPath(
      new URL("../../pdf/tests/fixtures/fonts/google/arimo/Arimo-Regular.ttf", import.meta.url),
    ),
  );

test("registers native Google fonts with standardized metrics", async () => {
  const registry = createFontRegistry();
  const font = await registry.register({
    family: "Arimo",
    fallbackFamilies: ["Arial", "sans-serif"],
  });

  expect(font).toMatchObject({
    id: "arimo",
    displayName: "Arimo",
    cssFamily: "Arimo, Arial, sans-serif",
  });
  expect(font.data).toEqual({
    kind: "native",
    metrics: createStandardFontMetrics({
      family: "Arimo",
      fallbackFamilies: ["Arial", "sans-serif"],
    }),
  });
  expect(font.outlineFont).toBeUndefined();
  expect(registry.list()).toEqual([font]);
});

test("registers font bytes with outline data and metrics", async () => {
  const registry = createFontRegistry();
  const font = await registry.register({
    family: "Vasa Liberation Sans",
    displayName: "Liberation Sans",
    source: liberationSansBytes(),
  });

  expect(font.data.kind).toBe("outline");
  expect(font.outlineFont).toBeDefined();
  if (font.data.kind !== "outline") throw new Error("Expected outline font data.");
  expect(font.data.metrics).toMatchObject({
    unitsPerEm: 2048,
    ascender: expect.any(Number),
    descender: expect.any(Number),
    strikeoutPosition: expect.any(Number),
    strikeoutSize: expect.any(Number),
    subscriptYOffset: expect.any(Number),
    subscriptYSize: expect.any(Number),
    superscriptYOffset: expect.any(Number),
    superscriptYSize: expect.any(Number),
  });
  expect(font.data.bytes.byteLength).toBeGreaterThan(0);
});

test.each([
  {
    family: "Arimo",
    displayName: "Arimo",
    source: arimoBytes,
  },
  {
    family: "Vasa Liberation Sans",
    displayName: "Liberation Sans",
    source: liberationSansBytes,
  },
])(
  "derives deterministic script and strike metrics for $displayName",
  async ({ family, displayName, source }) => {
    const registry = createFontRegistry();
    const font = await registry.register({
      family,
      displayName,
      source: source?.(),
    });
    if (font.data.metrics === undefined) throw new Error(`Expected metrics for ${displayName}.`);

    const fontSize = 16;
    const strikeout = createFontStrikeoutStyle(font, { fontSize });
    const subscript = createFontScriptStyle(font, { fontSize, kind: "sub" });
    const superscript = createFontScriptStyle(font, { fontSize, kind: "super" });
    const metrics = font.data.metrics;
    const em = metrics.unitsPerEm;
    const ascenderRatio = metrics.ascender / em;
    const glyphBoxHeight = ((metrics.ascender - metrics.descender) / em) * fontSize;
    const strikeCenter = strikeout.offset + strikeout.thickness / 2;
    const subscriptBaselineDelta =
      subscript.baselineShift + ascenderRatio * (subscript.fontSize - fontSize);
    const superscriptBaselineDelta =
      superscript.baselineShift + ascenderRatio * (superscript.fontSize - fontSize);

    expect(strikeout.thickness).toBeGreaterThanOrEqual(1);
    expect(strikeCenter / glyphBoxHeight).toBeGreaterThan(0.45);
    expect(strikeCenter / glyphBoxHeight).toBeLessThan(0.65);
    expect(strikeout.offset).toBeCloseTo(
      (metrics.ascender / em) * fontSize -
        ((metrics.strikeoutPosition ?? 0) / em) * fontSize -
        strikeout.thickness / 2,
      4,
    );

    expect(subscript.fontSize).toBeGreaterThan(6);
    expect(subscript.fontSize).toBeLessThan(fontSize);
    expect(subscriptBaselineDelta).toBeGreaterThan(0);
    expect(subscriptBaselineDelta).toBeLessThan(fontSize * 0.35);
    expect(subscriptBaselineDelta).toBeGreaterThanOrEqual(fontSize * 0.25);
    expect(subscript.baselineShift).toBeGreaterThan(subscriptBaselineDelta);

    expect(superscript.fontSize).toBeGreaterThan(6);
    expect(superscript.fontSize).toBeLessThan(fontSize);
    expect(superscriptBaselineDelta).toBeLessThan(0);
    expect(Math.abs(superscriptBaselineDelta)).toBeLessThan(fontSize * 0.6);
    expect(Math.abs(superscriptBaselineDelta)).toBeGreaterThan(fontSize * 0.35);
    expect(superscript.baselineShift).toBeGreaterThan(superscriptBaselineDelta);
  },
);

test("creates canvas font strings with quoted family names", () => {
  const font = {
    cssFamily: createCssFontFamily("Source Serif 4", ["serif"]),
    style: "normal",
    weight: "600",
  };

  expect(createCanvasFontValue(font, { fontSize: 18 })).toBe(
    'normal 600 18px "Source Serif 4", serif',
  );
});
