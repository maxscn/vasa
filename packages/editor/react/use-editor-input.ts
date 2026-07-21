import type { ClipboardEvent, FormEvent, KeyboardEvent, MutableRefObject } from "react";
import {
  type BrowserInputAdapter,
  type HeadlessEditorInteraction,
  type JSONContent,
  type EditorRenderLineDocument,
  type EditorRenderLineOptions,
  type EditorSelection,
  type SkrivaDeleteIntent,
  type SkrivaShortcut,
  type SkrivaSurfaceAdapter,
} from "../src/internal.ts";
import {
  applyEditorKeymap,
  defaultEditorKeymap,
  type EditorKeymap,
  type EditorKeymapOptions,
} from "./keymap.ts";

export type UseEditorInputOptions = {
  editorDocument: JSONContent;
  keymap?: EditorKeymap;
  measureText: (text: string, font?: string) => number;
  renderDocument: EditorRenderLineDocument;
  renderLineOptions: EditorRenderLineOptions;
  suppressedBeforeInputRef: MutableRefObject<Record<string, number>>;
  browserInput: BrowserInputAdapter;
  surfaceAdapter?: SkrivaSurfaceAdapter;
  updateSelection: (
    nextSelection: EditorSelection | ((currentSelection: EditorSelection) => EditorSelection),
  ) => void;
  toggleBold: () => void;
  toggleMark: EditorKeymapOptions["toggleMark"];
  toggleBlockquote: () => void;
  setBlockType: EditorKeymapOptions["setBlockType"];
  reduceInteraction?: (interaction: HeadlessEditorInteraction) => boolean;
};

export function useEditorInput(options: UseEditorInputOptions) {
  function suppressBeforeInput(inputType: string) {
    options.suppressedBeforeInputRef.current[inputType] = performance.now() + 250;
  }

  function dispatchSurfaceTextIntent(inputEvent: InputEvent) {
    const intent = options.browserInput.readInputEvent(inputEvent);
    if (intent === undefined) return false;

    if (intent.type === "insertText")
      return options.surfaceAdapter?.insertText(intent.text) ?? false;
    if (intent.type === "insertLineBreak")
      return options.surfaceAdapter?.insertLineBreak() ?? false;
    if (intent.type === "splitBlock") return options.surfaceAdapter?.splitBlock() ?? false;
    if (intent.type === "deleteBackward") {
      return options.surfaceAdapter?.deleteBackward(intent.intent) ?? false;
    }
    if (intent.type === "deleteForward") {
      return options.surfaceAdapter?.deleteForward(intent.intent) ?? false;
    }
    return options.surfaceAdapter?.runShortcut(intent.shortcut) ?? false;
  }

  function handleBeforeInput(event: FormEvent<HTMLTextAreaElement>) {
    const inputEvent = event.nativeEvent as InputEvent;
    const suppressedUntil = options.suppressedBeforeInputRef.current[inputEvent.inputType] ?? 0;

    if (suppressedUntil > performance.now()) {
      event.preventDefault();
      return;
    }

    if (dispatchSurfaceTextIntent(inputEvent)) {
      event.preventDefault();
      return;
    }

    if (inputEvent.inputType === "insertFromPaste") {
      event.preventDefault();
      return;
    }

    if (inputEvent.inputType === "deleteContentBackward") {
      event.preventDefault();
      return;
    }

    if (inputEvent.inputType === "deleteContentForward") {
      event.preventDefault();
      return;
    }

    if (inputEvent.inputType === "deleteByCut") {
      event.preventDefault();
    }

    if (inputEvent.inputType === "insertParagraph") event.preventDefault();
  }

  function handleInput(event: FormEvent<HTMLTextAreaElement>) {
    const inputEvent = event.nativeEvent as InputEvent;
    const suppressedUntil = options.suppressedBeforeInputRef.current[inputEvent.inputType] ?? 0;
    if (inputEvent.inputType === "insertFromPaste" || suppressedUntil > performance.now()) {
      event.preventDefault();
      event.currentTarget.value = "";
      return;
    }

    const value = event.currentTarget.value;
    if (value.length > 0) {
      options.surfaceAdapter?.insertText(value);
    }
    event.currentTarget.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    suppressBeforeInput("insertFromPaste");
    options.surfaceAdapter?.pasteClipboard(event.clipboardData);
    event.currentTarget.value = "";
  }

  function handleCopy(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    options.surfaceAdapter?.copySelection(event.clipboardData);
  }

  function handleCut(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    options.surfaceAdapter?.cutSelection(event.clipboardData);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (handleHeadlessKeyDown(event)) return;
    if (handleSurfaceKeyDown(event)) return;
    if (!isLegacyMovementKey(event)) return;

    applyEditorKeymap(
      event,
      {
        editorDocument: options.editorDocument,
        renderDocument: options.renderDocument,
        renderLineOptions: options.renderLineOptions,
        measureText: options.measureText,
        updateSelection: options.updateSelection,
        suppressBeforeInput,
        undo: () => options.surfaceAdapter?.runShortcut({ key: "z", mod: true }),
        redo: () => options.surfaceAdapter?.runShortcut({ key: "z", mod: true, shift: true }),
        toggleBold: options.toggleBold,
        toggleMark: options.toggleMark,
        toggleBlockquote: options.toggleBlockquote,
        setBlockType: options.setBlockType,
        insertLineBreak: () => options.surfaceAdapter?.insertLineBreak(),
        splitParagraph: () => options.surfaceAdapter?.splitBlock(),
      },
      options.keymap ?? defaultEditorKeymap,
    );
  }

  function handleHeadlessKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldReduceHeadlessKeyboardEvent(event)) return false;

    const handled =
      options.reduceInteraction?.({
        type: "keyboard",
        combo: {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        },
      }) ?? false;
    if (!handled) return false;

    event.preventDefault();
    if (event.key === "Backspace") suppressBeforeInput("deleteContentBackward");
    if (event.key === "Delete") suppressBeforeInput("deleteContentForward");
    return true;
  }

  function handleSurfaceKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isNativeBrowserShortcut(event)) return false;

    if (event.key === "Backspace") {
      event.preventDefault();
      suppressBeforeInput("deleteContentBackward");
      return (
        options.surfaceAdapter?.deleteBackward({ granularity: deleteIntentGranularity(event) }) ??
        false
      );
    }

    if (event.key === "Delete") {
      event.preventDefault();
      suppressBeforeInput("deleteContentForward");
      return (
        options.surfaceAdapter?.deleteForward({ granularity: deleteIntentGranularity(event) }) ??
        false
      );
    }

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      suppressBeforeInput("insertLineBreak");
      return options.surfaceAdapter?.insertLineBreak() ?? false;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      suppressBeforeInput("insertParagraph");
      return options.surfaceAdapter?.splitBlock() ?? false;
    }

    const shortcut = shortcutForEvent(event);
    if (shortcut !== undefined) {
      const handled = options.surfaceAdapter?.runShortcut(shortcut) ?? false;
      if (handled) event.preventDefault();
      return handled;
    }

    if (isPrintableTextKey(event)) {
      event.preventDefault();
      suppressBeforeInput("insertText");
      return options.surfaceAdapter?.insertText(event.key) ?? false;
    }

    return false;
  }

  return {
    handleBeforeInput,
    handleCopy,
    handleCut,
    handleInput,
    handleKeyDown,
    handlePaste,
  };
}

