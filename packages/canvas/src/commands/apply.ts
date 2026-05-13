import type { CanvasCommand, CanvasSurface } from "./types.js";

export function applyCanvasCommands(surface: CanvasSurface, commands: CanvasCommand[]) {
  surface.textBaseline = "top";

  for (const command of commands) {
    command.apply(surface);
  }
}
