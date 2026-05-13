import type { LayoutResult } from "@skriva/layout";
import type { RenderDocument } from "@skriva/renderer";
import { applyCanvasCommands, type CanvasSurface } from "../commands/index.js";
import { createCanvasCommands } from "./painting.js";
import { reconcileCanvasScenes, shouldPaint } from "./reconcile.js";
import { Scene } from "./scene.js";
import type {
  CanvasRenderResult,
  CanvasRenderer,
  CanvasRendererOptions,
  CanvasScene,
} from "./types.js";

export function Canvas(
  surface: CanvasSurface,
  options: CanvasRendererOptions = {},
): CanvasRenderer {
  let current: CanvasScene | undefined;

  return {
    render(document: LayoutResult | RenderDocument): CanvasRenderResult {
      const scene = Scene(document, options);
      const operations = reconcileCanvasScenes(current, scene);
      const didPaint = shouldPaint(operations);
      const commands = didPaint ? createCanvasCommands(scene, options) : [];

      if (didPaint) {
        applyCanvasCommands(surface, commands);
      }

      current = scene;

      return { scene, operations, commands, didPaint };
    },
    reset() {
      current = undefined;
    },
  };
}
