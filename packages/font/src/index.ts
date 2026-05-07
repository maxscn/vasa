import { parseTextOutlineFont, type TextOutlineFont } from "@vasa/renderer";

export type FontSource = Uint8Array | ArrayBuffer | string;

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

const SCRIPT_SUBSCRIPT_OPTICAL_DROP = 0.125;
const SCRIPT_SUPERSCRIPT_OPTICAL_DROP = 0.075;
const SCRIPT_SUBSCRIPT_MIN_OFFSET = 0.138;
const SCRIPT_SUPERSCRIPT_MIN_OFFSET = 0.477;

const STANDARD_SANS_METRICS: VasaFontMetrics = {
  unitsPerEm: 2048,
  ascender: 1854,
  descender: -434,
  lineGap: 67,
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

      const font: VasaFont = {
        id,
        family: descriptor.family,
        displayName: descriptor.displayName ?? descriptor.family,
        weight,
        style,
        fallbackFamilies,
        cssFamily,
        ...fontFaceDataProps(bytes, descriptor),
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
  if (/(courier|mono|menlo|consolas|monaco|ui-monospace)/.test(family)) {
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
    };
  };
  const os2 = source.tables?.os2;

  return {
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: source.descender ?? 0,
    lineGap: source.tables?.hhea?.lineGap ?? 0,
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
    const fontSize = Math.max(6, Math.round(options.fontSize * fallbackScale));
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
  const scale = clamp((positive(ySize) ?? unitsPerEm * fallbackScale) / unitsPerEm, 0.45, 0.8);
  const fontSize = Math.max(6, Math.round(options.fontSize * scale));
  const minOffset =
    options.kind === "super" ? SCRIPT_SUPERSCRIPT_MIN_OFFSET : SCRIPT_SUBSCRIPT_MIN_OFFSET;
  const metricShift =
    (Math.max(positive(yOffset) ?? unitsPerEm * 0.2, unitsPerEm * minOffset) / unitsPerEm) *
    options.fontSize;
  const opticalDrop =
    options.kind === "super"
      ? options.fontSize * SCRIPT_SUPERSCRIPT_OPTICAL_DROP
      : options.fontSize * SCRIPT_SUBSCRIPT_OPTICAL_DROP;
  const baselineDelta =
    options.kind === "super" ? -metricShift + opticalDrop : metricShift + opticalDrop;
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
  const position = (positive(metrics.strikeoutPosition) ?? unitsPerEm * 0.25) / unitsPerEm;
  const thickness = Math.max(
    1,
    Math.round(
      ((positive(metrics.strikeoutSize) ?? unitsPerEm * 0.05) / unitsPerEm) * options.fontSize,
    ),
  );

  return {
    offset: ascender * options.fontSize - position * options.fontSize - thickness / 2,
    thickness,
  };
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

async function resolveFontBytes(source: FontSource | undefined): Promise<Uint8Array | undefined> {
  if (source === undefined) return undefined;
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok)
      throw new Error(`Unable to load font: ${response.status} ${response.statusText}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  if (source instanceof Uint8Array) return copyBytes(source);
  return new Uint8Array(source.slice(0));
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
