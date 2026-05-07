import type {
  BoxEdges,
  BoxNode,
  AnyLayoutExtension,
  LayoutOptions,
  LayoutPage,
  LayoutResult,
  PageGeometry,
  PageMarginGuide,
  Rect,
  ResolvedBoxEdges,
  TextMeasurer,
  UpdatePageMarginGuideOptions,
} from "./types.ts";
export declare function layoutDocument(root: BoxNode, options: LayoutOptions): LayoutResult;
export declare function layoutPage(
  root: BoxNode,
  geometry: Rect | PageGeometry,
  measurer?: TextMeasurer,
  pageIndex?: number,
  extensions?: AnyLayoutExtension[],
  options?: {
    textGrid?: boolean;
  },
): LayoutPage;
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
