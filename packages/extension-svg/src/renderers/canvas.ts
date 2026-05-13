import { PathNode, type CanvasRendererExtension } from "@skriva/canvas";
import { transformSvgPath } from "@skriva/renderer";
import { svgPathsFromProps } from "./shared.js";

export const svgCanvasRenderer = {
  name: "svg",
  toCanvasNodes({ node, yOffset }) {
    if (node.name !== "svg") return undefined;

    return svgPathsFromProps(node.props, node.rect).map((path, index) =>
      PathNode({
        key: `${node.key}:${index}`,
        kind: "path",
        path: transformSvgPath(path.path, path.viewBox, {
          ...node.rect,
          y: node.rect.y + yOffset,
        }),
        fill: path.fill,
        stroke: path.stroke,
        strokeWidth: path.strokeWidth,
      }),
    );
  },
} satisfies CanvasRendererExtension;
