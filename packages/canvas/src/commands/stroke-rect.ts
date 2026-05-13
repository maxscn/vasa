import type { Rect } from "@skriva/layout";
import { createCanvasCommand, type CanvasCommand } from "./types.js";

export function StrokeRect(props: { rect: Rect; stroke: string }): CanvasCommand {
  return createCanvasCommand({ type: "strokeRect", ...props }, (surface) => {
    surface.strokeStyle = props.stroke;
    surface.strokeRect(props.rect.x, props.rect.y, props.rect.width, props.rect.height);
  });
}
