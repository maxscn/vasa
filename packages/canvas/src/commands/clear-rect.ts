import type { Rect } from "@skriva/layout";
import { createCanvasCommand, type CanvasCommand } from "./types.js";

export function ClearRect(props: { rect: Rect }): CanvasCommand {
  return createCanvasCommand({ type: "clearRect", ...props }, (surface) => {
    surface.clearRect(props.rect.x, props.rect.y, props.rect.width, props.rect.height);
  });
}
