import { Node, type SkrivaExtension } from "@skriva/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
  state: { doc: { content: { size: number } } };
};

type InsertPageBreakOptions = {
  spacerHeight: number;
};

export const Paragraph: SkrivaExtension = {
  name: "paragraph",
  tiptap: Node.create({
    name: "paragraph",
    group: "block",
    content: "inline*",
    addAttributes() {
      return {
        pageSpacerHeight: {
          default: null,
          parseHTML: (element) => parsePageSpacerHeight(element),
          renderHTML: (attributes) =>
            typeof attributes.pageSpacerHeight === "number"
              ? { "data-page-spacer-height": String(attributes.pageSpacerHeight) }
              : {},
        },
      };
    },
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
        insertPageBreak:
          (options: InsertPageBreakOptions) =>
          ({ commands, state }: CommandProps) =>
            commands.insertContentAt(state.doc.content.size, [
              {
                type: this.name,
                attrs: { pageSpacerHeight: Math.max(1, Math.ceil(options.spacerHeight)) },
              },
              { type: this.name },
            ]),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-Alt-0": () => paragraphCommand(this.editor.commands),
      };
    },
  } as Parameters<typeof Node.create>[0]),
};

function parsePageSpacerHeight(element: { getAttribute(name: string): string | null }) {
  const raw = element.getAttribute("data-page-spacer-height");
  if (raw === null) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(1, Math.ceil(parsed)) : null;
}

function paragraphCommand(commands: unknown) {
  const setParagraph = (commands as { setParagraph?: () => boolean }).setParagraph;
  return setParagraph?.() ?? false;
}
