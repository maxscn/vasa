import { FileText } from "lucide-react";
import { useEditorShell } from "./editor-shell-context";

export function PdfRenderer() {
  const { pdf } = useEditorShell();

  return (
    <section className="preview-panel" aria-label="Rendered PDF">
      <span className="panel-label">
        <FileText size={17} aria-hidden="true" />
        Rendered PDF
      </span>
      <div className="pdf-frame">
        <canvas ref={pdf.pdfCanvasRef} aria-label="Rendered PDF preview" />
      </div>
    </section>
  );
}
