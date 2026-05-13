import {
  Mark,
  mergeExtensionRenderers,
  type SkrivaExtension,
  type SkrivaExtensionRenderers,
} from "@skriva/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type HighlightExtensionRenderers = {
  textStyle: (context: { mark: { attrs?: Record<string, unknown> } }) => {
    backgroundColor: string;
  };
};

export type HighlightExtensionOptions = {
  renderers?: SkrivaExtensionRenderers<HighlightExtensionRenderers>;
};

const defaultHighlightRenderers = {
  textStyle: ({ mark }) => ({
    backgroundColor: typeof mark.attrs?.color === "string" ? mark.attrs.color : "#fef08a",
  }),
} satisfies HighlightExtensionRenderers;

export function createHighlightExtension(
  options: HighlightExtensionOptions = {},
): SkrivaExtension<HighlightExtensionRenderers> {
  return {
    name: "highlight",
    tiptap: createHighlightMark(),
    renderers: {
      textStyle: mergeExtensionRenderers(
        defaultHighlightRenderers.textStyle,
        options.renderers?.textStyle,
      ),
    },
  };
}

export const Highlight = createHighlightExtension();

function createHighlightMark() {
  return Mark.create({
    name: "highlight",
    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (element) => element.style.backgroundColor || null,
          renderHTML: (attributes) => ({
            style: `background-color: ${String(attributes.color ?? "#fef08a")}`,
          }),
        },
      };
    },
    parseHTML() {
      return [{ tag: "mark" }, { style: "background-color" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["mark", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setHighlight:
          (attrs: Record<string, unknown> = {}) =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name, attrs),
        toggleHighlight:
          (attrs: Record<string, unknown> = {}) =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name, attrs),
        unsetHighlight:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-Shift-h": () => highlightCommand(this.editor.commands),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

function highlightCommand(commands: unknown) {
  const toggleHighlight = (commands as { toggleHighlight?: () => boolean }).toggleHighlight;
  return toggleHighlight?.() ?? false;
}
