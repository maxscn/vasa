import { Node, type VasaExtension } from "@vasa/core";

export const Text: VasaExtension = {
  name: "text",
  tiptap: Node.create({
    name: "text",
    group: "inline",
  }),
};
