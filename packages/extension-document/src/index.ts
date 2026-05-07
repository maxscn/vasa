import { Node, type VasaExtension } from "@vasa/core";

export const Document: VasaExtension = {
  name: "doc",
  tiptap: Node.create({
    name: "doc",
    topNode: true,
    content: "block+",
  }),
};
