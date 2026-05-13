import type { SvgPathCommand } from "@skriva/renderer";
import { createCanvasCommand, type CanvasCommand } from "./types.js";

export function BeginPath(): CanvasCommand {
  return createCanvasCommand({ type: "beginPath" }, (surface) => surface.beginPath());
}

export function MoveTo(props: { x: number; y: number }): CanvasCommand {
  return createCanvasCommand({ type: "moveTo", ...props }, (surface) =>
    surface.moveTo(props.x, props.y),
  );
}

export function LineTo(props: { x: number; y: number }): CanvasCommand {
  return createCanvasCommand({ type: "lineTo", ...props }, (surface) =>
    surface.lineTo(props.x, props.y),
  );
}

export function BezierCurveTo(props: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
}): CanvasCommand {
  return createCanvasCommand({ type: "bezierCurveTo", ...props }, (surface) =>
    surface.bezierCurveTo(props.x1, props.y1, props.x2, props.y2, props.x, props.y),
  );
}

export function ClosePath(): CanvasCommand {
  return createCanvasCommand({ type: "closePath" }, (surface) => surface.closePath());
}

export function Fill(): CanvasCommand {
  return createCanvasCommand({ type: "fill" }, (surface) => surface.fill());
}

export function Stroke(): CanvasCommand {
  return createCanvasCommand({ type: "stroke" }, (surface) => surface.stroke());
}

export function SvgPathStep(command: SvgPathCommand): CanvasCommand {
  if (command.type === "moveTo") return MoveTo(command);
  if (command.type === "lineTo") return LineTo(command);
  if (command.type === "bezierCurveTo") return BezierCurveTo(command);
  return ClosePath();
}
