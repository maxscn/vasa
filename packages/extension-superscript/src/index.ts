import { Mark, type MaybeArray, type VasaExtension, type VasaExtensionRenderers } from "@vasa/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type SuperscriptExtensionRenderers = {
  textStyle: () => { verticalAlign: "super" };
};

export type SuperscriptExtensionOptions = {
  renderers?: VasaExtensionRenderers<SuperscriptExtensionRenderers>;
};

const defaultSuperscriptRenderers = {
  textStyle: () => ({ verticalAlign: "super" }),
} satisfies SuperscriptExtensionRenderers;

export function createSuperscriptExtension(
  options: SuperscriptExtensionOptions = {},
): VasaExtension<SuperscriptExtensionRenderers> {
  return {
    name: "superscript",
    tiptap: createSuperscriptMark(),
    renderers: {
      textStyle: appendRenderer(
        defaultSuperscriptRenderers.textStyle,
        options.renderers?.textStyle,
      ),
    },
  };
}

export const Superscript = createSuperscriptExtension();

function createSuperscriptMark() {
  return Mark.create({
    name: "superscript",
    excludes: "subscript",
    parseHTML() {
      return [{ tag: "sup" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["sup", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setSuperscript:
          () =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name),
        toggleSuperscript:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name),
        unsetSuperscript:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-.": () => markCommand(this.editor.commands, "toggleSuperscript"),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

function markCommand(commands: unknown, name: string) {
  const command = (commands as Record<string, (() => boolean) | undefined>)[name];
  return command?.() ?? false;
}

function appendRenderer<T>(defaultRenderer: T, renderer: MaybeArray<T> | undefined): MaybeArray<T> {
  if (renderer === undefined) return defaultRenderer;
  return [defaultRenderer, ...(Array.isArray(renderer) ? renderer : [renderer])];
}
