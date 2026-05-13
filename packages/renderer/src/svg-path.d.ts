import type { Rect } from "@skriva/layout";
export type SvgPathCommand =
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
export type SvgPath = {
  commands: SvgPathCommand[];
};
export type SvgViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export declare function parseSvgPathData(data: string): SvgPath;
export declare function parseSvgViewBox(
  viewBox: string | undefined,
  width: number,
  height: number,
): {
  x: number;
  y: number;
  width: number;
  height: number;
};
export declare function transformSvgPath(path: SvgPath, viewBox: SvgViewBox, rect: Rect): SvgPath;
