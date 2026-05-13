import type { RenderDocument } from "./types.js";
export type MissingCustomRenderNodeCoverage = {
  name: string;
  path: string;
};
export declare function collectCustomRenderNodeNames(document: RenderDocument): string[];
export declare function collectMissingCustomRenderNodeCoverage(
  document: RenderDocument,
  coveredNames: Iterable<string>,
): MissingCustomRenderNodeCoverage[];
