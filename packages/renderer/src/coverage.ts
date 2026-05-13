import type { RenderDocument, RenderNode } from "./types.js";

export type MissingCustomRenderNodeCoverage = {
  name: string;
  path: string;
};

export function collectCustomRenderNodeNames(document: RenderDocument): string[] {
  return [
    ...new Set(collectCustomRenderNodeCoverage(document, new Set()).map((item) => item.name)),
  ];
}

export function collectMissingCustomRenderNodeCoverage(
  document: RenderDocument,
  coveredNames: Iterable<string>,
): MissingCustomRenderNodeCoverage[] {
  return collectCustomRenderNodeCoverage(document, new Set(coveredNames));
}

function collectCustomRenderNodeCoverage(
  document: RenderDocument,
  coveredNames: Set<string>,
): MissingCustomRenderNodeCoverage[] {
  const missing: MissingCustomRenderNodeCoverage[] = [];

  for (const [pageIndex, page] of document.pages.entries()) {
    for (const [nodeIndex, node] of page.nodes.entries()) {
      collectMissingNodeCoverage(
        node,
        `pages.${pageIndex}.nodes.${nodeIndex}`,
        coveredNames,
        missing,
      );
    }
  }

  return missing;
}

function collectMissingNodeCoverage(
  node: RenderNode,
  path: string,
  coveredNames: Set<string>,
  missing: MissingCustomRenderNodeCoverage[],
) {
  if (node.kind === "custom" && !coveredNames.has(node.name)) {
    missing.push({ name: node.name, path });
  }

  for (const [index, child] of node.children.entries()) {
    collectMissingNodeCoverage(child, `${path}.children.${index}`, coveredNames, missing);
  }
}
