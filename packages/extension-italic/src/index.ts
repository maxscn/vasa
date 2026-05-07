import { Mark, type MaybeArray, type VasaExtension, type VasaExtensionRenderers } from "@vasa/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type ItalicExtensionRenderers = {
  textStyle: () => { fontStyle: "italic" };
};

export type ItalicExtensionOptions = {
  renderers?: VasaExtensionRenderers<ItalicExtensionRenderers>;
};

const defaultItalicRenderers = {
  textStyle: () => ({ fontStyle: "italic" }),
} satisfies ItalicExtensionRenderers;

export function createItalicExtension(
  options: ItalicExtensionOptions = {},
): VasaExtension<ItalicExtensionRenderers> {
  return {
    name: "italic",
    tiptap: createItalicMark(),
    renderers: {
      textStyle: appendRenderer(defaultItalicRenderers.textStyle, options.renderers?.textStyle),
    },
  };
}

export const Italic = createItalicExtension();

function createItalicMark() {
  return Mark.create({
    name: "italic",
    parseHTML() {
      return [
        { tag: "em" },
        { tag: "i", getAttrs: (node) => (styleFontStyle(node) !== "normal" ? null : false) },
        { style: "font-style=italic" },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return ["em", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setItalic:
          () =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name),
        toggleItalic:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name),
        unsetItalic:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-i": () => markCommand(this.editor.commands, "toggleItalic"),
        "Mod-I": () => markCommand(this.editor.commands, "toggleItalic"),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

function markCommand(commands: unknown, name: string) {
  const command = (commands as Record<string, (() => boolean) | undefined>)[name];
  return command?.() ?? false;
}

function styleFontStyle(node: unknown) {
  return htmlElementStyle(node)?.fontStyle;
}

function htmlElementStyle(node: unknown): { fontStyle?: string } | undefined {
  if (typeof node !== "object" || node === null) return undefined;
  const style = (node as { style?: unknown }).style;
  return typeof style === "object" && style !== null
    ? (style as { fontStyle?: string })
    : undefined;
}

function appendRenderer<T>(defaultRenderer: T, renderer: MaybeArray<T> | undefined): MaybeArray<T> {
  if (renderer === undefined) return defaultRenderer;
  return [defaultRenderer, ...(Array.isArray(renderer) ? renderer : [renderer])];
}
