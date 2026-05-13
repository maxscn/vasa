import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

const workspacePackage = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@opeinspection/skriva/canvas": workspacePackage("packages/editor/canvas.ts"),
      "@opeinspection/skriva/enrichment": workspacePackage("packages/editor/enrichment.ts"),
      "@opeinspection/skriva/enrichments/horizontal-rule": workspacePackage(
        "packages/editor/enrichments/horizontal-rule.ts",
      ),
      "@opeinspection/skriva/enrichments/line-height": workspacePackage(
        "packages/editor/enrichments/line-height.ts",
      ),
      "@opeinspection/skriva/enrichments/svg": workspacePackage(
        "packages/editor/enrichments/svg.ts",
      ),
      "@opeinspection/skriva/enrichments/table": workspacePackage(
        "packages/editor/enrichments/table.ts",
      ),
      "@opeinspection/skriva/font": workspacePackage("packages/editor/font.ts"),
      "@opeinspection/skriva/headless": workspacePackage("packages/editor/headless.ts"),
      "@opeinspection/skriva/layout": workspacePackage("packages/editor/layout.ts"),
      "@opeinspection/skriva/pdf": workspacePackage("packages/editor/pdf.ts"),
      "@opeinspection/skriva/react": workspacePackage("packages/editor/react.ts"),
      "@opeinspection/skriva/renderer": workspacePackage("packages/editor/renderer.ts"),
      "@opeinspection/skriva": workspacePackage("packages/editor/src/index.ts"),
      "@skriva/core": workspacePackage("packages/core/src/index.ts"),
      "@skriva/extension-blockquote": workspacePackage(
        "packages/extension-blockquote/src/index.ts",
      ),
      "@skriva/extension-bold": workspacePackage("packages/extension-bold/src/index.ts"),
      "@skriva/extension-code": workspacePackage("packages/extension-code/src/index.ts"),
      "@skriva/extension-color": workspacePackage("packages/extension-color/src/index.ts"),
      "@skriva/extension-document": workspacePackage("packages/extension-document/src/index.ts"),
      "@skriva/extension-font-family": workspacePackage(
        "packages/extension-font-family/src/index.ts",
      ),
      "@skriva/extension-font-size": workspacePackage("packages/extension-font-size/src/index.ts"),
      "@skriva/extension-heading": workspacePackage("packages/extension-heading/src/index.ts"),
      "@skriva/extension-highlight": workspacePackage("packages/extension-highlight/src/index.ts"),
      "@skriva/extension-horizontal-rule": workspacePackage(
        "packages/extension-horizontal-rule/src/index.ts",
      ),
      "@skriva/extension-line-height": workspacePackage(
        "packages/extension-line-height/src/index.ts",
      ),
      "@skriva/extension-paragraph": workspacePackage("packages/extension-paragraph/src/index.ts"),
      "@skriva/extension-italic": workspacePackage("packages/extension-italic/src/index.ts"),
      "@skriva/extension-strike": workspacePackage("packages/extension-strike/src/index.ts"),
      "@skriva/extension-subscript": workspacePackage("packages/extension-subscript/src/index.ts"),
      "@skriva/extension-superscript": workspacePackage(
        "packages/extension-superscript/src/index.ts",
      ),
      "@skriva/extension-svg": workspacePackage("packages/extension-svg/src/index.ts"),
      "@skriva/extension-table": workspacePackage("packages/extension-table/src/index.ts"),
      "@skriva/extension-text": workspacePackage("packages/extension-text/src/index.ts"),
      "@skriva/extension-text-style": workspacePackage(
        "packages/extension-text-style/src/index.ts",
      ),
      "@skriva/extension-underline": workspacePackage("packages/extension-underline/src/index.ts"),
      "@skriva/editor/headless": workspacePackage("packages/editor/headless.ts"),
      "@skriva/editor/react": workspacePackage("packages/editor/react.ts"),
      "@skriva/editor": workspacePackage("packages/editor/src/index.ts"),
      "@skriva/font": workspacePackage("packages/font/src/index.ts"),
      "@skriva/layout": workspacePackage("packages/layout/src/index.ts"),
      "@skriva/pdf": workspacePackage("packages/pdf/src/index.ts"),
      "@skriva/renderer": workspacePackage("packages/renderer/src/index.ts"),
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
      ".agents/**",
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
      ".agents/**",
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
