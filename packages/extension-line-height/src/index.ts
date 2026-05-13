import { Extension, type SkrivaExtension } from "@skriva/core";
import { TextStyleMark } from "@skriva/extension-text-style";

type CommandChain = Record<string, (...args: unknown[]) => CommandChain> & {
  run: () => boolean;
};

type CommandProps = {
  chain: () => CommandChain;
};

export const LineHeight: SkrivaExtension = {
  name: "lineHeight",
  tiptap: Extension.create({
    name: "lineHeight",
    addCommands() {
      return {
        setLineHeight:
          (lineHeight: number) =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { lineHeight }).run(),
        unsetLineHeight:
          () =>
          ({ chain }: CommandProps) =>
            chain().setMark(TextStyleMark.name, { lineHeight: undefined }).run(),
      };
    },
  } as Parameters<typeof Extension.create>[0]),
};
