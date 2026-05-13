import { type PdfRenderResult, type PdfMetadata } from "@skriva/pdf";
import { useEffect, useRef, useState } from "react";
import {
  bytesToArrayBuffer,
  currentBrowserBitmapScale,
  rasterizePdfPreview,
} from "../src/browser.ts";
import type { SkrivaHeadlessRenderModel } from "../src/headless.ts";

export type UseEditorPdfOptions = {
  renderModel: SkrivaHeadlessRenderModel;
  pageGap: number;
  pdfWorkerUrl: string;
  metadata?: PdfMetadata;
  defaultTextFill?: string;
  downloadTextMode?: "native" | "outline";
  downloadFileName?: string;
  previewDebounceMs?: number;
  previewBitmapScale?: number;
};

export function useEditorPdf(options: UseEditorPdfOptions) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfPreviewJobRef = useRef<Promise<void>>(Promise.resolve());
  const [pdfResult, setPdfResult] = useState<PdfRenderResult<unknown> | undefined>(undefined);
  const previewBitmapScale = usePdfPreviewBitmapScale(options.previewBitmapScale ?? 1);
  const renderModel = options.renderModel;

  useEffect(() => {
    const canvas = pdfCanvasRef.current;
    if (canvas === null) return undefined;

    const context = canvas.getContext("2d");
    if (context === null) return undefined;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const nextJob = pdfPreviewJobRef.current
        .catch(() => undefined)
        .then(async () => {
          if (!cancelled) {
            const previewPdfResult = renderModel.renderPdf({
              metadata: options.metadata,
              defaultTextFill: options.defaultTextFill,
            });
            setPdfResult(previewPdfResult);

            await rasterizePdfPreview(
              canvas,
              context,
              previewPdfResult.bytes,
              options.pdfWorkerUrl,
              options.pageGap,
              () => cancelled,
              options.previewBitmapScale,
            );
          }
        });
      pdfPreviewJobRef.current = nextJob.catch(() => undefined);
    }, options.previewDebounceMs ?? 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    options.defaultTextFill,
    options.metadata,
    options.pageGap,
    options.pdfWorkerUrl,
    options.previewBitmapScale,
    options.previewDebounceMs,
    previewBitmapScale,
    renderModel,
  ]);

  async function renderPdf() {
    const useEmbeddedText =
      options.downloadTextMode !== "native" && renderModel.supportsPdfTextMode("embedded");
    const useOutlineText = options.downloadTextMode === "outline";
    const pdfResult = renderModel.renderPdf({
      metadata: options.metadata,
      defaultTextFill: options.defaultTextFill,
      textMode: useEmbeddedText && !useOutlineText ? "embedded" : undefined,
      selectableText: useOutlineText,
    });
    setPdfResult(pdfResult);

    const bytes = bytesToArrayBuffer(await pdfResult.compressedBytes());
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = options.downloadFileName ?? "skriva-editor.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return {
    pdfCanvasRef,
    pdfResult,
    renderPdf,
  };
}

export type UseEditorPdfReturn = ReturnType<typeof useEditorPdf>;

function usePdfPreviewBitmapScale(multiplier: number) {
  const [scale, setScale] = useState(() => currentBrowserBitmapScale(multiplier));

  useEffect(() => {
    let media: MediaQueryList | undefined;

    function update() {
      setScale(currentBrowserBitmapScale(multiplier));
    }

    function subscribeDprChange() {
      media?.removeEventListener("change", handleDprChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener("change", handleDprChange);
    }

    function handleDprChange() {
      update();
      subscribeDprChange();
    }

    update();
    subscribeDprChange();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      media?.removeEventListener("change", handleDprChange);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [multiplier]);

  return scale;
}
