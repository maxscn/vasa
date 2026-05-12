import { parseTextOutlineFont, type TextOutlineFont } from "@vasa/renderer";
import type { Wawoff2DecompressBinding } from "wawoff2/build/decompress_binding.js";

export type FontSource =
  | Uint8Array
  | ArrayBuffer
  | string
  | (() => FontSource | Promise<FontSource>);

export type FontDescriptor = {
  id?: string;
  family: string;
  displayName?: string;
  source?: FontSource;
  runtimeSource?: FontSource;
  metrics?: VasaFontMetrics;
  weight?: string | number;
  style?: string;
  fallbackFamilies?: string[];
};

export type VasaFontMetrics = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineGap: number;
  italicAngle?: number;
  underlinePosition?: number;
  underlineThickness?: number;
  strikeoutPosition?: number;
  strikeoutSize?: number;
  subscriptYOffset?: number;
  subscriptYSize?: number;
  superscriptYOffset?: number;
  superscriptYSize?: number;
  xHeight?: number;
  capHeight?: number;
};

export type VasaFontFaceData =
  | {
      kind: "outline";
      bytes: Uint8Array;
      metrics: VasaFontMetrics;
      outlineFont: TextOutlineFont;
    }
  | {
      kind: "native";
      metrics?: VasaFontMetrics;
    };

export type VasaFont = {
  id: string;
  family: string;
  displayName: string;
  weight: string;
  style: string;
  fallbackFamilies: string[];
  cssFamily: string;
  data: VasaFontFaceData;
  outlineFont?: TextOutlineFont;
};

export type FontScriptKind = "sub" | "super";

export type FontScriptStyle = {
  fontSize: number;
  baselineShift: number;
};

export type FontTextDecorationStyle = {
  offset: number;
  thickness: number;
};

export type FontRegistry = {
  register(descriptor: FontDescriptor): Promise<VasaFont>;
  list(): VasaFont[];
  get(id: string): VasaFont | undefined;
};

export type GoogleFontDescriptorOptions = {
  basePath?: string;
  display?: string;
  subset?: string;
  style?: string;
};

type FontFaceConstructor = new (
  family: string,
  source: string | ArrayBuffer,
  descriptors?: {
    style?: string;
    weight?: string;
  },
) => LoadableFontFace;

type LoadableFontFace = {
  load(): Promise<LoadableFontFace>;
};

type RuntimeFontSet = {
  add(face: LoadableFontFace): void;
};

export type CreateFontRegistryOptions = {
  fontFace?: FontFaceConstructor;
  fontSet?: RuntimeFontSet;
};

const STANDARD_SANS_METRICS: VasaFontMetrics = {
  unitsPerEm: 2048,
  ascender: 1854,
  descender: -434,
  lineGap: 67,
  italicAngle: 0,
  underlinePosition: -217,
  underlineThickness: 102,
  strikeoutPosition: 530,
  strikeoutSize: 102,
  subscriptYOffset: 283,
  subscriptYSize: 1331,
  superscriptYOffset: 977,
  superscriptYSize: 1331,
  xHeight: 1082,
  capHeight: 1409,
};

const STANDARD_SERIF_METRICS: VasaFontMetrics = {
  unitsPerEm: 2048,
  ascender: 1825,
  descender: -443,
  lineGap: 87,
  italicAngle: 0,
  underlinePosition: -217,
  underlineThickness: 102,
  strikeoutPosition: 530,
  strikeoutSize: 102,
  subscriptYOffset: 287,
  subscriptYSize: 1331,
  superscriptYOffset: 977,
  superscriptYSize: 1331,
  xHeight: 916,
  capHeight: 1356,
};

const STANDARD_MONO_METRICS: VasaFontMetrics = {
  unitsPerEm: 2048,
  ascender: 1705,
  descender: -615,
  lineGap: 0,
  italicAngle: 0,
  underlinePosition: -217,
  underlineThickness: 102,
  strikeoutPosition: 530,
  strikeoutSize: 102,
  subscriptYOffset: 287,
  subscriptYSize: 1331,
  superscriptYOffset: 977,
  superscriptYSize: 1331,
  xHeight: 1056,
  capHeight: 1269,
};

