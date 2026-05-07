import type { AnyLayoutExtension, BoxNode, LayoutNode, LayoutPage, Rect } from "./types.ts";
type LayoutPageForPagination = (root: BoxNode, pageIndex: number) => LayoutPage;
export type PaginationPrimitive = LayoutNode;
export type PaginationPagePlan = {
  index: number;
  primitives: PaginationPrimitive[];
};
export type PaginationPlan = {
  pages: PaginationPagePlan[];
};
export type PaginatePrimitivesOptions = {
  root: BoxNode;
  content: Rect;
  extensions?: AnyLayoutExtension[];
  layoutPage: LayoutPageForPagination;
};
export declare function paginatePrimitives(options: PaginatePrimitivesOptions): PaginationPlan;
