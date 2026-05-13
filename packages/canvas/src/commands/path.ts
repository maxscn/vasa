import type { SvgPath } from "@skriva/renderer";
import { DEFAULT_STROKE_WIDTH } from "../constants.js";
import { paintSurfacePath } from "./paint-surface-path.js";
import { createCanvasCommand, type CanvasCommand } from "./types.js";

export function Path(props: {
  path: SvgPath;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}): CanvasCommand {
  return createCanvasCommand({ type: "path", ...props }, (surface) => {
    if (props.fill !== undefined) surface.fillStyle = props.fill;
    if (props.stroke !== undefined) surface.strokeStyle = props.stroke;
    surface.lineWidth = props.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    paintSurfacePath(surface, props.path, {
      fill: props.fill !== undefined,
      stroke: props.stroke !== undefined,
    });
  });
}
