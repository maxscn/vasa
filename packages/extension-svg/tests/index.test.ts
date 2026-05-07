import { collectExtensionRenderers, collectRendererExtensions } from "@vasa/core";
import { expect, test } from "vite-plus/test";
import { createSvgExtension } from "../src/index.ts";

test("lets consumers order custom SVG renderers before the defaults", () => {
  const extension = createSvgExtension({
    rendererPlacement: "before",
    renderer: {
      name: "custom-render-node",
      toRenderNode: () => undefined,
    },
    renderers: {
      canvas: {
        name: "custom-canvas",
        toCanvasNodes: () => undefined,
      },
    },
  });

  expect(collectRendererExtensions([extension]).map((renderer) => renderer.name)).toEqual([
    "custom-render-node",
    "svg",
  ]);
  expect(collectExtensionRenderers([extension], "canvas").map((renderer) => renderer.name)).toEqual(
    ["custom-canvas", "svg"],
  );
});
