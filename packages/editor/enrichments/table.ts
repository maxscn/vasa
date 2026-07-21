import { TableExtension as TableEnrichment } from "@skriva/extension-table";
import { createSkrivaTiptapExtension } from "../enrichment.ts";

export {
  createTableExtension,
  createTableNode,
  type CreateTableNodeOptions,
  type TableCellNode,
  type TableExtensionOptions,
  type TableExtensionRenderers,
  type TableNode,
  type TableRowNode,
} from "@skriva/extension-table";

export const Table = createSkrivaTiptapExtension(TableEnrichment.tiptap!, {
  skriva: [TableEnrichment],
});

export const TableExtension = Table;
