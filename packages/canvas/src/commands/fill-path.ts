import type { TextOutlinePath } from "@skriva/renderer";
import { paintSurfacePath } from "./paint-surface-path.js";
import { createCanvasCommand, type CanvasCommand } from "./types.js";

export function FillPath(props: { path: TextOutlinePath; fill: string }): CanvasCommand {
  return createCanvasCommand({ type: "fillPath", ...props }, (surface) => {
    surface.fillStyle = props.fill;
    paintSurfacePath(surface, props.path, { fill: true, stroke: false });
  });
}
