import { Columns3, Download, Rows3, Table2 } from "lucide-react";
import { isSelectionInsideEditorNodeType } from "@vasa/editor";
import { useEditorShell } from "./editor-shell-context";
import { InspectorSelect } from "./inspector-select";
import { marginPresets, pagePresets, type MarginPresetId, type PagePresetId } from "./presets";
import { ToggleField } from "./toggle-field";

export function Inspector() {
  const {
    editor,
    marginPreset,
    pagePreset,
    pdf,
    setMarginPreset,
    setPagePreset,
    setShowMarginOutlines,
    showMarginOutlines,
  } = useEditorShell();
  const tableSelected = isSelectionInsideEditorNodeType(
    editor.editorDocument,
    editor.selection.path,
    "table",
  );
  const currentPage = pagePresets[pagePreset];

  return (
    <aside className="inspector-panel" aria-label="Inspector">
      {tableSelected ? (
        <div className="inspector-section first">
          <h2>Table</h2>
          <div className="field-label">Rows</div>
          <div className="inspector-actions">
            <button type="button" onClick={editor.insertTableRowBefore}>
              <Rows3 size={16} aria-hidden="true" />
              Add row above
            </button>
            <button type="button" onClick={editor.insertTableRowAfter}>
              <Rows3 size={16} aria-hidden="true" />
              Add row below
            </button>
            <button type="button" onClick={editor.deleteCurrentTableRow}>
              <Rows3 size={16} aria-hidden="true" />
              Delete current row
            </button>
          </div>

          <div className="field-label">Columns</div>
          <div className="inspector-actions">
            <button type="button" onClick={editor.insertTableColumnBefore}>
              <Columns3 size={16} aria-hidden="true" />
              Add column left
            </button>
            <button type="button" onClick={editor.insertTableColumnAfter}>
              <Columns3 size={16} aria-hidden="true" />
              Add column right
            </button>
            <button type="button" onClick={editor.deleteCurrentTableColumn}>
              <Columns3 size={16} aria-hidden="true" />
              Delete current column
            </button>
          </div>

          <div className="field-label">Table</div>
          <div className="inspector-actions">
            <button className="danger-action" type="button" onClick={editor.deleteCurrentTable}>
              Delete table
            </button>
          </div>
        </div>
      ) : (
        <div className="inspector-section first">
          <h2>Page</h2>
          <div className="field-label">Size</div>
          <InspectorSelect
            ariaLabel="Page size"
            value={pagePreset}
            options={Object.entries(pagePresets).map(([id, preset]) => ({
              label: preset.label,
              value: id,
            }))}
            onValueChange={(value) => setPagePreset(value as PagePresetId)}
          />
          <p className="muted">{currentPage.note}</p>

          <div className="field-label">Margins</div>
          <InspectorSelect
            ariaLabel="Page margins"
            value={marginPreset}
            options={Object.entries(marginPresets).map(([id, preset]) => ({
              label: `${preset.label} (${preset.value}px)`,
              value: id,
            }))}
            onValueChange={(value) => setMarginPreset(value as MarginPresetId)}
          />
          <ToggleField
            checked={showMarginOutlines}
            label="Show outlines"
            onCheckedChange={setShowMarginOutlines}
          />

          <div className="field-label">Insert</div>
          <div className="inspector-actions">
            <button type="button" onClick={editor.insertBlankTable}>
              <Table2 size={16} aria-hidden="true" />
              New table
            </button>
          </div>

          <div className="field-label">Document</div>
          <div className="inspector-actions">
            <button type="button" onClick={pdf.renderPdf}>
              <Download size={16} aria-hidden="true" />
              Export PDF
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
