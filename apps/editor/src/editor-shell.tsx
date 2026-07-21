import type { ResolvedBoxEdges } from "@openinspection/skriva/layout";
import { resolvePageMargin } from "@openinspection/skriva/layout";
import {
  SkrivaCanvasEditor,
  type SkrivaEditorConfig,
  useSkrivaEditor,
  useEditorPdf,
} from "@openinspection/skriva/editor/react";
import type { SvgNode } from "@openinspection/skriva/enrichments/svg";
import { createSvgDropHandler } from "@openinspection/skriva/enrichments/svg";
import { useMemo, useState } from "react";
import { EditorShellProvider } from "./components/editor-shell-context";
import { Inspector } from "./components/inspector";
import { PagesRail } from "./components/pages-rail";
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
  config?: SkrivaEditorConfig;
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
  const svgDropHandler = useMemo(
    () =>
      createSvgDropHandler({
        addNodes: (nodes) => setDroppedSvgNodes((currentNodes) => [...currentNodes, ...nodes]),
      }),
    [],
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
      surfaceDropHandlers: [...(baseConfig.surfaceDropHandlers ?? []), svgDropHandler],
    }),
    [baseConfig, droppedSvgNodes, pageMargin, pagePreset, showMarginOutlines, svgDropHandler],
  );
  const editor = useSkrivaEditor({ config });
  const pdf = useEditorPdf({
    renderModel: editor.renderModel,
    pageGap: config.pageGap,
    pdfWorkerUrl,
    metadata: { title: "Skriva editor demo", author: "Skriva" },
    defaultTextFill: config.textColor,
    downloadTextMode: "outline",
    downloadFileName: "skriva-editor-demo.pdf",
    previewBitmapScale: config.canvasBitmapScale,
  });

  return (
    <EditorShellProvider
      value={{
        editor,
        pdf,
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
          <SkrivaCanvasEditor editor={editor} rail={showPagesRail ? <PagesRail /> : null} />
          {showInspector ? <Inspector /> : null}
          {showPdfPreview ? <PdfRenderer /> : null}
        </section>
      </main>
    </EditorShellProvider>
  );
}
