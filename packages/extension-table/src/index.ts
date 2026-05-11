import { TableKit, type TableKitOptions } from "@tiptap/extension-table";
import type { CanvasRendererExtension } from "@vasa/canvas";
import type { MaybeArray, VasaExtension, VasaExtensionRenderers } from "@vasa/core";
import type { LayoutExtension, LayoutNode, LayoutPage, LayoutStyle } from "@vasa/layout";
import type { PdfRendererExtension } from "@vasa/pdf";
import { tableCanvasRenderer } from "./renderers/canvas.js";
import { tablePdfRenderer } from "./renderers/pdf.js";

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

export function createTableNode(options: CreateTableNodeOptions): TableNode {
  return {
    type: "table",
    id: options.id,
    style: { width: "100%", margin: { vertical: 8 }, ...options.style, flexDirection: "column" },
    borderColor: options.borderColor,
    borderWidth: options.borderWidth,
    cellBackground: options.cellBackground,
    headerBackground: options.headerBackground,
    children: options.rows.map((row, rowIndex) => {
      const width = `${100 / Math.max(1, row.cells.length)}%` as const;
      return {
        type: "tableRow",
        id: row.id ?? `${options.id ?? "table"}.row.${rowIndex}`,
        style: { flexDirection: "row" },
        children: row.cells.map((cell, cellIndex) => ({
          type: cell.type ?? "tableCell",
          id: cell.id ?? `${options.id ?? "table"}.row.${rowIndex}.cell.${cellIndex}`,
          style: {
            width,
            minHeight: 34,
            padding: { vertical: 7, horizontal: 8 },
            flexDirection: "column",
            ...cell.style,
          },
          children: cell.children ?? [],
          colspan: cell.colspan,
          rowspan: cell.rowspan,
          colwidth: cell.colwidth,
          backgroundColor: cell.backgroundColor,
        })),
      };
    }),
  };
}

export function createTableExtension(
  options: TableExtensionOptions = {},
): VasaExtension<TableExtensionRenderers> {
  return {
    name: "table",
    tiptap: TableKit.configure({
      ...options.tiptap,
      table: {
        resizable: false,
        ...(typeof options.tiptap?.table === "object" ? options.tiptap.table : {}),
      },
    }),
    layout: tableLayoutExtension,
    renderer: tableRenderExtension,
    renderers: {
      canvas: mergeRenderers(
        tableRenderers.canvas,
        options.renderers?.canvas,
        options.rendererPlacement,
      ),
      webgl: mergeRenderers(
        tableRenderers.webgl,
        options.renderers?.webgl,
        options.rendererPlacement,
      ),
      pdf: mergeRenderers(tableRenderers.pdf, options.renderers?.pdf, options.rendererPlacement),
    },
  };
}

const tableLayoutExtension = {
  name: "table",
  match: (node): node is TableNode => node.type === "table",
  split({ node, trial, content }) {
    const tableBox = layoutBoxForTable(trial, node);
    if (tableBox === undefined || node.children.length <= 1) return undefined;

    const pageBottom = content.y + content.height;
    const fittingCount = tableBox.children.findIndex(
      (row) => row.rect.y + row.rect.height > pageBottom,
    );
    const splitIndex = fittingCount < 0 ? node.children.length : fittingCount;

    if (splitIndex <= 0 || splitIndex >= node.children.length) return undefined;

    return {
      fitting: { ...node, children: node.children.slice(0, splitIndex) },
      remaining: { ...node, children: node.children.slice(splitIndex) },
    };
  },
} satisfies LayoutExtension<TableNode>;

function layoutBoxForTable(trial: LayoutPage, node: TableNode) {
  return trial.boxes.find((box) => box.type === "table" && box.id === node.id) ?? trial.boxes[0];
}

const tableRenderExtension = {
  name: "table",
  toRenderNode({ box, key, children }) {
    if (!isTableRenderBox(box.type)) return undefined;

    return {
      key,
      kind: "custom",
      sourceId: box.id,
      name: box.type,
      rect: box.rect,
      props: box.props,
      children,
    };
  },
} satisfies NonNullable<VasaExtension["renderer"]>;

const tableRenderers = {
  canvas: tableCanvasRenderer,
  webgl: tableCanvasRenderer,
  pdf: tablePdfRenderer,
} satisfies TableExtensionRenderers;

function isTableRenderBox(type: string) {
  return type === "table" || type === "tableRow" || isTableCellType(type);
}

function isTableCellType(type: string) {
  return type === "tableCell" || type === "tableHeader";
}

function mergeRenderers<T>(
  defaultRenderer: T,
  renderer: MaybeArray<T> | undefined,
  placement: TableExtensionOptions["rendererPlacement"] = "after",
): MaybeArray<T> {
  if (renderer === undefined) return defaultRenderer;

  const renderers = Array.isArray(renderer) ? renderer : [renderer];
  return placement === "before" ? [...renderers, defaultRenderer] : [defaultRenderer, ...renderers];
}

export const TableExtension = createTableExtension();
