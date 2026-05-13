import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";

const workspacePackage = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@opeinspection/skriva/canvas": workspacePackage("../../packages/editor/canvas.ts"),
      "@opeinspection/skriva/enrichment": workspacePackage("../../packages/editor/enrichment.ts"),
      "@opeinspection/skriva/enrichments/horizontal-rule": workspacePackage(
        "../../packages/editor/enrichments/horizontal-rule.ts",
      ),
      "@opeinspection/skriva/enrichments/line-height": workspacePackage(
        "../../packages/editor/enrichments/line-height.ts",
      ),
      "@opeinspection/skriva/enrichments/svg": workspacePackage(
        "../../packages/editor/enrichments/svg.ts",
      ),
      "@opeinspection/skriva/enrichments/table": workspacePackage(
        "../../packages/editor/enrichments/table.ts",
      ),
      "@opeinspection/skriva/font": workspacePackage("../../packages/editor/font.ts"),
      "@opeinspection/skriva/headless": workspacePackage("../../packages/editor/headless.ts"),
      "@opeinspection/skriva/layout": workspacePackage("../../packages/editor/layout.ts"),
      "@opeinspection/skriva/pdf": workspacePackage("../../packages/editor/pdf.ts"),
      "@opeinspection/skriva/react": workspacePackage("../../packages/editor/react.ts"),
      "@opeinspection/skriva/renderer": workspacePackage("../../packages/editor/renderer.ts"),
      "@opeinspection/skriva": workspacePackage("../../packages/editor/src/index.ts"),
    },
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart({
      router: {
        quoteStyle: "double",
        semicolons: true,
      },
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
