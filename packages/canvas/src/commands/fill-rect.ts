import type { Rect } from "@skriva/layout";
import { createCanvasCommand, type CanvasCommand } from "./types.js";

export function FillRect(props: { rect: Rect; fill: string }): CanvasCommand {
  return createCanvasCommand({ type: "fillRect", ...props }, (surface) => {
    surface.fillStyle = props.fill;
    surface.fillRect(props.rect.x, props.rect.y, props.rect.width, props.rect.height);
  });
}
