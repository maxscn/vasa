import { expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compress } from "wawoff2";
import {
  createCanvasFontValue,
  createCssFontFamily,
  createFontItalicSkew,
  createFontRegistry,
  createFontScriptStyle,
  createFontStrikeoutStyle,
  createFontUnderlineStyle,
  createStandardFontMetrics,
  googleFontUrlFromCss,
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
    italicAngle: expect.any(Number),
    underlinePosition: expect.any(Number),
    underlineThickness: expect.any(Number),
    strikeoutPosition: expect.any(Number),
    strikeoutSize: expect.any(Number),
    subscriptYOffset: expect.any(Number),
    subscriptYSize: expect.any(Number),
    superscriptYOffset: expect.any(Number),
    superscriptYSize: expect.any(Number),
  });
  expect(font.data.bytes.byteLength).toBeGreaterThan(0);
});

test("registers woff2 font bytes with outline data", async () => {
  const registry = createFontRegistry();
  const font = await registry.register({
    family: "Arimo",
    source: await compress(arimoBytes()),
  });

  expect(font.data.kind).toBe("outline");
  expect(font.outlineFont).toBeDefined();
  if (font.data.kind !== "outline") throw new Error("Expected outline font data.");
  expect(font.data.bytes.byteLength).toBeGreaterThan(0);
  expect(font.data.metrics.unitsPerEm).toBeGreaterThan(0);
}, 15_000);

test("extracts the preferred woff2 URL from Google Fonts CSS", () => {
  expect(
    googleFontUrlFromCss(`
      /* latin-ext */
      @font-face {
        font-family: 'Arimo';
        src: url(https://fonts.gstatic.com/s/arimo/latin-ext.woff2) format('woff2');
      }
      /* latin */
      @font-face {
        font-family: 'Arimo';
        src: url(https://fonts.gstatic.com/s/arimo/latin.woff2) format('woff2');
      }
    `),
  ).toBe("https://fonts.gstatic.com/s/arimo/latin.woff2");
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
    const italicSkew = createFontItalicSkew(font);
    const underline = createFontUnderlineStyle(font, { fontSize });
    const strikeout = createFontStrikeoutStyle(font, { fontSize });
    const subscript = createFontScriptStyle(font, { fontSize, kind: "sub" });
    const superscript = createFontScriptStyle(font, { fontSize, kind: "super" });
    const metrics = font.data.metrics;
    const em = metrics.unitsPerEm;
    const ascenderRatio = metrics.ascender / em;
    const underlineTop =
      (metrics.ascender / em) * fontSize -
      ((metrics.underlinePosition ?? -em * 0.1) / em) * fontSize;
    const strikeoutHeight = metrics.capHeight ?? metrics.xHeight;
    const strikeoutTop =
      strikeoutHeight === undefined
        ? (metrics.ascender / em) * fontSize -
          ((metrics.strikeoutPosition ?? em * 0.25) / em) * fontSize
        : (metrics.ascender / em) * fontSize - (strikeoutHeight / em / 2) * fontSize;
    const expectedSubscriptFontSize = ((metrics.subscriptYSize ?? em * 0.5) / em) * fontSize;
    const expectedSuperscriptFontSize = ((metrics.superscriptYSize ?? em * 0.5) / em) * fontSize;
    const expectedSubscriptBaselineDelta = ((metrics.subscriptYOffset ?? em * 0.2) / em) * fontSize;
    const expectedSuperscriptBaselineDelta =
      -((metrics.superscriptYOffset ?? em * 0.2) / em) * fontSize;
    const subscriptBaselineDelta =
      subscript.baselineShift + ascenderRatio * (subscript.fontSize - fontSize);
    const superscriptBaselineDelta =
      superscript.baselineShift + ascenderRatio * (superscript.fontSize - fontSize);

    expect(italicSkew).toBe(
      metrics.italicAngle === undefined || metrics.italicAngle === 0
        ? undefined
        : Math.tan((-metrics.italicAngle * Math.PI) / 180),
    );
    expect(underline.thickness).toBeGreaterThanOrEqual(1);
    expect(underline.offset).toBeCloseTo(underlineTop, 4);
    expect(strikeout.thickness).toBeGreaterThanOrEqual(1);
    expect(strikeout.offset).toBeCloseTo(strikeoutTop, 4);

    expect(subscript.fontSize).toBeCloseTo(expectedSubscriptFontSize, 4);
    expect(subscriptBaselineDelta).toBeCloseTo(expectedSubscriptBaselineDelta, 4);

    expect(superscript.fontSize).toBeCloseTo(expectedSuperscriptFontSize, 4);
    expect(superscriptBaselineDelta).toBeCloseTo(expectedSuperscriptBaselineDelta, 4);
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
