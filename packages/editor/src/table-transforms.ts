import {
  cloneJsonContent,
  comparePoints,
  createTextParagraph,
  firstTextSelectionInNode,
  getNodeAtPath,
  lastTextPathInNode,
  nearestTextSelection,
  type JSONContent,
  type EditorSelection,
  type EditorSelectionPoint,
} from "./model.ts";

export function insertTableRowBefore(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  return insertTableRow(doc, selection, "before");
}

export function insertTableRowAfter(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  return insertTableRow(doc, selection, "after");
}

export function insertTableColumnBefore(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  return insertTableColumn(doc, selection, "before");
}

export function insertTableColumnAfter(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  return insertTableColumn(doc, selection, "after");
}

export function deleteCurrentTableRow(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneJsonContent(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  if (table?.content === undefined) return { doc, selection };

  table.content.splice(position.rowIndex, 1);
  if (table.content.length === 0) return deleteCurrentTable(doc, selection);

  const nextRowIndex = Math.min(position.rowIndex, table.content.length - 1);
  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(table.content[nextRowIndex], [
      ...position.tablePath,
      nextRowIndex,
    ]),
  };
}

export function deleteCurrentTableColumn(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneJsonContent(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  if (table?.content === undefined) return { doc, selection };

  for (const row of table.content) {
    row.content?.splice(position.cellIndex, 1);
  }

  table.content = table.content.filter((row) => (row.content ?? []).length > 0);
  if (table.content.length === 0) return deleteCurrentTable(doc, selection);

  const nextRowIndex = Math.min(position.rowIndex, table.content.length - 1);
  const nextCellIndex = Math.min(
    position.cellIndex,
    Math.max(0, (table.content[nextRowIndex]?.content ?? []).length - 1),
  );

  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(table.content[nextRowIndex]?.content?.[nextCellIndex], [
      ...position.tablePath,
      nextRowIndex,
      nextCellIndex,
    ]),
  };
}

export function deleteCurrentTable(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneJsonContent(doc);
  const parent = getNodeAtPath(nextDoc, position.tablePath.slice(0, -1));
  const tableIndex = position.tablePath.at(-1) ?? 0;
  const siblings = parent?.content ?? nextDoc.content;
  if (siblings === undefined) return { doc, selection };

  siblings.splice(tableIndex, 1);

  return {
    doc: nextDoc,
    selection: nearestTextSelection(nextDoc, position.tablePath),
  };
}

export function ensureParagraphAfterCurrentTable(
  doc: JSONContent,
  selection: EditorSelection,
): { doc: JSONContent; selection: EditorSelection } | undefined {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return undefined;

  const tableIndex = position.tablePath.at(-1) ?? 0;
  const parentPath = position.tablePath.slice(0, -1);
  const parent = getNodeAtPath(doc, parentPath);
  const siblings = parentPath.length === 0 ? doc.content : parent?.content;
  if (siblings === undefined) return undefined;

  const nextSiblingPath = [...parentPath, tableIndex + 1];
  const nextSibling = siblings[tableIndex + 1];
  if (nextSibling !== undefined) {
    return {
      doc,
      selection: firstTextSelectionInNode(nextSibling, nextSiblingPath),
    };
  }

  const nextDoc = cloneJsonContent(doc);
  const nextParent = getNodeAtPath(nextDoc, parentPath);
  const nextSiblings = parentPath.length === 0 ? nextDoc.content : nextParent?.content;
  if (nextSiblings === undefined) return undefined;

  nextSiblings.splice(tableIndex + 1, 0, createTextParagraph(""));

  return {
    doc: nextDoc,
    selection: { path: [...nextSiblingPath, 0], offset: 0 },
  };
}

export function isSelectionPointAtCurrentTableEnd(
  doc: JSONContent,
  selection: EditorSelection,
  point: EditorSelectionPoint,
) {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return false;
  if (tablePositionForPath(doc, point.path)?.tablePath.join(".") !== position.tablePath.join(".")) {
    return false;
  }

  const table = getNodeAtPath(doc, position.tablePath);
  const end = lastTextPathInNode(table, position.tablePath);
  return end !== undefined && comparePoints(end, point) === 0;
}

function insertTableRow(
  doc: JSONContent,
  selection: EditorSelection,
  placement: "before" | "after",
): { doc: JSONContent; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneJsonContent(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  const sourceRow = table?.content?.[position.rowIndex];
  if (table?.content === undefined || sourceRow === undefined) return { doc, selection };

  const insertIndex = position.rowIndex + (placement === "after" ? 1 : 0);
  const row = createEmptyTableRowLike(
    sourceRow,
    placement === "before" && position.rowIndex === 0 ? "preserve" : "body",
  );
  table.content.splice(insertIndex, 0, row);

  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(row, [...position.tablePath, insertIndex]),
  };
}

function insertTableColumn(
  doc: JSONContent,
  selection: EditorSelection,
  placement: "before" | "after",
): { doc: JSONContent; selection: EditorSelection } {
  const position = tablePositionForPath(doc, selection.path);
  if (position === undefined) return { doc, selection };

  const nextDoc = cloneJsonContent(doc);
  const table = getNodeAtPath(nextDoc, position.tablePath);
  if (table?.content === undefined) return { doc, selection };

  const insertIndex = position.cellIndex + (placement === "after" ? 1 : 0);
  for (const row of table.content) {
    const sourceCell = row.content?.[position.cellIndex] ?? row.content?.at(-1);
    row.content = [...(row.content ?? [])];
    row.content.splice(insertIndex, 0, createEmptyTableCellLike(sourceCell));
  }

  return {
    doc: nextDoc,
    selection: firstTextSelectionInNode(table.content[position.rowIndex]?.content?.[insertIndex], [
      ...position.tablePath,
      position.rowIndex,
      insertIndex,
    ]),
  };
}

export function tablePositionForPath(doc: JSONContent, path: number[]) {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const tablePath = path.slice(0, index + 1);
    const table = getNodeAtPath(doc, tablePath);
    if (table?.type !== "table") continue;

    const rowIndex = path[index + 1];
    const cellIndex = path[index + 2];
    const row = typeof rowIndex === "number" ? table.content?.[rowIndex] : undefined;
    const cell = typeof cellIndex === "number" ? row?.content?.[cellIndex] : undefined;

    if (row?.type === "tableRow" && (cell?.type === "tableCell" || cell?.type === "tableHeader")) {
      return { tablePath, rowIndex, cellIndex };
    }
  }

  return undefined;
}

function createEmptyTableRowLike(
  row: JSONContent,
  kind: "body" | "preserve" = "body",
): JSONContent {
  return {
    type: "tableRow",
    content: (row.content ?? []).map((cell) =>
      createEmptyTableCellLike(kind === "preserve" ? cell : undefined),
    ),
  };
}

function createEmptyTableCellLike(cell: JSONContent | undefined): JSONContent {
  return {
    type: cell?.type === "tableHeader" ? "tableHeader" : "tableCell",
    ...(cell?.attrs === undefined
      ? {}
      : { attrs: JSON.parse(JSON.stringify(cell.attrs)) as Record<string, unknown> }),
    content: [createTextParagraph("")],
  };
}

export function createBlankEditorTable(rows: number, columns: number): JSONContent {
  return {
    type: "table",
    content: Array.from({ length: rows }, (_, rowIndex) => ({
      type: "tableRow",
      content: Array.from({ length: columns }, () => ({
        type: rowIndex === 0 ? "tableHeader" : "tableCell",
        content: [createTextParagraph("")],
      })),
    })),
  };
}
