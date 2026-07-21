import { useMemo, useState } from "react";
import { useEditor, type UseEditorOptions } from "@tiptap/react";
import { Editor, usePdf, type SkrivaEditorConfig } from "@openinspection/skriva/editor/react";
import type { ResolvedBoxEdges } from "@openinspection/skriva/layout";
import { resolvePageMargin } from "@openinspection/skriva/layout";
import { defaultEditorExtensions } from "@openinspection/skriva/editor/react";
import type { SvgNode } from "@openinspection/skriva/enrichments/svg";
import { createSvgDropHandler } from "@openinspection/skriva/enrichments/svg";
import { EditorShellProvider } from "./editor-shell-context";
import { Inspector } from "./inspector";
import { PagesRail } from "./pages-rail";
import { marginPresets, pagePresets, type MarginPresetId, type PagePresetId } from "./presets";
import { PdfRenderer } from "./pdf-renderer";
import { Toolbar } from "./toolbar";

export type EditorShellProps = {
  config: SkrivaEditorConfig;
  pdfWorkerUrl: string;
  showPdfPreview?: boolean;
  showInspector?: boolean;
  showPagesRail?: boolean;
};

export function EditorShell({
  config: baseConfig,
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
  const tiptapExtensions = useMemo(
    () =>
      uniqueTiptapExtensions([
        ...defaultEditorExtensions.flatMap((extension) => extension.tiptap ?? []),
        ...(config.extensions ?? []).flatMap((extension) =>
          "tiptap" in extension ? (extension.tiptap ?? []) : [extension],
        ),
        ...(config.tiptap?.extensions ?? []),
      ]),
    [config.extensions, config.tiptap?.extensions],
  );
  const tiptapEditor = useEditor(
    {
      immediatelyRender: false,
      ...config.tiptap,
      content: config.tiptap?.content ?? config.document,
      extensions: tiptapExtensions as UseEditorOptions["extensions"],
    },
    config.tiptapDeps ?? [],
  );

  return (
    <Editor editor={tiptapEditor} config={config} extensions={config.extensions}>
      <EditorShellContent
        config={config}
        marginPreset={marginPreset}
        pagePreset={pagePreset}
        pdfWorkerUrl={pdfWorkerUrl}
        setMarginPresetState={setMarginPresetState}
        setPagePreset={setPagePreset}
        setPageMargin={setPageMargin}
        setShowMarginOutlines={setShowMarginOutlines}
        showInspector={showInspector}
        showMarginOutlines={showMarginOutlines}
        showPagesRail={showPagesRail}
        showPdfPreview={showPdfPreview}
      />
    </Editor>
  );
}

type EditorShellContentProps = {
  config: SkrivaEditorConfig;
  marginPreset: MarginPresetId;
  pagePreset: PagePresetId;
  pdfWorkerUrl: string;
  setMarginPresetState: (preset: MarginPresetId) => void;
  setPagePreset: (preset: PagePresetId) => void;
  setPageMargin: (margin: ResolvedBoxEdges) => void;
  setShowMarginOutlines: (show: boolean) => void;
  showInspector: boolean;
  showMarginOutlines: boolean;
  showPagesRail: boolean;
  showPdfPreview: boolean;
};

function EditorShellContent({
  config,
  marginPreset,
  pagePreset,
  pdfWorkerUrl,
  setMarginPresetState,
  setPagePreset,
  setPageMargin,
  setShowMarginOutlines,
  showInspector,
  showMarginOutlines,
  showPagesRail,
  showPdfPreview,
}: EditorShellContentProps) {
  const pdf = usePdf({
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
          <Editor.Canvas rail={showPagesRail ? <PagesRail /> : null} />
          {showInspector ? <Inspector /> : null}
          {showPdfPreview ? <PdfRenderer /> : null}
        </section>
      </main>
    </EditorShellProvider>
  );
}

function uniqueTiptapExtensions<TExtension extends { name: string }>(extensions: TExtension[]) {
  const seen = new Set<string>();
  return extensions.filter((extension) => {
    const name = extension.name;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}
