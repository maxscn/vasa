import { LineHeight as LineHeightEnrichment } from "@skriva/extension-line-height";
import { createSkrivaTiptapExtension } from "../enrichment.ts";

export const LineHeight = createSkrivaTiptapExtension(LineHeightEnrichment.tiptap!, {
  skriva: [LineHeightEnrichment],
});
