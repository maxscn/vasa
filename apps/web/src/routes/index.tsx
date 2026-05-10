import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "../../../editor/src/editor-shell";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { webEditorConfig } from "../editor-config";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <EditorShell
      config={webEditorConfig}
      pdfWorkerUrl={pdfWorkerUrl}
      showInspector
      showPagesRail
      showPdfPreview={false}
    />
  );
}
