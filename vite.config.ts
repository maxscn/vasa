import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

const workspacePackage = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@vasa/extension-blockquote": workspacePackage("packages/extension-blockquote/src/index.ts"),
      "@vasa/extension-document": workspacePackage("packages/extension-document/src/index.ts"),
      "@vasa/extension-heading": workspacePackage("packages/extension-heading/src/index.ts"),
      "@vasa/extension-horizontal-rule": workspacePackage(
        "packages/extension-horizontal-rule/src/index.ts",
      ),
      "@vasa/extension-paragraph": workspacePackage("packages/extension-paragraph/src/index.ts"),
      "@vasa/extension-table": workspacePackage("packages/extension-table/src/index.ts"),
      "@vasa/extension-text": workspacePackage("packages/extension-text/src/index.ts"),
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
