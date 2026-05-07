import { collectExtensionRenderers, collectLayoutExtensions, type VasaExtension } from "@vasa/core";
import type { BoxNode, LayoutOptions, TextMeasurer } from "@vasa/layout";
import {
  renderDocumentToPdf,
  type PdfRenderResult,
  type PdfMetadata,
  type PdfOutlineTextResolver,
  type PdfRendererExtension,
} from "@vasa/pdf";
import { useEffect, useMemo, useRef, useState } from "react";
import { bytesToArrayBuffer, rasterizePdfPreview } from "../src/browser.ts";

export type UseEditorPdfOptions = {
  document: BoxNode;
  page: LayoutOptions["page"];
  measurer: TextMeasurer;
  pageGap: number;
  pdfWorkerUrl: string;
  extensions?: Array<
    VasaExtension<{
      pdf: PdfRendererExtension;
    }>
  >;
  metadata?: PdfMetadata;
  outlineText?: PdfOutlineTextResolver;
  defaultTextFill?: string;
  downloadTextMode?: "native" | "outline";
  downloadFileName?: string;
  previewDebounceMs?: number;
};

const EMPTY_EXTENSIONS: NonNullable<UseEditorPdfOptions["extensions"]> = [];

export function useEditorPdf(options: UseEditorPdfOptions) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfPreviewJobRef = useRef<Promise<void>>(Promise.resolve());
  const [pdfResult, setPdfResult] = useState<PdfRenderResult | undefined>(undefined);
  const extensions = options.extensions ?? EMPTY_EXTENSIONS;
  const pdfRenderers = useMemo(() => collectExtensionRenderers(extensions, "pdf"), [extensions]);
  const layoutExtensions = useMemo(() => collectLayoutExtensions(extensions), [extensions]);

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
            const previewPdfResult = renderDocumentToPdf(options.document, {
              page: options.page,
              measurer: options.measurer,
              textGrid: false,
              extensions: layoutExtensions,
              renderers: pdfRenderers,
              metadata: options.metadata,
              outlineText: options.outlineText,
              defaultTextFill: options.defaultTextFill,
            } as Parameters<typeof renderDocumentToPdf>[1] & { textGrid: boolean });
            setPdfResult(previewPdfResult);

            await rasterizePdfPreview(
              canvas,
              context,
              previewPdfResult.bytes,
              options.pdfWorkerUrl,
              options.pageGap,
              () => cancelled,
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
    layoutExtensions,
    options.defaultTextFill,
    options.document,
    options.measurer,
    options.metadata,
    options.outlineText,
    options.page,
    options.pageGap,
    options.pdfWorkerUrl,
    options.previewDebounceMs,
    pdfRenderers,
  ]);

  async function renderPdf() {
    const useEmbeddedText =
      options.downloadTextMode !== "native" && options.outlineText !== undefined;
    const useOutlineText =
      options.downloadTextMode === "outline" && options.outlineText !== undefined;
    const pdfResult = renderDocumentToPdf(options.document, {
      page: options.page,
      measurer: options.measurer,
      textGrid: false,
      extensions: layoutExtensions,
      renderers: pdfRenderers,
      metadata: options.metadata,
      defaultTextFill: options.defaultTextFill,
      outlineText: useEmbeddedText || useOutlineText ? options.outlineText : undefined,
      textMode: useEmbeddedText && !useOutlineText ? "embedded" : undefined,
      selectableText: useOutlineText,
    } as Parameters<typeof renderDocumentToPdf>[1] & { textGrid: boolean });
    setPdfResult(pdfResult);

    const bytes = bytesToArrayBuffer(await pdfResult.compressedBytes());
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = options.downloadFileName ?? "vasa-editor.pdf";
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
