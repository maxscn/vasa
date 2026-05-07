import { existsSync, readFileSync } from "node:fs";
import { extname, normalize, sep } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const indexHtmlPath = fileURLToPath(new URL("./index.html", import.meta.url));
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
    tailwindcss(),
    {
      name: "vasa-dev-index",
      apply: "serve",
      configureServer(server) {
        return () => {
          server.middlewares.use(async (req, res, next) => {
            if (req.method !== "GET" || (req.url !== "/" && req.url !== "/index.html")) {
              next();
              return;
            }

            const html = await readFile(indexHtmlPath, "utf8");
            const transformed = await server.transformIndexHtml(req.url, html);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(transformed);
          });
        };
      },
    },
    tanstackStart(),
    nitro({
      preset: "vercel",
    }),
    viteReact(),
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
