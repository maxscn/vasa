import { Node, type SkrivaExtension } from "@skriva/core";

export const Text: SkrivaExtension = {
  name: "text",
  tiptap: Node.create({
    name: "text",
    group: "inline",
  }),
};
