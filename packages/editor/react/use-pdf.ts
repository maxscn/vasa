import { useSkriva, type UseSkrivaReturn } from "./use-editor.ts";
import { useEditorPdf, type UseEditorPdfOptions } from "./use-editor-pdf.ts";

export type UsePdfOptions = Omit<UseEditorPdfOptions, "renderModel" | "pageGap"> & {
  surface?: UseSkrivaReturn;
};

export function usePdf(options: UsePdfOptions) {
  const surface = options.surface ?? useSkriva();

  return useEditorPdf({
    ...options,
    renderModel: surface.renderModel,
    pageGap: surface.configPageGap,
  });
}

export type UsePdfReturn = ReturnType<typeof usePdf>;
