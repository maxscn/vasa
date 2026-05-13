import { DEFAULT_FONT_STYLE, DEFAULT_FONT_WEIGHT } from "./constants.js";
import {
  googleFontManifest,
  type GoogleFontFaceManifestEntry,
  type GoogleFontFamilyManifestEntry,
} from "./google-font-manifest.js";
import type { SkrivaFont } from "./index.js";

export type FontFaceRequest = {
  family: string;
  weight?: string | number;
  style?: string;
};

export type CreateFontCatalogOptions = {
  fonts: SkrivaFont[];
  manifest?: GoogleFontFamilyManifestEntry[];
  controlledFamilies?: string[];
};

export type FontCatalog = {
  list(): SkrivaFont[];
  resolveFace(request: FontFaceRequest): SkrivaFont;
  validateControlledFamilies(): void;
};

export class IncompleteControlledFontFamilyError extends Error {
  readonly code = "incomplete-controlled-font-family";

  constructor(
    readonly family: string,
    readonly missingFaces: GoogleFontFaceManifestEntry[],
  ) {
    super(
      `Controlled Google font family "${family}" is incomplete. Missing faces: ${missingFaces
        .map(formatFace)
        .join(", ")}.`,
    );
    this.name = "IncompleteControlledFontFamilyError";
  }
}

export class MissingFontFaceError extends Error {
  readonly code = "missing-font-face";

  constructor(readonly request: Required<FontFaceRequest>) {
    super(`No registered font face for "${request.family}" ${request.weight} ${request.style}.`);
    this.name = "MissingFontFaceError";
  }
}

export function createFontCatalog(options: CreateFontCatalogOptions): FontCatalog {
  const manifest = options.manifest ?? googleFontManifest;
  const controlledFamilies = new Set(
    options.controlledFamilies ?? controlledFamiliesFromFonts(options.fonts, manifest),
  );
  const catalog: FontCatalog = {
    list() {
      return [...options.fonts];
    },
    resolveFace(request) {
      const resolved = normalizeFaceRequest(request);
      const font = options.fonts.find(
        (candidate) =>
          candidate.family === resolved.family &&
          candidate.weight === resolved.weight &&
          candidate.style === resolved.style,
      );
      if (font === undefined) throw new MissingFontFaceError(resolved);
      return font;
    },
    validateControlledFamilies() {
      validateControlledFontFamilies(options.fonts, manifest, controlledFamilies);
    },
  };

  catalog.validateControlledFamilies();
  return catalog;
}

function validateControlledFontFamilies(
  fonts: SkrivaFont[],
  manifest: GoogleFontFamilyManifestEntry[],
  controlledFamilies: Set<string>,
) {
  for (const family of controlledFamilies) {
    const expected = manifest.find((entry) => entry.family === family);
    if (expected === undefined) continue;

    const registered = new Set(
      fonts
        .filter((font) => font.family === family)
        .map((font) => faceKey({ weight: font.weight, style: font.style })),
    );
    const missingFaces = expected.faces.filter((face) => !registered.has(faceKey(face)));
    if (missingFaces.length > 0) {
      throw new IncompleteControlledFontFamilyError(family, missingFaces);
    }
  }
}

function controlledFamiliesFromFonts(
  fonts: SkrivaFont[],
  manifest: GoogleFontFamilyManifestEntry[],
) {
  const manifestFamilies = new Set(manifest.map((entry) => entry.family));
  return [
    ...new Set(fonts.map((font) => font.family).filter((family) => manifestFamilies.has(family))),
  ];
}

function normalizeFaceRequest(request: FontFaceRequest): Required<FontFaceRequest> {
  return {
    family: request.family,
    weight: String(request.weight ?? DEFAULT_FONT_WEIGHT),
    style: request.style ?? DEFAULT_FONT_STYLE,
  };
}

function faceKey(face: GoogleFontFaceManifestEntry) {
  return `${face.weight}\u0000${face.style}`;
}

function formatFace(face: GoogleFontFaceManifestEntry) {
  return `${face.weight} ${face.style}`;
}
