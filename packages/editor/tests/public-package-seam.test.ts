import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vite-plus/test";

const repoRoot = join(import.meta.dirname, "../../..");
const checkedRoots = ["apps/editor", "apps/web"];
const checkedExtensions = new Set([".json", ".ts", ".tsx"]);
const ignoredSegments = new Set([".next", "dist", "node_modules", "routeTree.gen.ts"]);

test("apps consume Skriva through the public package seam", () => {
  const offenders = checkedRoots.flatMap((root) => forbiddenInternalImports(join(repoRoot, root)));

  expect(offenders).toEqual([]);
});

function forbiddenInternalImports(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (ignoredSegments.has(entry)) return [];

    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return forbiddenInternalImports(path);
    if (!checkedExtensions.has(extension(entry))) return [];

    const source = readFileSync(path, "utf8");
    return source.includes("@skriva/")
      ? [`${relative(repoRoot, path)} imports an internal @skriva package`]
      : [];
  });
}

function extension(path: string) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}
