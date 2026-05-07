import type { ClipboardEvent, FormEvent, KeyboardEvent, MutableRefObject } from "react";
import {
  applyEditorSessionMutation,
  editorClipboardMimeType,
  getSelectedContent,
  getSelectedHtml,
  getSelectedText,
  insertTextInEditorSession,
  parseEditorHtml,
  redoEditorSession,
  runEditorSessionAction,
  splitParagraph,
  undoEditorSession,
  type EditorJson,
  type EditorRenderLineDocument,
  type EditorRenderLineOptions,
  type EditorSelection,
  type EditorSession,
} from "../src/index.ts";
import {
  applyEditorKeymap,
  defaultEditorKeymap,
  type EditorKeymap,
  type EditorKeymapOptions,
} from "./keymap.ts";

export type UseEditorInputOptions = {
  editorDocument: EditorJson;
  editorSessionRef: MutableRefObject<EditorSession>;
  keymap?: EditorKeymap;
  measureText: (text: string, font?: string) => number;
  renderDocument: EditorRenderLineDocument;
  renderLineOptions: EditorRenderLineOptions;
  suppressedBeforeInputRef: MutableRefObject<Record<string, number>>;
  updateEditor: (update: (session: EditorSession) => EditorSession) => void;
  updateSelection: (
    nextSelection: EditorSelection | ((currentSelection: EditorSelection) => EditorSelection),
  ) => void;
  toggleBold: () => void;
  toggleMark: EditorKeymapOptions["toggleMark"];
  toggleBlockquote: () => void;
  setBlockType: EditorKeymapOptions["setBlockType"];
};

export function useEditorInput(options: UseEditorInputOptions) {
  function applyEditorMutation(
    mutate: (
      doc: EditorJson,
      currentSelection: EditorSelection,
    ) => {
      doc: EditorJson;
      selection: EditorSelection;
    },
  ) {
    options.updateEditor((session) => applyEditorSessionMutation(session, mutate));
  }

  function undoEditorChange() {
    options.updateEditor(undoEditorSession);
  }

  function redoEditorChange() {
    options.updateEditor(redoEditorSession);
  }

  function suppressBeforeInput(inputType: string) {
    options.suppressedBeforeInputRef.current[inputType] = performance.now() + 250;
  }

  function handleBeforeInput(event: FormEvent<HTMLTextAreaElement>) {
    const inputEvent = event.nativeEvent as InputEvent;
    const suppressedUntil = options.suppressedBeforeInputRef.current[inputEvent.inputType] ?? 0;

    if (suppressedUntil > performance.now()) {
      event.preventDefault();
      return;
    }

    if (inputEvent.inputType === "insertText" && inputEvent.data !== null) {
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

    if (inputEvent.inputType === "historyUndo") {
      event.preventDefault();
      undoEditorChange();
    }

    if (inputEvent.inputType === "historyRedo") {
      event.preventDefault();
      redoEditorChange();
    }

    if (inputEvent.inputType === "insertParagraph") {
      event.preventDefault();
      applyEditorMutation(splitParagraph);
    }

    if (inputEvent.inputType === "insertLineBreak") {
      event.preventDefault();
      options.updateEditor((session) => insertTextInEditorSession(session, "\n"));
    }
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
      options.updateEditor((session) => insertTextInEditorSession(session, value));
    }
    event.currentTarget.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    suppressBeforeInput("insertFromPaste");
    const content = parseClipboardContent(event.clipboardData.getData(editorClipboardMimeType));
    const htmlContent = content ?? parseEditorHtml(event.clipboardData.getData("text/html"));
    const text = event.clipboardData.getData("text/plain");
    options.updateEditor(
      (session) =>
        runEditorSessionAction(session, { type: "paste", text, content: htmlContent }).session,
    );
    event.currentTarget.value = "";
  }

  function handleCopy(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const current = options.editorSessionRef.current;
    const text = getSelectedText(current.doc, current.selection);
    if (text.length > 0) {
      event.clipboardData.setData("text/plain", text);
      const content = getSelectedContent(current.doc, current.selection);
      if (content !== undefined) {
        event.clipboardData.setData(editorClipboardMimeType, JSON.stringify(content));
        event.clipboardData.setData("text/html", getSelectedHtml(current.doc, current.selection));
      }
    }
  }

  function handleCut(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const current = options.editorSessionRef.current;
    const { session, result } = runEditorSessionAction(current, {
      type: "cut",
    });
    if (result.clipboardText === undefined) return;

    event.clipboardData.setData("text/plain", result.clipboardText);
    if (result.clipboardContent !== undefined) {
      event.clipboardData.setData(editorClipboardMimeType, JSON.stringify(result.clipboardContent));
      event.clipboardData.setData("text/html", getSelectedHtml(current.doc, current.selection));
    }
    options.updateEditor(() => session);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    applyEditorKeymap(
      event,
      {
        editorDocument: options.editorDocument,
        renderDocument: options.renderDocument,
        renderLineOptions: options.renderLineOptions,
        measureText: options.measureText,
        updateEditor: options.updateEditor,
        updateSelection: options.updateSelection,
        suppressBeforeInput,
        undo: undoEditorChange,
        redo: redoEditorChange,
        toggleBold: options.toggleBold,
        toggleMark: options.toggleMark,
        toggleBlockquote: options.toggleBlockquote,
        setBlockType: options.setBlockType,
        insertLineBreak: () =>
          options.updateEditor((session) => insertTextInEditorSession(session, "\n")),
        splitParagraph: () => applyEditorMutation(splitParagraph),
      },
      options.keymap ?? defaultEditorKeymap,
    );
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

function parseClipboardContent(value: string): EditorJson | undefined {
  if (value.length === 0) return undefined;

  try {
    const parsed = JSON.parse(value) as unknown;
    return isEditorJson(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isEditorJson(value: unknown): value is EditorJson {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}
