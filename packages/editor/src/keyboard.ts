import {
  deleteByGranularity,
  extendSelection,
  type EditorDeleteDirection,
  type EditorDeleteGranularity,
  type EditorTextLine,
} from "./actions.ts";
import { insertText, type EditorJson, type EditorSelection } from "./index.ts";
import {
  moveSelectionHorizontally,
  type EditorRenderLineDocument,
  type EditorRenderLineOptions,
} from "./interaction.ts";

export type EditorKeyboardIntent =
  | {
      type: "insertText";
      text: string;
    }
  | {
      type: "delete";
      direction: EditorDeleteDirection;
      granularity: EditorDeleteGranularity;
      line?: EditorTextLine | undefined;
    };

export type EditorKeyboardEventLike = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

export function applyKeyboardIntent(
  doc: EditorJson,
  selection: EditorSelection,
  intent: EditorKeyboardIntent,
): { doc: EditorJson; selection: EditorSelection } {
  if (intent.type === "insertText") {
    return insertText(doc, selection, intent.text);
  }

  return deleteByGranularity(doc, selection, {
    direction: intent.direction,
    granularity: intent.granularity,
    line: intent.line,
  });
}

export function isPasteShortcut(event: EditorKeyboardEventLike) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";
}

export function isSelectAllShortcut(event: EditorKeyboardEventLike) {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "a"
  );
}

export function isUndoShortcut(event: EditorKeyboardEventLike) {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z"
  );
}

export function isRedoShortcut(event: EditorKeyboardEventLike) {
  const key = event.key.toLowerCase();
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    ((event.shiftKey && key === "z") || (!event.shiftKey && key === "y"))
  );
}

export function isBoldShortcut(event: EditorKeyboardEventLike) {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "b"
  );
}

export function isPrintableTextKey(event: EditorKeyboardEventLike) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function arrowMovementGranularity(event: EditorKeyboardEventLike) {
  if (event.ctrlKey) return "line";
  if (event.altKey) return "word";
  return "character";
}

export function moveSelectionHorizontallyByKeyboard(
  doc: EditorJson,
  renderDocument: EditorRenderLineDocument,
  selection: EditorSelection,
  event: EditorKeyboardEventLike,
  options: {
    direction: "left" | "right";
    renderLines: EditorRenderLineOptions;
  },
): EditorSelection {
  return extendSelection(
    selection,
    moveSelectionHorizontally(doc, renderDocument, selection, {
      direction: options.direction,
      granularity: arrowMovementGranularity(event),
      renderLines: options.renderLines,
    }),
    event.shiftKey === true,
  );
}

export function deleteGranularity(event: EditorKeyboardEventLike) {
  if (event.ctrlKey) return "line";
  if (event.altKey) return "word";
  return "character";
}