export function createFontRegistry(options: CreateFontRegistryOptions = {}): FontRegistry {
  const fonts = new Map<string, VasaFont>();

  return {
    async register(descriptor) {
      const id = descriptor.id ?? fontIdFromFamily(descriptor.family, fonts.size);
      const weight = String(descriptor.weight ?? "400");
      const style = descriptor.style ?? "normal";
      const fallbackFamilies = descriptor.fallbackFamilies ?? ["Arial", "sans-serif"];
      const cssFamily = createCssFontFamily(descriptor.family, fallbackFamilies);
      const bytes = await resolveFontBytes(descriptor.source);

      if (bytes !== undefined) {
        await loadRuntimeFontFace(
          {
            family: descriptor.family,
            source: descriptor.runtimeSource ?? descriptor.source,
            bytes,
            weight,
            style,
          },
          options,
        ).catch(() => undefined);
      }

      const outlineBytes = await normalizeOutlineFontBytes(bytes).catch(() => undefined);
      const font: VasaFont = {
        id,
        family: descriptor.family,
        displayName: descriptor.displayName ?? descriptor.family,
        weight,
        style,
        fallbackFamilies,
        cssFamily,
        ...fontFaceDataProps(outlineBytes, descriptor),
      };
      fonts.set(font.id, font);
      return font;
    },
    list() {
      return [...fonts.values()];
    },
    get(id) {
      return fonts.get(id);
    },
  };
}

function fontFaceDataProps(
  bytes: Uint8Array | undefined,
  descriptor: Pick<FontDescriptor, "family" | "fallbackFamilies" | "metrics" | "weight">,
): Pick<VasaFont, "data" | "outlineFont"> {
  if (bytes === undefined) {
    return {
      data: {
        kind: "native",
        metrics: descriptor.metrics ?? createStandardFontMetrics(descriptor),
      },
    };
  }

  try {
    const outlineFont = parseTextOutlineFont(bytes, {
      variations: fontVariationCoordinates(descriptor),
    });
    return {
      data: {
        kind: "outline",
        bytes: copyBytes(bytes),
        metrics: fontMetrics(outlineFont),
        outlineFont,
      },
      outlineFont,
    };
  } catch {
    return {
      data: {
        kind: "native",
        metrics: descriptor.metrics ?? createStandardFontMetrics(descriptor),
      },
    };
  }
}

function fontVariationCoordinates(descriptor: Pick<FontDescriptor, "weight">) {
  const weight = Number(descriptor.weight);
  if (!Number.isFinite(weight)) return undefined;
  return { wght: weight };
}

export function createStandardFontMetrics(
  font: Pick<FontDescriptor, "family" | "fallbackFamilies">,
): VasaFontMetrics {
  const family = [font.family, ...(font.fallbackFamilies ?? [])].join(" ").toLowerCase();
  if (/(courier|mono|menlo|consolas|monaco)/.test(family)) {
    return { ...STANDARD_MONO_METRICS };
  }
  if (/(times|georgia|garamond|serif)/.test(family) && !/sans-serif/.test(family)) {
    return { ...STANDARD_SERIF_METRICS };
  }

  return { ...STANDARD_SANS_METRICS };
}

