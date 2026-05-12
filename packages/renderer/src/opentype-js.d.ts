declare module "opentype.js" {
  export type OpenTypePathCommand =
    | { type: "M"; x: number; y: number }
    | { type: "L"; x: number; y: number }
    | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: "Q"; x1: number; y1: number; x: number; y: number }
    | { type: "Z" };

  export type OpenTypePath = {
    commands: OpenTypePathCommand[];
  };

  export type OpenTypeGlyph = {
    index: number;
    advanceWidth: number;
    getPath(
      x: number,
      y: number,
      fontSize: number,
      options?: { variation?: Record<string, number> },
      font?: OpenTypeFont,
    ): OpenTypePath;
  };

  export type OpenTypeFont = {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    defaultRenderOptions?: { variation?: Record<string, number> };
    charToGlyph(character: string): OpenTypeGlyph;
    variation?: {
      get(): Record<string, number>;
      set(coords: Record<string, number>): void;
    };
  };

  export function parse(buffer: ArrayBuffer): OpenTypeFont;

  const opentype: {
    parse(buffer: ArrayBuffer): OpenTypeFont;
  };
  export default opentype;
}

declare module "opentype.js/dist/opentype.mjs" {
  export {
    parse,
    type OpenTypeFont,
    type OpenTypeGlyph,
    type OpenTypePath,
    type OpenTypePathCommand,
  } from "opentype.js";
}
