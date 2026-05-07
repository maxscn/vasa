import { collectExtensionRenderers } from "@vasa/core";
import { expect, test } from "vite-plus/test";
import { createBoldExtension } from "../src/index.ts";

test("lets consumers append text style renderers to bold", () => {
  const customRenderer = () => ({ fontWeight: "900" });
  const extension = createBoldExtension({
    renderers: {
      textStyle: customRenderer,
    },
  });

  const renderers = collectExtensionRenderers([extension], "textStyle");

  expect(renderers).toHaveLength(2);
  expect(renderers[0]?.()).toEqual({ fontWeight: "700" });
  expect(renderers[1]).toBe(customRenderer);
});

test("declares tiptap-style bold keyboard shortcuts", () => {
  const extension = createBoldExtension();
  const addKeyboardShortcuts = extension.tiptap?.config.addKeyboardShortcuts as
    | ((this: unknown) => Record<string, (event: unknown) => boolean>)
    | undefined;
  const shortcuts = addKeyboardShortcuts?.call({
    editor: {
      commands: {
        toggleBold: () => true,
      },
    },
  });

  expect(shortcuts).toHaveProperty("Mod-b");
  expect(shortcuts).toHaveProperty("Mod-B");
  expect(shortcuts?.["Mod-b"]?.({})).toBe(true);
});
