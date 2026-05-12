import {
  Mark,
  mergeExtensionRenderers,
  type VasaExtension,
  type VasaExtensionRenderers,
} from "@vasa/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type UnderlineExtensionRenderers = {
  textStyle: () => { textDecorationLine: "underline" };
};

export type UnderlineExtensionOptions = {
  renderers?: VasaExtensionRenderers<UnderlineExtensionRenderers>;
};

const defaultUnderlineRenderers = {
  textStyle: () => ({ textDecorationLine: "underline" }),
} satisfies UnderlineExtensionRenderers;

export function createUnderlineExtension(
  options: UnderlineExtensionOptions = {},
): VasaExtension<UnderlineExtensionRenderers> {
  return {
    name: "underline",
    tiptap: createUnderlineMark(),
    renderers: {
      textStyle: mergeExtensionRenderers(
        defaultUnderlineRenderers.textStyle,
        options.renderers?.textStyle,
      ),
    },
  };
}

export const Underline = createUnderlineExtension();

function createUnderlineMark() {
  return Mark.create({
    name: "underline",
    parseHTML() {
      return [
        { tag: "u" },
        {
          style: "text-decoration-line",
          getAttrs: (value) => (String(value).split(" ").includes("underline") ? null : false),
        },
        {
          style: "text-decoration",
          getAttrs: (value) => (String(value).split(" ").includes("underline") ? null : false),
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return ["u", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setUnderline:
          () =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name),
        toggleUnderline:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name),
        unsetUnderline:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-u": () => markCommand(this.editor.commands, "toggleUnderline"),
        "Mod-U": () => markCommand(this.editor.commands, "toggleUnderline"),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

function markCommand(commands: unknown, name: string) {
  const command = (commands as Record<string, (() => boolean) | undefined>)[name];
  return command?.() ?? false;
}
