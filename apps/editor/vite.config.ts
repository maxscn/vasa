import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { existsSync, readFileSync } from "node:fs";
import { extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const workspacePackage = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const fontAssetsRoot = fileURLToPath(new URL("./src/assets/fonts/", import.meta.url));

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@vasa/canvas": workspacePackage("../../packages/canvas/src/index.ts"),
      "@vasa/core": workspacePackage("../../packages/core/src/index.ts"),
      "@vasa/editor": workspacePackage("../../packages/editor/src/index.ts"),
      "@vasa/extension-blockquote": workspacePackage(
        "../../packages/extension-blockquote/src/index.ts",
      ),
      "@vasa/extension-code": workspacePackage("../../packages/extension-code/src/index.ts"),
      "@vasa/extension-heading": workspacePackage("../../packages/extension-heading/src/index.ts"),
      "@vasa/extension-horizontal-rule": workspacePackage(
        "../../packages/extension-horizontal-rule/src/index.ts",
      ),
      "@vasa/extension-line-height": workspacePackage(
        "../../packages/extension-line-height/src/index.ts",
      ),
      "@vasa/extension-svg": workspacePackage("../../packages/extension-svg/src/index.ts"),
      "@vasa/extension-table": workspacePackage("../../packages/extension-table/src/index.ts"),
      "@vasa/font": workspacePackage("../../packages/font/src/index.ts"),
      "@vasa/layout": workspacePackage("../../packages/layout/src/index.ts"),
      "@vasa/pdf": workspacePackage("../../packages/pdf/src/index.ts"),
      "@vasa/renderer": workspacePackage("../../packages/renderer/src/index.ts"),
      "@vasa/webgl": workspacePackage("../../packages/webgl/src/index.ts"),
    },
  },
  plugins: [
    {
      name: "vasa-editor-font-assets",
      configureServer(server) {
        server.middlewares.use("/__vasa-assets/fonts/", (request, response, next) => {
          const requestPath = decodeURIComponent(request.url?.split("?")[0] ?? "");
          const filePath = normalize(`${fontAssetsRoot}${requestPath}`);

          if (!filePath.startsWith(fontAssetsRoot) || filePath.includes(`${sep}..${sep}`)) {
            response.statusCode = 403;
            response.end("Forbidden");
            return;
          }

          if (!existsSync(filePath)) {
            next();
            return;
          }

          response.setHeader("Content-Type", contentTypeForFontAsset(filePath));
          response.end(readFileSync(filePath));
        });
      },
    },
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

function contentTypeForFontAsset(filePath: string) {
  if (extname(filePath) === ".ttf") return "font/ttf";
  if (extname(filePath) === ".otf") return "font/otf";
  if (extname(filePath) === ".woff") return "font/woff";
  if (extname(filePath) === ".woff2") return "font/woff2";
  return "text/plain";
}
