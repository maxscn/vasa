import { Extension, type SkrivaExtension } from "@skriva/core";
import { TextStyleMark } from "@skriva/extension-text-style";

type CommandChain = Record<string, (...args: unknown[]) => CommandChain> & {
  run: () => boolean;
};

type CommandProps = {
  chain: () => CommandChain;
};

export const FontFamily: SkrivaExtension = {
  name: "fontFamily",
  tiptap: Extension.create({
    name: "fontFamily",
    addCommands() {
      return {
        setFontFamily:
          (fontId: string) =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { fontId }).run(),
        unsetFontFamily:
          () =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { fontId: undefined }).run(),
      };
    },
  } as Parameters<typeof Extension.create>[0]),
};