function fontMetrics(font: TextOutlineFont): VasaFontMetrics {
  const source = font.source as {
    descender?: number;
    tables?: {
      hhea?: { lineGap?: number };
      os2?: {
        yStrikeoutPosition?: number;
        yStrikeoutSize?: number;
        ySubscriptYOffset?: number;
        ySubscriptYSize?: number;
        ySuperscriptYOffset?: number;
        ySuperscriptYSize?: number;
        sxHeight?: number;
        sCapHeight?: number;
      };
      post?: {
        italicAngle?: number;
        underlinePosition?: number;
        underlineThickness?: number;
      };
    };
  };
  const os2 = source.tables?.os2;
  const post = source.tables?.post;

  return {
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: source.descender ?? 0,
    lineGap: source.tables?.hhea?.lineGap ?? 0,
    ...(post?.italicAngle === undefined ? {} : { italicAngle: post.italicAngle }),
    ...(post?.underlinePosition === undefined ? {} : { underlinePosition: post.underlinePosition }),
    ...(post?.underlineThickness === undefined
      ? {}
      : { underlineThickness: post.underlineThickness }),
    ...(os2?.yStrikeoutPosition === undefined ? {} : { strikeoutPosition: os2.yStrikeoutPosition }),
    ...(os2?.yStrikeoutSize === undefined ? {} : { strikeoutSize: os2.yStrikeoutSize }),
    ...(os2?.ySubscriptYOffset === undefined ? {} : { subscriptYOffset: os2.ySubscriptYOffset }),
    ...(os2?.ySubscriptYSize === undefined ? {} : { subscriptYSize: os2.ySubscriptYSize }),
    ...(os2?.ySuperscriptYOffset === undefined
      ? {}
      : { superscriptYOffset: os2.ySuperscriptYOffset }),
    ...(os2?.ySuperscriptYSize === undefined ? {} : { superscriptYSize: os2.ySuperscriptYSize }),
    ...(os2?.sxHeight === undefined ? {} : { xHeight: os2.sxHeight }),
    ...(os2?.sCapHeight === undefined ? {} : { capHeight: os2.sCapHeight }),
  };
}

export function createFontScriptStyle(
  font: Pick<VasaFont, "data">,
  options: { fontSize: number; kind: FontScriptKind; fallbackScale?: number },
): FontScriptStyle {
  const metrics = font.data.metrics;
  const fallbackScale = options.fallbackScale ?? 0.5;
  if (metrics === undefined) {
    const fontSize = Math.max(1, options.fontSize * fallbackScale);
    const baselineDelta =
      options.kind === "super" ? -options.fontSize * 0.45 : options.fontSize * 0.2;

    return {
      fontSize,
      baselineShift: baselineDelta + options.fontSize * 0.9 - fontSize * 0.9,
    };
  }

  const unitsPerEm = positive(metrics.unitsPerEm) ?? 1;
  const ySize = options.kind === "super" ? metrics.superscriptYSize : metrics.subscriptYSize;
  const yOffset = options.kind === "super" ? metrics.superscriptYOffset : metrics.subscriptYOffset;
  const scale = (positive(ySize) ?? unitsPerEm * fallbackScale) / unitsPerEm;
  const fontSize = Math.max(1, options.fontSize * scale);
  const metricShift = ((positive(yOffset) ?? unitsPerEm * 0.2) / unitsPerEm) * options.fontSize;
  const baselineDelta = options.kind === "super" ? -metricShift : metricShift;
  const ascenderRatio = clamp(
    (positive(metrics.ascender) ?? unitsPerEm * 0.9) / unitsPerEm,
    0.6,
    1.1,
  );

  return {
    fontSize,
    baselineShift: baselineDelta + ascenderRatio * (options.fontSize - fontSize),
  };
}

export function createFontUnderlineStyle(
  font: Pick<VasaFont, "data">,
  options: { fontSize: number },
): FontTextDecorationStyle {
  const metrics = font.data.metrics;
  if (metrics === undefined) {
    return {
      offset: options.fontSize,
      thickness: Math.max(1, Math.round(options.fontSize * 0.06)),
    };
  }

  const unitsPerEm = positive(metrics.unitsPerEm) ?? 1;
  const ascender = metrics.ascender / unitsPerEm;
  const position = (metrics.underlinePosition ?? -unitsPerEm * 0.1) / unitsPerEm;
  const thickness = Math.max(
    1,
    Math.round(
      ((positive(metrics.underlineThickness) ?? unitsPerEm * 0.05) / unitsPerEm) * options.fontSize,
    ),
  );

  return {
    offset: ascender * options.fontSize - position * options.fontSize,
    thickness,
  };
}

