import { Mark, type MaybeArray, type VasaExtension, type VasaExtensionRenderers } from "@vasa/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type CodeExtensionRenderers = {
  textStyle: () => { code: true; backgroundColor: string };
};

export type CodeExtensionOptions = {
  renderers?: VasaExtensionRenderers<CodeExtensionRenderers>;
};

const defaultCodeRenderers = {
  textStyle: () => ({ code: true, backgroundColor: "#eef2f7" }),
} satisfies CodeExtensionRenderers;

export function createCodeExtension(
  options: CodeExtensionOptions = {},
): VasaExtension<CodeExtensionRenderers> {
  return {
    name: "code",
    tiptap: createCodeMark(),
    renderers: {
      textStyle: appendRenderer(defaultCodeRenderers.textStyle, options.renderers?.textStyle),
    },
  };
}

export const Code = createCodeExtension();

function createCodeMark() {
  return Mark.create({
    name: "code",
    excludes: "_",
    code: true,
    parseHTML() {
      return [{ tag: "code" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["code", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setCode:
          () =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name),
        toggleCode:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name),
        unsetCode:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-e": () => markCommand(this.editor.commands, "toggleCode"),
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
