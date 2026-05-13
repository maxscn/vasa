import type {
  BoxNode,
  AnyLayoutExtension,
  LayoutOptions,
  LayoutPage,
  LayoutResult,
  PageGeometry,
  Rect,
  TextMeasurer,
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
