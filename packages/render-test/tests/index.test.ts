import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  imageDiff,
  imageDiffSummary,
  imageHash,
  writeRendererComparisonArtifacts,
  type RenderTestImage,
} from "../src/index.ts";
import { expect, test } from "vite-plus/test";

test("hashes image dimensions and pixels", () => {
  const image = testImage([0, 0, 0, 255]);

  expect(imageHash(image)).toBe(imageHash(testImage([0, 0, 0, 255])));
  expect(imageHash(image)).not.toBe(imageHash(testImage([255, 0, 0, 255])));
});

test("summarizes channel-level image diffs", () => {
  const diff = imageDiff(testImage([0, 0, 0, 255]), testImage([1, 2, 3, 255]));

  expect(diff).toEqual({
    mismatchCount: 1,
    ratio: 1,
    totalChannelDelta: 6,
    maxChannelDelta: 6,
  });
  expect(imageDiffSummary(diff)).toBe(
    "mismatchCount=1; ratio=1; totalChannelDelta=6; maxChannelDelta=6",
  );
});

test("writes renderer comparison PNG artifacts and a JSON report", () => {
  const dir = mkdtempSync(join(tmpdir(), "skriva-render-test-"));
  const canvas = testImage([0, 0, 0, 255]);
  const pdf = testImage([255, 255, 255, 255]);
  const diff = imageDiff(canvas, pdf);
  const artifacts = writeRendererComparisonArtifacts(
    { canvas, pdf, diff },
    { dir, report: { fixture: "unit" } },
  );

  expect(existsSync(artifacts.canvas)).toBe(true);
  expect(existsSync(artifacts.pdf)).toBe(true);
  expect(existsSync(artifacts.diff)).toBe(true);
  expect(JSON.parse(readFileSync(artifacts.report, "utf8"))).toMatchObject({
    canvas: { path: artifacts.canvas, width: 1, height: 1, hash: imageHash(canvas) },
    pdf: { path: artifacts.pdf, width: 1, height: 1, hash: imageHash(pdf) },
    diff: { path: artifacts.diff, mismatchCount: 1 },
    fixture: "unit",
  });
});

function testImage(pixel: number[]): RenderTestImage {
  return {
    width: 1,
    height: 1,
    pixels: new Uint8ClampedArray(pixel),
  };
}