export function createFontStrikeoutStyle(
  font: Pick<VasaFont, "data">,
  options: { fontSize: number },
): FontTextDecorationStyle {
  const metrics = font.data.metrics;
  if (metrics === undefined) {
    return {
      offset: options.fontSize * 0.6,
      thickness: Math.max(1, Math.round(options.fontSize * 0.06)),
    };
  }

  const unitsPerEm = positive(metrics.unitsPerEm) ?? 1;
  const ascender = metrics.ascender / unitsPerEm;
  const visualHeight = positive(metrics.capHeight) ?? positive(metrics.xHeight);
  const position =
    visualHeight === undefined
      ? (positive(metrics.strikeoutPosition) ?? unitsPerEm * 0.25) / unitsPerEm
      : visualHeight / unitsPerEm / 2;
  const thickness = Math.max(
    1,
    Math.round(
      ((positive(metrics.strikeoutSize) ?? unitsPerEm * 0.05) / unitsPerEm) * options.fontSize,
    ),
  );

  return {
    offset: ascender * options.fontSize - position * options.fontSize,
    thickness,
  };
}

export function createFontItalicSkew(font: Pick<VasaFont, "data">): number | undefined {
  const angle = font.data.metrics?.italicAngle;
  if (angle === undefined || angle === 0) return undefined;
  return Math.tan((-angle * Math.PI) / 180);
}

export function createCssFontFamily(family: string, fallbackFamilies: string[] = []) {
  return [quoteFontFamily(family), ...fallbackFamilies].join(", ");
}

export function createCanvasFontValue(
  font: Pick<VasaFont, "cssFamily" | "style" | "weight">,
  options: { fontSize: number },
) {
  return `${font.style} ${font.weight} ${formatCssPixels(options.fontSize)} ${font.cssFamily}`;
}

export const googleFontAssetBasePath = "/__vasa-assets/fonts/google";

export const arimoRegularFont: VasaFont = createNativeFont({
  id: "arimo-400",
  family: "Arimo",
  displayName: "Arimo",
  weight: "400",
  fallbackFamilies: ["Arial", "sans-serif"],
});

export const arimoFallbackFont: VasaFont = {
  ...arimoRegularFont,
  id: "arimo",
};

export function createGoogleFontDescriptor(
  family: string,
  file: string,
  weight = "400",
  options: GoogleFontDescriptorOptions = {},
): FontDescriptor {
  const style = options.style ?? "normal";
  return {
    id: `${fontIdFromFamily(family, 0)}-${weight}${style === "normal" ? "" : `-${style}`}`,
    family,
    displayName: family,
    source:
      options.basePath === undefined
        ? createGoogleFontSource(family, weight, options)
        : `${options.basePath}/${file}`,
    weight,
    style,
    fallbackFamilies: ["Arial", "sans-serif"],
  };
}

export function createGoogleFontSource(
  family: string,
  weight = "400",
  options: Pick<GoogleFontDescriptorOptions, "display" | "style" | "subset"> = {},
): () => Promise<Uint8Array> {
  const url = googleFontsCssUrl(family, weight, options);
  const cacheKey = `${url}\u0000${options.subset ?? "latin"}`;
  return async () => {
    const cached = googleFontSourceCache.get(cacheKey);
    if (cached !== undefined) return copyBytes(await cached);

    const promise = resolveGoogleFontBytes(url, options.subset);
    googleFontSourceCache.set(cacheKey, promise);
    return copyBytes(await promise);
  };
}