export type UseEditorInputReturn = ReturnType<typeof useEditorInput>;

function shouldReduceHeadlessKeyboardEvent(event: KeyboardEvent<HTMLTextAreaElement>) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "arrowright") return true;
  if (
    (key === "arrowup" || key === "arrowdown") &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey
  ) {
    return true;
  }
  if (key === "a" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
    return true;
  }
  if (key === "b" && (event.ctrlKey || event.metaKey) && !event.altKey) return true;
  if (key === "u" && (event.ctrlKey || event.metaKey) && !event.altKey) return true;
  if (key === "z" && (event.ctrlKey || event.metaKey) && !event.altKey) return true;
  if (key === "backspace" || key === "delete") return true;
  return false;
}

export function isNativeBrowserShortcut(
  event: Pick<
    KeyboardEvent<HTMLTextAreaElement>,
    "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
) {
  const key = event.key.toLowerCase();
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
  return key === "c" || key === "x" || key === "v" || key === "r";
}

function shortcutForEvent(event: KeyboardEvent<HTMLTextAreaElement>): SkrivaShortcut | undefined {
  if (!(event.ctrlKey || event.metaKey || event.altKey)) return undefined;
  return {
    key: event.key.toLowerCase(),
    mod: event.ctrlKey || event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };
}

function isPrintableTextKey(event: KeyboardEvent<HTMLTextAreaElement>) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function deleteIntentGranularity(
  event: KeyboardEvent<HTMLTextAreaElement>,
): NonNullable<SkrivaDeleteIntent["granularity"]> {
  if (event.metaKey || event.ctrlKey) return "line";
  if (event.altKey) return "word";
  return "character";
}

function isLegacyMovementKey(event: KeyboardEvent<HTMLTextAreaElement>) {
  return (
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "ArrowUp" ||
    event.key === "ArrowDown"
  );
}
