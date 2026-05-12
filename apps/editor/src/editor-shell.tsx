import type { ResolvedBoxEdges } from "@vasa/layout";
import { resolvePageMargin } from "@vasa/layout";
import { useEditor, useEditorPdf, type EditorConfig } from "@vasa/editor";
import type { SvgNode } from "@vasa/extension-svg";
import { useMemo, useState } from "react";
import { CanvasEditor } from "./components/canvas-editor";
import { EditorShellProvider } from "./components/editor-shell-context";
import { Inspector } from "./components/inspector";
import {
  marginPresets,
  pagePresets,
  type MarginPresetId,
  type PagePresetId,
} from "./components/presets";
import { PdfRenderer } from "./components/pdf-renderer";
import { Toolbar } from "./components/toolbar";
import { editorConfig } from "./editor-demo";

export type EditorShellProps = {
  config?: EditorConfig;
  pdfWorkerUrl: string;
  showPdfPreview?: boolean;
  showInspector?: boolean;
  showPagesRail?: boolean;
};

export function EditorShell({
  config: baseConfig = editorConfig,
  pdfWorkerUrl,
  showInspector = false,
  showPagesRail = false,
  showPdfPreview = true,
}: EditorShellProps) {
  const [droppedSvgNodes, setDroppedSvgNodes] = useState<SvgNode[]>([]);
  const [marginPreset, setMarginPresetState] = useState<MarginPresetId>("normal");
  const [pagePreset, setPagePreset] = useState<PagePresetId>("a4");
  const [showMarginOutlines, setShowMarginOutlines] = useState(false);
  const [pageMargin, setPageMargin] = useState<ResolvedBoxEdges>(() =>
    resolvePageMargin(baseConfig.page.margin),
  );
  const config = useMemo(
    () => ({
      ...baseConfig,
      page: {
        width: pagePresets[pagePreset].width,
        height: pagePresets[pagePreset].height,
        margin: pageMargin,
      },
      onPageMarginChange: setPageMargin,
      showPageMarginGuides: showMarginOutlines,
      extraChildren: [...(baseConfig.extraChildren ?? []), ...droppedSvgNodes],
    }),
    [baseConfig, droppedSvgNodes, pageMargin, pagePreset, showMarginOutlines],
  );
  const editor = useEditor({ config });
  const pdf = useEditorPdf({
    document: editor.layoutTree,
    page: config.page,
    measurer: editor.textMeasurer,
    pageGap: config.pageGap,
    pdfWorkerUrl,
    extensions: config.extensions,
    metadata: { title: "Vasa editor demo", author: "Vasa" },
    outlineText: editor.outlineText,
    defaultTextFill: config.textColor,
    downloadTextMode: "outline",
    downloadFileName: "vasa-editor-demo.pdf",
    previewBitmapScale: config.canvasBitmapScale,
  });

  return (
    <EditorShellProvider
      value={{
        editor,
        pdf,
        addDroppedSvgNodes: (nodes) =>
          setDroppedSvgNodes((currentNodes) => [...currentNodes, ...nodes]),
        marginPreset,
        pagePreset,
        setMarginPreset: (preset) => {
          setMarginPresetState(preset);
          const value = marginPresets[preset].value;
          setPageMargin({ top: value, right: value, bottom: value, left: value });
        },
        setPagePreset,
        setShowMarginOutlines,
        showMarginOutlines,
        showPagesRail,
      }}
    >
      <main className="editor-shell">
        <Toolbar />
        <section className="workspace-grid">
          <CanvasEditor />
          {showInspector ? <Inspector /> : null}
          {showPdfPreview ? <PdfRenderer /> : null}
        </section>
      </main>
    </EditorShellProvider>
  );
}
