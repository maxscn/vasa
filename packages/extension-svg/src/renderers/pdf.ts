import type { PdfRendererExtension } from "@vasa/pdf";
import { transformSvgPath } from "@vasa/renderer";
import { svgPathsFromProps } from "./shared.js";

export const svgPdfRenderer = {
  name: "svg",
  toPdfCommands({ node }) {
    if (node.name !== "svg") return undefined;

    return svgPathsFromProps(node.props, node.rect).map((path) => ({
      type: "path",
      path: transformSvgPath(path.path, path.viewBox, node.rect),
      fill: path.fill,
      stroke: path.stroke,
      strokeWidth: path.strokeWidth,
    }));
  },
} satisfies PdfRendererExtension;
