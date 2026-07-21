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
      "@openinspection/skriva/canvas": workspacePackage("../../packages/editor/canvas.ts"),
      "@openinspection/skriva/enrichment": workspacePackage("../../packages/editor/enrichment.ts"),
      "@openinspection/skriva/enrichments/horizontal-rule": workspacePackage(
        "../../packages/editor/enrichments/horizontal-rule.ts",
      ),
      "@openinspection/skriva/enrichments/line-height": workspacePackage(
        "../../packages/editor/enrichments/line-height.ts",
      ),
      "@openinspection/skriva/enrichments/starter": workspacePackage(
        "../../packages/editor/enrichments/starter.ts",
      ),
      "@openinspection/skriva/enrichments/svg": workspacePackage(
        "../../packages/editor/enrichments/svg.ts",
      ),
      "@openinspection/skriva/enrichments/table": workspacePackage(
        "../../packages/editor/enrichments/table.ts",
      ),
      "@openinspection/skriva/editor/react": workspacePackage("../../packages/editor/react.ts"),
      "@openinspection/skriva/font": workspacePackage("../../packages/editor/font.ts"),
      "@openinspection/skriva/headless": workspacePackage("../../packages/editor/headless.ts"),
      "@openinspection/skriva/layout": workspacePackage("../../packages/editor/layout.ts"),
      "@openinspection/skriva/pdf": workspacePackage("../../packages/editor/pdf.ts"),
      "@openinspection/skriva/scene": workspacePackage("../../packages/editor/scene.ts"),
      "@openinspection/skriva": workspacePackage("../../packages/editor/src/index.ts"),
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
