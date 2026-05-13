import { Extension, type SkrivaExtension } from "@skriva/core";
import { TextStyleMark } from "@skriva/extension-text-style";

type CommandChain = Record<string, (...args: unknown[]) => CommandChain> & {
  run: () => boolean;
};

type CommandProps = {
  chain: () => CommandChain;
};

export const FontSize: SkrivaExtension = {
  name: "fontSize",
  tiptap: Extension.create({
    name: "fontSize",
    addCommands() {
      return {
        setFontSize:
          (fontSize: number) =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { fontSize }).run(),
        unsetFontSize:
          () =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { fontSize: undefined }).run(),
      };
    },
  } as Parameters<typeof Extension.create>[0]),
};
