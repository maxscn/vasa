import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { extname, normalize, sep } from "node:path";
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const fontAssetsRoot = fileURLToPath(new URL("../editor/src/assets/fonts/", import.meta.url));

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: /^@vasa\/(.+)$/,
        replacement: path.join(workspaceRoot, "packages/$1/src/index.ts"),
      },
    ],
  },
  plugins: [
    {
      name: "vasa-web-font-assets",
      configureServer(server) {
        server.middlewares.use("/__vasa-assets/fonts/", (request, response, next) => {
          const filePath = resolveFontAssetPath(request.url);

          if (filePath === undefined) {
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

export function resolveFontAssetPath(url: string | undefined) {
  const requestPath = decodeURIComponent(url?.split("?")[0] ?? "");
  const filePath = normalize(`${fontAssetsRoot}${requestPath}`);

  if (!filePath.startsWith(fontAssetsRoot) || filePath.includes(`${sep}..${sep}`)) {
    return undefined;
  }

  return filePath;
}

function contentTypeForFontAsset(filePath: string) {
  if (extname(filePath) === ".ttf") return "font/ttf";
  if (extname(filePath) === ".otf") return "font/otf";
  if (extname(filePath) === ".woff") return "font/woff";
  if (extname(filePath) === ".woff2") return "font/woff2";
  return "text/plain";
}
