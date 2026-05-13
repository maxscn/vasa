import { type TableKitOptions } from "@tiptap/extension-table";
import type { CanvasRendererExtension } from "@skriva/canvas";
import {
  type ExtensionRendererPlacement,
  type SkrivaExtension,
  type SkrivaExtensionRenderers,
} from "@skriva/core";
import type { LayoutNode, LayoutStyle } from "@skriva/layout";
import type { PdfRendererExtension } from "@skriva/pdf";
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
  pdf: PdfRendererExtension;
};
export type TableExtensionOptions = {
  tiptap?: Partial<TableKitOptions>;
  renderers?: SkrivaExtensionRenderers<TableExtensionRenderers>;
  rendererPlacement?: ExtensionRendererPlacement;
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
declare module "@skriva/layout" {
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
): SkrivaExtension<TableExtensionRenderers>;
export declare const TableExtension: SkrivaExtension<TableExtensionRenderers>;
