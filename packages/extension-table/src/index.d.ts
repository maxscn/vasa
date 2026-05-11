import { type TableKitOptions } from "@tiptap/extension-table";
import type { CanvasRendererExtension } from "@vasa/canvas";
import type { VasaExtension, VasaExtensionRenderers } from "@vasa/core";
import type { LayoutNode, LayoutStyle } from "@vasa/layout";
import type { PdfRendererExtension } from "@vasa/pdf";
export type TableNode = {
  type: "table";
  id?: string;
  style?: LayoutStyle;
  children: TableRowNode[];
  borderColor?: string;
  borderWidth?: number;
  cellBackground?: string;
  headerBackground?: string;
};
export type TableRowNode = {
  type: "tableRow";
  id?: string;
  style?: LayoutStyle;
  children: TableCellNode[];
};
export type TableCellNode = {
  type: "tableCell" | "tableHeader";
  id?: string;
  style?: LayoutStyle;
  children: LayoutNode[];
  colspan?: number;
  rowspan?: number;
  colwidth?: number[];
  backgroundColor?: string;
};
export type TableExtensionRenderers = {
  canvas: CanvasRendererExtension;
  webgl: CanvasRendererExtension;
  pdf: PdfRendererExtension;
};
export type TableExtensionOptions = {
  tiptap?: Partial<TableKitOptions>;
  renderers?: VasaExtensionRenderers<TableExtensionRenderers>;
  rendererPlacement?: "before" | "after";
};
export type CreateTableNodeOptions = Omit<TableNode, "type" | "children"> & {
  rows: Array<{
    id?: string;
    cells: Array<
      Omit<TableCellNode, "type" | "style" | "children"> & {
        type?: TableCellNode["type"];
        style?: LayoutStyle;
        children?: LayoutNode[];
      }
    >;
  }>;
};
declare module "@vasa/layout" {
  interface LayoutNodeByType {
    table: TableNode;
    tableRow: TableRowNode;
    tableCell: TableCellNode;
    tableHeader: TableCellNode;
  }
}
export declare function createTableNode(options: CreateTableNodeOptions): TableNode;
export declare function createTableExtension(
  options?: TableExtensionOptions,
): VasaExtension<TableExtensionRenderers>;
export declare const TableExtension: VasaExtension<TableExtensionRenderers>;
