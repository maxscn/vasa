import { Extension, type SkrivaExtension } from "@skriva/core";
import { TextStyleMark } from "@skriva/extension-text-style";

type CommandChain = Record<string, (...args: unknown[]) => CommandChain> & {
  run: () => boolean;
};

type CommandProps = {
  chain: () => CommandChain;
};

export const Color: SkrivaExtension = {
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
