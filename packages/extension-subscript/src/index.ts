import {
  Mark,
  mergeExtensionRenderers,
  type SkrivaExtension,
  type SkrivaExtensionRenderers,
} from "@skriva/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type SubscriptExtensionRenderers = {
  textStyle: () => { verticalAlign: "sub" };
};

export type SubscriptExtensionOptions = {
  renderers?: SkrivaExtensionRenderers<SubscriptExtensionRenderers>;
};

const defaultSubscriptRenderers = {
  textStyle: () => ({ verticalAlign: "sub" }),
} satisfies SubscriptExtensionRenderers;

export function createSubscriptExtension(
  options: SubscriptExtensionOptions = {},
): SkrivaExtension<SubscriptExtensionRenderers> {
  return {
    name: "subscript",
    tiptap: createSubscriptMark(),
    renderers: {
      textStyle: mergeExtensionRenderers(
        defaultSubscriptRenderers.textStyle,
        options.renderers?.textStyle,
      ),
    },
  };
}

export const Subscript = createSubscriptExtension();

function createSubscriptMark() {
  return Mark.create({
    name: "subscript",
    excludes: "superscript",
    parseHTML() {
      return [{ tag: "sub" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["sub", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setSubscript:
          () =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name),
        toggleSubscript:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name),
        unsetSubscript:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-,": () => markCommand(this.editor.commands, "toggleSubscript"),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

function markCommand(commands: unknown, name: string) {
  const command = (commands as Record<string, (() => boolean) | undefined>)[name];
  return command?.() ?? false;
}
