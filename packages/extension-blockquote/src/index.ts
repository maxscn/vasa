import { Node, type SkrivaExtension } from "@skriva/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export const Blockquote: SkrivaExtension = {
  name: "blockquote",
  tiptap: Node.create({
    name: "blockquote",
    content: "block+",
    group: "block",
    defining: true,
    parseHTML() {
      return [{ tag: "blockquote" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["blockquote", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setBlockquote:
          () =>
          ({ commands }: CommandProps) =>
            commands.wrapIn(this.name),
        toggleBlockquote:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleWrap(this.name),
        unsetBlockquote:
          () =>
          ({ commands }: CommandProps) =>
            commands.lift(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-Shift-b": () => blockquoteCommand(this.editor.commands),
      };
    },
  } as Parameters<typeof Node.create>[0]),
};

function blockquoteCommand(commands: unknown) {
  const toggleBlockquote = (commands as { toggleBlockquote?: () => boolean }).toggleBlockquote;
  return toggleBlockquote?.() ?? false;
}
