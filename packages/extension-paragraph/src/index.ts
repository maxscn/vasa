import { Node, type VasaExtension } from "@vasa/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export const Paragraph: VasaExtension = {
  name: "paragraph",
  tiptap: Node.create({
    name: "paragraph",
    group: "block",
    content: "inline*",
    parseHTML() {
      return [{ tag: "p" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["p", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setParagraph:
          () =>
          ({ commands }: CommandProps) =>
            commands.setNode(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-Alt-0": () => paragraphCommand(this.editor.commands),
      };
    },
  } as Parameters<typeof Node.create>[0]),
};

function paragraphCommand(commands: unknown) {
  const setParagraph = (commands as { setParagraph?: () => boolean }).setParagraph;
  return setParagraph?.() ?? false;
}
