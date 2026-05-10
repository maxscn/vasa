import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "../editor-shell";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <EditorShell pdfWorkerUrl={pdfWorkerUrl} />;
}
