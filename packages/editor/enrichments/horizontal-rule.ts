import { HorizontalRule as HorizontalRuleEnrichment } from "@skriva/extension-horizontal-rule";
import { createSkrivaTiptapExtension } from "../enrichment.ts";

export {
  createHorizontalRuleNode,
  type HorizontalRuleNode,
  type HorizontalRuleRenderers,
} from "@skriva/extension-horizontal-rule";

export const HorizontalRule = createSkrivaTiptapExtension(HorizontalRuleEnrichment.tiptap!, {
  skriva: [HorizontalRuleEnrichment],
});
