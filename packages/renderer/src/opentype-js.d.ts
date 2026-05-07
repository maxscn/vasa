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
    getPath(x: number, y: number, fontSize: number): OpenTypePath;
  };

  export type OpenTypeFont = {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    charToGlyph(character: string): OpenTypeGlyph;
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
