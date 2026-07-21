import type { KeyboardEvent } from "react";
import type { SkrivaExtension } from "@skriva/core";
import { extendSelection, selectAllDocument } from "../src/actions.ts";
import {
  defaultEditorExtensions,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleStrike,
  toggleSubscript,
  toggleSuperscript,
  toggleUnderline,
} from "../src/font-attributes.ts";
import { isPrintableTextKey, moveSelectionHorizontallyByKeyboard } from "../src/keyboard.ts";
import {
  moveSelectionVertically,
  type EditorRenderLineDocument,
  type EditorRenderLineOptions,
} from "../src/interaction.ts";
import { type JSONContent, type EditorSelection } from "../src/internal.ts";

type EditorKeymapEvent = KeyboardEvent<HTMLTextAreaElement>;

export type EditorKeymapOptions = {
  editorDocument: JSONContent;
  renderDocument: EditorRenderLineDocument;
  renderLineOptions: EditorRenderLineOptions;
  measureText: (text: string, font?: string) => number;
  updateSelection: (
    nextSelection: EditorSelection | ((currentSelection: EditorSelection) => EditorSelection),
  ) => void;
  suppressBeforeInput: (inputType: string) => void;
  undo: () => void;
  redo: () => void;
  toggleBold: () => void;
  toggleMark: (
    type: string,
    mutate: (
      doc: JSONContent,
      currentSelection: EditorSelection,
    ) => {
      doc: JSONContent;
      selection: EditorSelection;
    },
    attrs?: Record<string, unknown>,
  ) => void;
  toggleBlockquote: () => void;
  setBlockType: (type: "paragraph" | "heading", attrs?: Record<string, unknown>) => void;
  insertLineBreak: () => void;
  splitParagraph: () => void;
};

export type EditorKeymapHandler = (
  event: EditorKeymapEvent,
  options: EditorKeymapOptions,
) => boolean;

export type EditorKeymap = Record<string, EditorKeymapHandler>;

type KeyboardShortcutCommand = (props: { editor: unknown }) => boolean;

export const editorHistoryKeymap: EditorKeymap = {
  "mod+z": (event, options) => {
    event.preventDefault();
    options.undo();
    return true;
  },
  "mod+shift+z": (event, options) => {
    event.preventDefault();
    options.redo();
    return true;
  },
  "mod+y": (event, options) => {
    event.preventDefault();
    options.redo();
    return true;
  },
};

export const editorTextKeymap: EditorKeymap = {
  "mod+a": (event, options) => {
    event.preventDefault();
    options.updateSelection(selectAllDocument(options.editorDocument));
    return true;
  },
  "mod+v": () => false,
  arrowleft: (event, options) => moveHorizontally(event, options, "left"),
  arrowright: (event, options) => moveHorizontally(event, options, "right"),
  arrowup: (event, options) => moveVertically(event, options, "up"),
  arrowdown: (event, options) => moveVertically(event, options, "down"),
  backspace: (event, options) => {
    event.preventDefault();
    options.suppressBeforeInput("deleteContentBackward");
    void options;
    return false;
  },
  delete: (event, options) => {
    event.preventDefault();
    options.suppressBeforeInput("deleteContentForward");
    void options;
    return false;
  },
  "shift+enter": (event, options) => {
    event.preventDefault();
    options.suppressBeforeInput("insertLineBreak");
    options.insertLineBreak();
    return true;
  },
  enter: (event, options) => {
    event.preventDefault();
    options.suppressBeforeInput("insertParagraph");
    options.splitParagraph();
    return true;
  },
};

export const editorNativeKeymap: EditorKeymap = {
  ...editorHistoryKeymap,
  ...editorTextKeymap,
};

export const defaultEditorKeymap: EditorKeymap = createDefaultEditorKeymap();

export function createDefaultEditorKeymap(extensions: SkrivaExtension[] = defaultEditorExtensions) {
  return {
    ...editorNativeKeymap,
    ...createEditorExtensionKeymap(extensions),
  };
}

export function createEditorExtensionKeymap(extensions: SkrivaExtension[]) {
  const keymap: EditorKeymap = {};

  for (const extension of extensions) {
    const addKeyboardShortcuts = extension.tiptap?.config.addKeyboardShortcuts as
      | ((this: unknown) => Record<string, KeyboardShortcutCommand>)
      | undefined;
    if (addKeyboardShortcuts === undefined) continue;

    const editor = createShortcutEditor();
    const shortcuts = addKeyboardShortcuts.call({
      name: extension.name,
      options: {},
      storage: {},
      editor,
      type: null,
      parent: undefined,
    });

    for (const [shortcut, command] of Object.entries(shortcuts)) {
      keymap[normalizeTiptapShortcut(shortcut)] = (event, options) => {
        setShortcutOptions(editor, options);
        const handled = command({ editor });
        if (!handled) return false;

        event.preventDefault();
        return true;
      };
    }
  }

  return keymap;
}

