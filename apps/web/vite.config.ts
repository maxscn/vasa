import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: /^@skriva\/([^/]+)$/,
        replacement: path.join(workspaceRoot, "packages/$1/src/index.ts"),
      },
      {
        find: /^@opeinspection\/skriva\/headless$/,
        replacement: path.join(workspaceRoot, "packages/editor/headless.ts"),
      },
      {
        find: /^@opeinspection\/skriva\/react$/,
        replacement: path.join(workspaceRoot, "packages/editor/react.ts"),
      },
      {
        find: /^@opeinspection\/skriva\/enrichments\/(.+)$/,
        replacement: path.join(workspaceRoot, "packages/editor/enrichments/$1.ts"),
      },
      {
        find: /^@opeinspection\/skriva\/(.+)$/,
        replacement: path.join(workspaceRoot, "packages/editor/$1.ts"),
      },
      {
        find: /^@opeinspection\/skriva$/,
        replacement: path.join(workspaceRoot, "packages/editor/src/index.ts"),
      },
    ],
  },
  plugins: [
    tanstackStart(),
    nitro({
      preset: "vercel",
      renderer: {
        handler: "src/ssr-renderer.ts",
      },
    }),
    viteReact(),
    tailwindcss(),
    devtools(),
  ],
});

export default config;