export function createGoogleFontDescriptors(options: GoogleFontDescriptorOptions = {}) {
  return [
    createGoogleFontDescriptor("Arimo", "arimo/Arimo-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Arimo", "arimo/Arimo-700.ttf", "700", options),
    createGoogleFontDescriptor("Arimo", "arimo/Arimo-400-italic.ttf", "400", {
      ...options,
      style: "italic",
    }),
    createGoogleFontDescriptor("Arimo", "arimo/Arimo-700-italic.ttf", "700", {
      ...options,
      style: "italic",
    }),
    createGoogleFontDescriptor("Geist", "geist/Geist-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Geist", "geist/Geist-700.ttf", "700", options),
    createGoogleFontDescriptor("Geist", "geist/Geist-400-italic.ttf", "400", {
      ...options,
      style: "italic",
    }),
    createGoogleFontDescriptor("Geist", "geist/Geist-700-italic.ttf", "700", {
      ...options,
      style: "italic",
    }),
    createGoogleFontDescriptor("Inter", "inter/Inter-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Inter", "inter/Inter-700.ttf", "700", options),
    createGoogleFontDescriptor("Inter", "inter/Inter-400-italic.ttf", "400", {
      ...options,
      style: "italic",
    }),
    createGoogleFontDescriptor("Inter", "inter/Inter-700-italic.ttf", "700", {
      ...options,
      style: "italic",
    }),
    createGoogleFontDescriptor("Lora", "lora/Lora-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Lora", "lora/Lora-700.ttf", "700", options),
    createGoogleFontDescriptor(
      "Merriweather",
      "merriweather/Merriweather-Regular.ttf",
      "400",
      options,
    ),
    createGoogleFontDescriptor("Merriweather", "merriweather/Merriweather-700.ttf", "700", options),
    createGoogleFontDescriptor("Montserrat", "montserrat/Montserrat-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Montserrat", "montserrat/Montserrat-700.ttf", "700", options),
    createGoogleFontDescriptor("Nunito", "nunito/Nunito-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Nunito", "nunito/Nunito-700.ttf", "700", options),
    createGoogleFontDescriptor("Oswald", "oswald/Oswald-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Oswald", "oswald/Oswald-700.ttf", "700", options),
    createGoogleFontDescriptor(
      "Playfair Display",
      "playfairdisplay/PlayfairDisplay-Regular.ttf",
      "400",
      options,
    ),
    createGoogleFontDescriptor(
      "Playfair Display",
      "playfairdisplay/PlayfairDisplay-700.ttf",
      "700",
      options,
    ),
    createGoogleFontDescriptor("Roboto", "roboto/Roboto-Regular.ttf", "400", options),
    createGoogleFontDescriptor("Roboto", "roboto/Roboto-700.ttf", "700", options),
    createGoogleFontDescriptor(
      "Source Serif 4",
      "sourceserif4/SourceSerif4-Regular.ttf",
      "400",
      options,
    ),
    createGoogleFontDescriptor(
      "Source Serif 4",
      "sourceserif4/SourceSerif4-700.ttf",
      "700",
      options,
    ),
    createGoogleFontDescriptor(
      "Space Grotesk",
      "spacegrotesk/SpaceGrotesk-Regular.ttf",
      "400",
      options,
    ),
    createGoogleFontDescriptor(
      "Space Grotesk",
      "spacegrotesk/SpaceGrotesk-700.ttf",
      "700",
      options,
    ),
  ] satisfies FontDescriptor[];
}

function createNativeFont(
  descriptor: Required<Pick<FontDescriptor, "id" | "family" | "displayName" | "weight">> &
    Pick<FontDescriptor, "style" | "fallbackFamilies">,
): VasaFont {
  const fallbackFamilies = descriptor.fallbackFamilies ?? ["Arial", "sans-serif"];
  return {
    id: descriptor.id,
    family: descriptor.family,
    displayName: descriptor.displayName,
    weight: String(descriptor.weight),
    style: descriptor.style ?? "normal",
    fallbackFamilies,
    cssFamily: createCssFontFamily(descriptor.family, fallbackFamilies),
    data: {
      kind: "native",
      metrics: createStandardFontMetrics({
        family: descriptor.family,
        fallbackFamilies,
      }),
    },
  };
}

