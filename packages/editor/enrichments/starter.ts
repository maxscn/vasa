import { Extension } from "@skriva/core";
import { defaultEditorExtensions } from "../src/font-attributes.ts";
import { createSkrivaTiptapExtension } from "../enrichment.ts";

export const StarterKit = createSkrivaTiptapExtension(
  Extension.create({
    name: "starterKit",
    addExtensions() {
      return defaultEditorExtensions.flatMap((extension) => extension.tiptap ?? []);
    },
  }),
  { skriva: defaultEditorExtensions },
);
