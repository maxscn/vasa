import "./opentype-js.d.ts";
import type { TextLine } from "@skriva/layout";
import type { OpenTypeFont } from "opentype.js";
export type TextOutlineFont = {
  unitsPerEm: number;
  ascender: number;
  descender?: number;
  bytes?: Uint8Array;
  source: OpenTypeFont;
};
export type TextOutlineFontOptions = {
  variations?: Record<string, number>;
};
export type TextOutlinePathCommand =
  | {
      type: "moveTo";
      x: number;
      y: number;
    }
  | {
      type: "lineTo";
      x: number;
      y: number;
    }
  | {
      type: "bezierCurveTo";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x: number;
      y: number;
    }
  | {
      type: "closePath";
    };
export type TextOutlinePath = {
  commands: TextOutlinePathCommand[];
};
export type TextOutlineOptions = {
  font: TextOutlineFont;
  fontSize: number;
  letterSpacing?: number;
  embolden?: number;
  skewX?: number;
};
export declare function parseTextOutlineFont(
  bytes: Uint8Array | ArrayBuffer,
  options?: TextOutlineFontOptions,
): TextOutlineFont;
export declare function createTextLineOutline(
  line: Pick<TextLine, "text" | "x" | "y">,
  options: TextOutlineOptions,
): TextOutlinePath;
export declare function textOutlinePathBounds(path: TextOutlinePath):
  | {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | undefined;