async function resolveFontBytes(source: FontSource | undefined): Promise<Uint8Array | undefined> {
  if (source === undefined) return undefined;
  if (typeof source === "function") return resolveFontBytes(await source());
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok)
      throw new Error(`Unable to load font: ${response.status} ${response.statusText}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  if (source instanceof Uint8Array) return copyBytes(source);
  return new Uint8Array(source.slice(0));
}

async function normalizeOutlineFontBytes(bytes: Uint8Array | undefined) {
  if (bytes === undefined) return undefined;
  if (!isWoff2(bytes)) return bytes;

  return copyBytes(await decompressWoff2(bytes));
}

async function decompressWoff2(bytes: Uint8Array) {
  const module = await import("wawoff2/build/decompress_binding.js");
  const binding = module.default;
  await waitForWoff2Runtime(binding);

  const result = binding.decompress(copyBytes(bytes));
  if (result === false) throw new Error("ConvertWOFF2ToTTF failed");
  return result;
}

function waitForWoff2Runtime(binding: Wawoff2DecompressBinding) {
  if (binding.calledRun === true) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const current = binding.onRuntimeInitialized;
    binding.onRuntimeInitialized = () => {
      current?.();
      resolve();
    };
  });
}

async function loadRuntimeFontFace(
  font: {
    family: string;
    source: FontSource | undefined;
    bytes: Uint8Array;
    weight: string;
    style: string;
  },
  options: CreateFontRegistryOptions,
) {
  const runtime = runtimeFontEnvironment(options);
  if (runtime.fontFace === undefined || runtime.fontSet === undefined) return;

  const faceSource =
    typeof font.source === "string" ? `url("${font.source}")` : copyBytes(font.bytes).buffer;
  const face = new runtime.fontFace(font.family, faceSource, {
    weight: font.weight,
    style: font.style,
  });
  runtime.fontSet.add(await face.load());
}

function runtimeFontEnvironment(options: CreateFontRegistryOptions) {
  const global = globalThis as typeof globalThis & {
    FontFace?: FontFaceConstructor;
    document?: { fonts?: RuntimeFontSet };
  };

  return {
    fontFace: options.fontFace ?? global.FontFace,
    fontSet: options.fontSet ?? global.document?.fonts,
  };
}

function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

const googleFontSourceCache = new Map<string, Promise<Uint8Array>>();

function googleFontsCssUrl(
  family: string,
  weight: string,
  options: Pick<GoogleFontDescriptorOptions, "display" | "style">,
) {
  const style = options.style ?? "normal";
  const query = new URLSearchParams({
    family:
      style === "italic"
        ? `${family.replaceAll(" ", "+")}:ital,wght@1,${weight}`
        : `${family.replaceAll(" ", "+")}:wght@${weight}`,
    display: options.display ?? "swap",
  });
  return `https://fonts.googleapis.com/css2?${query.toString().replaceAll("%2B", "+")}`;
}

async function resolveGoogleFontBytes(cssUrl: string, subset: string | undefined) {
  const cssResponse = await fetch(cssUrl);
  if (!cssResponse.ok) {
    throw new Error(
      `Unable to load Google Font CSS: ${cssResponse.status} ${cssResponse.statusText}`,
    );
  }

  const fontUrl = googleFontUrlFromCss(await cssResponse.text(), subset);
  const fontResponse = await fetch(fontUrl);
  if (!fontResponse.ok) {
    throw new Error(
      `Unable to load Google Font: ${fontResponse.status} ${fontResponse.statusText}`,
    );
  }

  return new Uint8Array(await fontResponse.arrayBuffer());
}

export function googleFontUrlFromCss(css: string, subset = "latin") {
  const blocks = [...css.matchAll(/\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*{([^}]+)}/g)];
  const preferred = blocks.find((match) => match[1]?.trim() === subset) ?? blocks.at(-1);
  const source = preferred?.[2] ?? css;
  const url = /url\((?:'|")?([^'")]+\.woff2)(?:'|")?\)/.exec(source)?.[1];
  if (url === undefined) throw new Error("Unable to find a WOFF2 font URL in Google Font CSS.");
  return url;
}

function isWoff2(bytes: Uint8Array) {
  return bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32;
}

function quoteFontFamily(family: string) {
  if (/^[a-z][\w-]*$/i.test(family)) return family;
  return `"${family.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function formatCssPixels(value: number) {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(4))}px`;
}

function positive(value: number | undefined) {
  return value === undefined || value <= 0 ? undefined : value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fontIdFromFamily(family: string, index: number) {
  const slug = family
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
  return slug.length > 0 ? slug : `font-${index + 1}`;
}