export function applyEditorKeymap(
  event: EditorKeymapEvent,
  options: EditorKeymapOptions,
  keymap: EditorKeymap = defaultEditorKeymap,
) {
  const shortcut = keymap[editorKeyForEvent(event)] ?? keymap[plainKeyForEvent(event)];
  if (shortcut?.(event, options)) return true;

  if (isPrintableTextKey(event)) {
    options.suppressBeforeInput("insertText");
    return false;
  }

  return false;
}

export function editorKeyForEvent(event: EditorKeymapEvent) {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(event.key.toLowerCase());
  return parts.join("+");
}

function normalizeTiptapShortcut(shortcut: string) {
  return shortcut
    .split("-")
    .map((part) => (part === "Mod" ? "mod" : part.toLowerCase()))
    .join("+");
}

function createShortcutEditor() {
  return {
    commands: new Proxy<Record<string, (...args: unknown[]) => boolean>>(
      {},
      {
        get: (_target, property) => {
          if (typeof property !== "string") return undefined;
          return (...args: unknown[]) => runShortcutCommand(property, args, currentShortcutOptions);
        },
      },
    ),
  };
}

function setShortcutOptions(editor: unknown, options: EditorKeymapOptions) {
  currentShortcutOptions = options;
  void editor;
}

let currentShortcutOptions: EditorKeymapOptions | undefined;

function runShortcutCommand(
  command: string,
  args: unknown[],
  options: EditorKeymapOptions | undefined,
) {
  if (options === undefined) return false;

  if (command === "toggleBold") {
    options.toggleBold();
    return true;
  }

  if (command === "toggleItalic") return toggleShortcutMark(options, "italic", toggleItalic);
  if (command === "toggleUnderline")
    return toggleShortcutMark(options, "underline", toggleUnderline);
  if (command === "toggleStrike") return toggleShortcutMark(options, "strike", toggleStrike);
  if (command === "toggleCode") return toggleShortcutMark(options, "code", toggleCode);
  if (command === "toggleSubscript")
    return toggleShortcutMark(options, "subscript", toggleSubscript);
  if (command === "toggleSuperscript") {
    return toggleShortcutMark(options, "superscript", toggleSuperscript);
  }

  if (command === "toggleHighlight") {
    const attrs = shortcutAttrs(args[0], { color: "#fef08a" });
    return toggleShortcutMark(
      options,
      "highlight",
      (doc, selection) => toggleHighlight(doc, selection, attrs),
      attrs,
    );
  }

  if (command === "toggleBlockquote") {
    options.toggleBlockquote();
    return true;
  }

  if (command === "setParagraph") {
    updateCurrentBlock(options, "paragraph");
    return true;
  }

  if (command === "toggleHeading") {
    const level = headingLevel((args[0] as { level?: unknown } | undefined)?.level);
    if (level === undefined) return false;

    updateCurrentBlock(options, "heading", { level });
    return true;
  }

  return false;
}

function toggleShortcutMark(
  options: EditorKeymapOptions,
  type: string,
  mutate: (
    doc: JSONContent,
    currentSelection: EditorSelection,
  ) => {
    doc: JSONContent;
    selection: EditorSelection;
  },
  attrs: Record<string, unknown> = {},
) {
  options.toggleMark(type, mutate, attrs);
  return true;
}

function updateCurrentBlock(
  options: EditorKeymapOptions,
  type: "paragraph" | "heading",
  attrs: Record<string, unknown> = {},
) {
  options.setBlockType(type, attrs);
}

function shortcutAttrs(value: unknown, fallback: Record<string, unknown>) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : fallback;
}

function headingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
    ? value
    : undefined;
}

function plainKeyForEvent(event: EditorKeymapEvent) {
  return event.key.toLowerCase();
}

function moveHorizontally(
  event: EditorKeymapEvent,
  options: EditorKeymapOptions,
  direction: "left" | "right",
) {
  event.preventDefault();
  options.updateSelection((currentSelection) =>
    moveSelectionHorizontallyByKeyboard(
      options.editorDocument,
      options.renderDocument,
      currentSelection,
      event,
      {
        direction,
        renderLines: options.renderLineOptions,
      },
    ),
  );
  return true;
}

function moveVertically(
  event: EditorKeymapEvent,
  options: EditorKeymapOptions,
  direction: "up" | "down",
) {
  event.preventDefault();
  options.updateSelection((selection) => {
    const nextPoint = moveSelectionVertically(
      options.renderDocument,
      selection,
      direction,
      options.measureText,
      options.renderLineOptions,
      options.editorDocument,
    );
    return extendSelection(selection, nextPoint, event.shiftKey);
  });
  return true;
}
