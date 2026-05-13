import type {
  BoxEdges,
  PageGeometry,
  PageMarginGuide,
  Rect,
  ResolvedBoxEdges,
  UpdatePageMarginGuideOptions,
} from "./types.js";
export declare function createPageGeometry(page: {
  width: number;
  height: number;
  margin?: BoxEdges;
}): PageGeometry;
export declare function resolvePageMargin(margin: BoxEdges | undefined): ResolvedBoxEdges;
export declare function updatePageMarginGuide(
  page: {
    width: number;
    height: number;
    margin?: BoxEdges;
  },
  guide: PageMarginGuide,
  position: number,
  options?: UpdatePageMarginGuideOptions,
): ResolvedBoxEdges;
export declare function pageGeometryFromContent(content: Rect): PageGeometry;
export declare function isPageGeometry(value: Rect | PageGeometry): value is PageGeometry;
export declare function resolveEdges(edges: BoxEdges | undefined): {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
