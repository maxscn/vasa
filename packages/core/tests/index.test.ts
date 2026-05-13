import { expect, test } from "vite-plus/test";
import { Extension } from "@tiptap/core";
import type { LayoutNodeBase } from "@skriva/layout";
import {
  collectExtensionRenderers,
  collectLayoutExtensions,
  collectRendererExtensions,
  createSkrivaExtension,
  mergeExtensionRenderers,
  type SkrivaExtension,
} from "../src/index.ts";

type TestRuleNode = LayoutNodeBase<"testRule"> & {
  thickness: number;
};

declare module "@skriva/layout" {
  interface LayoutNodeByType {
    testRule: TestRuleNode;
  }
}

test("creates Skriva extensions that can carry Tiptap behavior and renderer hooks", () => {
  const tiptap = Extension.create({ name: "callout" });
  const renderer = {
    name: "callout",
    toRenderNode: () => undefined,
  };

  const extension = createSkrivaExtension({
    name: "callout",
    tiptap,
    renderer,
  });

  expect(extension.name).toBe("callout");
  expect(extension.tiptap).toBe(tiptap);
  expect(extension.renderer).toBe(renderer);
});

test("collects renderer extensions without exposing renderers to Tiptap plugins", () => {
  const extensions: SkrivaExtension[] = [
    createSkrivaExtension({
      name: "one",
      renderer: { name: "one", toRenderNode: () => undefined },
    }),
    createSkrivaExtension({
      name: "two",
      renderer: [
        { name: "two-a", toRenderNode: () => undefined },
        { name: "two-b", toRenderNode: () => undefined },
      ],
    }),
    createSkrivaExtension({
      name: "editing-only",
      tiptap: Extension.create({ name: "editing-only" }),
    }),
  ];

  expect(collectRendererExtensions(extensions).map((extension) => extension.name)).toEqual([
    "one",
    "two-a",
    "two-b",
  ]);
});

test("collects layout extensions for measurable document parts", () => {
  const extensions: SkrivaExtension[] = [
    createSkrivaExtension({
      name: "test-rule",
      layout: {
        name: "test-rule",
        match: (node): node is TestRuleNode => node.type === "testRule",
        measure: () => ({ width: 100, height: 2 }),
      },
    }),
    createSkrivaExtension({
      name: "editing-only",
      tiptap: Extension.create({ name: "editing-only" }),
    }),
  ];

  expect(collectLayoutExtensions(extensions).map((extension) => extension.name)).toEqual([
    "test-rule",
  ]);
});

test("collects named renderer adapters from extension registries", () => {
  type Renderers = {
    canvas: (value: string) => string;
    pdf: (value: string) => string;
  };

  const canvasRenderer = (value: string) => `canvas:${value}`;
  const extraCanvasRenderer = (value: string) => `extra-canvas:${value}`;
  const pdfRenderer = (value: string) => `pdf:${value}`;
  const extensions: Array<SkrivaExtension<Renderers>> = [
    createSkrivaExtension({
      name: "bold",
      renderers: { canvas: [canvasRenderer, extraCanvasRenderer] },
    }),
    createSkrivaExtension({ name: "fontFamily", renderers: { pdf: pdfRenderer } }),
  ];

  expect(collectExtensionRenderers(extensions, "canvas")).toEqual([
    canvasRenderer,
    extraCanvasRenderer,
  ]);
  expect(collectExtensionRenderers(extensions, "pdf")).toEqual([pdfRenderer]);
});

test("merges extension renderers around the default renderer", () => {
  const defaultRenderer = () => "default";
  const beforeRenderer = () => "before";
  const afterRenderer = () => "after";

  expect(mergeExtensionRenderers(defaultRenderer, undefined)).toBe(defaultRenderer);
  expect(mergeExtensionRenderers(defaultRenderer, afterRenderer)).toEqual([
    defaultRenderer,
    afterRenderer,
  ]);
  expect(mergeExtensionRenderers(defaultRenderer, [beforeRenderer], "before")).toEqual([
    beforeRenderer,
    defaultRenderer,
  ]);
});
