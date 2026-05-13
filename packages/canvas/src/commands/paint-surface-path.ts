import type { SvgPath, TextOutlinePath } from "@skriva/renderer";
import { BeginPath, Fill, Stroke, SvgPathStep } from "./path-steps.js";
import type { CanvasSurface } from "./types.js";

export function paintSurfacePath(
  surface: CanvasSurface,
  path: TextOutlinePath | SvgPath,
  paint: { fill: boolean; stroke: boolean },
) {
  const commands = [
    BeginPath(),
    ...path.commands.map(SvgPathStep),
    ...(paint.fill ? [Fill()] : []),
    ...(paint.stroke ? [Stroke()] : []),
  ];

  for (const command of commands) {
    command.apply(surface);
  }
}
