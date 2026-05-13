import { Extension } from "@skriva/core";
import { gapCursor } from "@tiptap/pm/gapcursor";

export const GapCursor = {
  name: "gapCursor",
  tiptap: Extension.create({
    name: "gapCursor",
    addProseMirrorPlugins() {
      return [gapCursor()];
    },
  }),
};
