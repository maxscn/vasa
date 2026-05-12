import {
  Mark,
  mergeExtensionRenderers,
  type VasaExtension,
  type VasaExtensionRenderers,
} from "@vasa/core";

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type BoldExtensionRenderers = {
  textStyle: () => { fontWeight: string };
};

export type BoldExtensionOptions = {
  renderers?: VasaExtensionRenderers<BoldExtensionRenderers>;
};

const defaultBoldRenderers = {
  textStyle: () => ({ fontWeight: "700" }),
} satisfies BoldExtensionRenderers;

export function createBoldExtension(
  options: BoldExtensionOptions = {},
): VasaExtension<BoldExtensionRenderers> {
  return {
    name: "bold",
    tiptap: createBoldMark(),
    renderers: {
      textStyle: mergeExtensionRenderers(
        defaultBoldRenderers.textStyle,
        options.renderers?.textStyle,
      ),
    },
  };
}

export const Bold = createBoldExtension();

function createBoldMark() {
  return Mark.create({
    name: "bold",
    parseHTML() {
      return [
        { tag: "strong" },
        { tag: "b", getAttrs: (node) => (styleFontWeight(node) !== "normal" ? null : false) },
        {
          style: "font-weight",
          getAttrs: (value) => (isBoldFontWeight(value) ? null : false),
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return ["strong", HTMLAttributes, 0];
    },
    addCommands() {
      return {
        setBold:
          () =>
          ({ commands }: CommandProps) =>
            commands.setMark(this.name),
        toggleBold:
          () =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name),
        unsetBold:
          () =>
          ({ commands }: CommandProps) =>
            commands.unsetMark(this.name),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-b": () => boldCommand(this.editor.commands),
        "Mod-B": () => boldCommand(this.editor.commands),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

function boldCommand(commands: unknown) {
  const toggleBold = (commands as { toggleBold?: () => boolean }).toggleBold;
  return toggleBold?.() ?? false;
}

function styleFontWeight(node: unknown) {
  return htmlElementStyle(node)?.fontWeight;
}

function isBoldFontWeight(value: unknown) {
  const fontWeight = String(value);
  if (fontWeight === "bold" || fontWeight === "bolder") return true;
  const numeric = Number.parseInt(fontWeight, 10);
  return Number.isFinite(numeric) && numeric >= 600;
}

function htmlElementStyle(node: unknown): { fontWeight?: string } | undefined {
  if (typeof node !== "object" || node === null) return undefined;
  const style = (node as { style?: unknown }).style;
  return typeof style === "object" && style !== null
    ? (style as { fontWeight?: string })
    : undefined;
}
