import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "../../../editor/src/editor-shell";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <EditorShell
      bundledFontUrl="/__vasa-assets/fonts/google/arimo/Arimo-Regular.ttf"
      fallbackFontUrl="/__vasa-assets/fonts/google/arimo/Arimo-Regular.ttf"
      pdfWorkerUrl={pdfWorkerUrl}
      showInspector
      showPagesRail
      showPdfPreview={false}
    />
  );
}
