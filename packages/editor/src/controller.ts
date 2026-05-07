import {
  deleteBackward,
  getSelectedContent,
  getSelectedText,
  insertEditorContent,
  type EditorJson,
  type EditorSelection,
} from "./index.ts";
import { applyKeyboardIntent } from "./keyboard.ts";
import {
  trimTrailingInlineWhitespaceSelection,
  type EditorDeleteGranularity,
  type EditorTextLine,
} from "./actions.ts";

export type EditorControllerState = {
  doc: EditorJson;
  selection: EditorSelection;
};

export type EditorControllerAction =
  | {
      type: "insertText" | "paste";
      text: string;
      content?: EditorJson | undefined;
    }
  | {
      type: "backspace" | "delete";
      granularity?: EditorDeleteGranularity;
      line?: EditorTextLine | undefined;
    }
  | {
      type: "cut";
    };

export type EditorControllerResult = {
  state: EditorControllerState;
  clipboardText?: string;
  clipboardContent?: EditorJson;
};

export function applyEditorControllerAction(
  state: EditorControllerState,
  action: EditorControllerAction,
): EditorControllerResult {
  if (action.type === "paste" && action.content !== undefined) {
    return {
      state: insertEditorContent(state.doc, state.selection, action.content),
    };
  }

  if (action.type === "insertText" || action.type === "paste") {
    return {
      state: applyKeyboardIntent(state.doc, state.selection, {
        type: "insertText",
        text: action.text,
      }),
    };
  }

  if (action.type === "backspace" || action.type === "delete") {
    const selection = trimTrailingInlineWhitespaceSelection(state.doc, state.selection);
    return {
      state: applyKeyboardIntent(state.doc, selection, {
        type: "delete",
        direction: action.type === "backspace" ? "backward" : "forward",
        granularity: action.granularity ?? "character",
        line: action.line,
      }),
    };
  }

  const cutSelection = trimTrailingInlineWhitespaceSelection(state.doc, state.selection);
  const clipboardText = getSelectedText(state.doc, cutSelection);
  if (clipboardText.length === 0) return { state };

  const next = deleteBackward(state.doc, cutSelection);
  return {
    state: next,
    clipboardContent: getSelectedContent(state.doc, cutSelection),
    clipboardText,
  };
}
