import { Extension, type VasaExtension } from "@vasa/core";
import { TextStyleMark } from "@vasa/extension-text-style";

type CommandChain = Record<string, (...args: unknown[]) => CommandChain> & {
  run: () => boolean;
};

type CommandProps = {
  chain: () => CommandChain;
};

export const Color: VasaExtension = {
  name: "color",
  tiptap: Extension.create({
    name: "color",
    addCommands() {
      return {
        setColor:
          (color: string) =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { color }).run(),
        unsetColor:
          () =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { color: undefined }).run(),
      };
    },
  } as Parameters<typeof Extension.create>[0]),
};
