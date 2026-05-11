import { existsSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { resolveFontAssetPath } from "../vite.config.ts";

test("serves Arimo font assets used by the web editor config", () => {
  const arimoPath = resolveFontAssetPath("/google/arimo/Arimo-Regular.ttf");

  expect(arimoPath).toBeDefined();
  expect(existsSync(arimoPath!)).toBe(true);
});

test("rejects font asset path traversal", () => {
  expect(resolveFontAssetPath("/../private.ttf")).toBeUndefined();
});
