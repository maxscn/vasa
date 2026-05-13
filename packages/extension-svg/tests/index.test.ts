// @vitest-environment happy-dom
import { collectExtensionRenderers, collectRendererExtensions } from "@skriva/core";
import { expect, test } from "vite-plus/test";
import { createSvgExtension, createSvgNodeFromSource, readSvgFileAsNode } from "../src/index.ts";

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

test("creates SVG nodes from browser SVG sources", () => {
  const node = createSvgNodeFromSource(
    '<svg viewBox="0 0 20 10"><title>Badge</title><rect x="1" y="2" width="8" height="4" fill="#fff" stroke="none" /></svg>',
    { id: "badge" },
  );

  expect(node).toMatchObject({
    type: "svg",
    id: "badge",
    width: 20,
    height: 10,
    viewBox: "0 0 20 10",
    title: "Badge",
  });
  expect(node.paths).toEqual([
    {
      d: "M1 2 L9 2 L9 6 L1 6 Z",
      fill: "#fff",
      stroke: undefined,
      strokeWidth: undefined,
    },
  ]);
});

test("uses the file name as the fallback title for imported SVG files", async () => {
  const file = new File(['<svg width="8" height="8"><path d="M0 0 L8 8" /></svg>'], "line.svg", {
    type: "image/svg+xml",
  });

  await expect(readSvgFileAsNode(file, { id: "line" })).resolves.toMatchObject({
    id: "line",
    title: "line.svg",
  });
});
