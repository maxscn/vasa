import { Node, type VasaExtension } from "@vasa/core";

type Level = 1 | 2 | 3 | 4 | 5 | 6;

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type HeadingAttributes = {
  level: Level;
};

export const Heading: VasaExtension = {
  name: "heading",
  tiptap: Node.create({
    name: "heading",
    content: "inline*",
    group: "block",
    defining: true,
    addAttributes() {
      return {
        level: {
          default: 1,
          rendered: false,
        },
      };
    },
    parseHTML() {
      return [1, 2, 3, 4, 5, 6].map((level) => ({
        tag: `h${level}`,
        attrs: { level },
      }));
    },
    renderHTML({ node, HTMLAttributes }) {
      const level = isHeadingLevel(node.attrs.level) ? node.attrs.level : 1;
      return [`h${level}`, HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setHeading:
          (attrs: HeadingAttributes) =>
          ({ commands }: CommandProps) =>
            commands.setNode(this.name, attrs),
        toggleHeading:
          (attrs: HeadingAttributes) =>
          ({ commands }: CommandProps) =>
            commands.toggleNode(this.name, "paragraph", attrs),
      };
    },
    addKeyboardShortcuts() {
      return headingLevels.reduce<Record<string, () => boolean>>(
        (shortcuts, level) => ({
          ...shortcuts,
          [`Mod-Alt-${level}`]: () => headingCommand(this.editor.commands, level),
        }),
        {},
      );
    },
  } as Parameters<typeof Node.create>[0]),
};

const headingLevels = [1, 2, 3, 4, 5, 6] as const;

function headingCommand(commands: unknown, level: Level) {
  const toggleHeading = (commands as { toggleHeading?: (attrs: HeadingAttributes) => boolean })
    .toggleHeading;
  return toggleHeading?.({ level }) ?? false;
}

export function isHeadingLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
}
