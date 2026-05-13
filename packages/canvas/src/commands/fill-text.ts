import { createCanvasCommand, type CanvasCommand } from "./types.js";

export function FillText(props: {
  text: string;
  x: number;
  y: number;
  font: string;
  fill: string;
}): CanvasCommand {
  return createCanvasCommand({ type: "fillText", ...props }, (surface) => {
    surface.fillStyle = props.fill;
    surface.font = props.font;
    surface.fillText(props.text, props.x, props.y);
  });
}
