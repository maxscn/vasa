import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

const workspacePackage = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@vasa/core": workspacePackage("packages/core/src/index.ts"),
      "@vasa/extension-blockquote": workspacePackage("packages/extension-blockquote/src/index.ts"),
      "@vasa/extension-bold": workspacePackage("packages/extension-bold/src/index.ts"),
      "@vasa/extension-code": workspacePackage("packages/extension-code/src/index.ts"),
      "@vasa/extension-color": workspacePackage("packages/extension-color/src/index.ts"),
      "@vasa/extension-document": workspacePackage("packages/extension-document/src/index.ts"),
      "@vasa/extension-font-family": workspacePackage(
        "packages/extension-font-family/src/index.ts",
      ),
      "@vasa/extension-font-size": workspacePackage("packages/extension-font-size/src/index.ts"),
      "@vasa/extension-heading": workspacePackage("packages/extension-heading/src/index.ts"),
      "@vasa/extension-highlight": workspacePackage("packages/extension-highlight/src/index.ts"),
      "@vasa/extension-horizontal-rule": workspacePackage(
        "packages/extension-horizontal-rule/src/index.ts",
      ),
      "@vasa/extension-line-height": workspacePackage(
        "packages/extension-line-height/src/index.ts",
      ),
      "@vasa/extension-paragraph": workspacePackage("packages/extension-paragraph/src/index.ts"),
      "@vasa/extension-italic": workspacePackage("packages/extension-italic/src/index.ts"),
      "@vasa/extension-strike": workspacePackage("packages/extension-strike/src/index.ts"),
      "@vasa/extension-subscript": workspacePackage("packages/extension-subscript/src/index.ts"),
      "@vasa/extension-superscript": workspacePackage(
        "packages/extension-superscript/src/index.ts",
      ),
      "@vasa/extension-svg": workspacePackage("packages/extension-svg/src/index.ts"),
      "@vasa/extension-table": workspacePackage("packages/extension-table/src/index.ts"),
      "@vasa/extension-text": workspacePackage("packages/extension-text/src/index.ts"),
      "@vasa/extension-text-style": workspacePackage("packages/extension-text-style/src/index.ts"),
      "@vasa/extension-underline": workspacePackage("packages/extension-underline/src/index.ts"),
      "@vasa/font": workspacePackage("packages/font/src/index.ts"),
      "@vasa/layout": workspacePackage("packages/layout/src/index.ts"),
      "@vasa/pdf": workspacePackage("packages/pdf/src/index.ts"),
      "@vasa/renderer": workspacePackage("packages/renderer/src/index.ts"),
    },
  },
  test: {
    exclude: [
      "**/tiptap/**",
      "**/node_modules/**",
      "**/.ignored/**",
      "**/dist/**",
      "**/.output/**",
      "**/.nitro/**",
      "**/.next/**",
      "**/tests/browser/**",
    ],
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "tiptap/**",
      ".output/**",
      ".nitro/**",
      ".next/**",
      "dist/**",
      "**/routeTree.gen.ts",
    ],
  },
  lint: {
    ignorePatterns: [
      "tiptap/**",
      ".output/**",
      ".nitro/**",
      ".next/**",
      "dist/**",
      "**/routeTree.gen.ts",
    ],
    options: { typeAware: true, typeCheck: true },
  },
});
