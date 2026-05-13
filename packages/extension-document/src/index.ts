import { Node, type SkrivaExtension } from "@skriva/core";

export const Document: SkrivaExtension = {
  name: "doc",
  tiptap: Node.create({
    name: "doc",
    topNode: true,
    content: "block+",
  }),
};
