import {
  Mark,
  mergeExtensionRenderers,
  type VasaExtension,
  type VasaExtensionRenderers,
} from "@vasa/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type StrikeExtensionRenderers = {
  textStyle: () => { textDecorationLine: "line-through" };
};

export type StrikeExtensionOptions = {
  renderers?: VasaExtensionRenderers<StrikeExtensionRenderers>;
};

const defaultStrikeRenderers = {
  textStyle: () => ({ textDecorationLine: "line-through" }),
} satisfies StrikeExtensionRenderers;

export function createStrikeExtension(
  options: StrikeExtensionOptions = {},
): VasaExtension<StrikeExtensionRenderers> {
  return {
    name: "strike",
    tiptap: createStrikeMark(),
    renderers: {
      textStyle: mergeExtensionRenderers(
        defaultStrikeRenderers.textStyle,
        options.renderers?.textStyle,
      ),
    },
  };
}

export const Strike = createStrikeExtension();

function createStrikeMark() {
  return Mark.create({
    name: "strike",
    parseHTML() {
      return [
        { tag: "s" },
        { tag: "del" },
        { tag: "strike" },
        {
          style: "text-decoration-line",
          getAttrs: (value) => (String(value).split(" ").includes("line-through") ? null : false),
        },
        {
          style: "text-decoration",
          getAttrs: (value) => (String(value).split(" ").includes("line-through") ? null : false),
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return ["s", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setStrike:
          () =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name),
        toggleStrike:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name),
        unsetStrike:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-Shift-s": () => markCommand(this.editor.commands, "toggleStrike"),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

function markCommand(commands: unknown, name: string) {
  const command = (commands as Record<string, (() => boolean) | undefined>)[name];
  return command?.() ?? false;
}
