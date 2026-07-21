import { toggleMark } from "prosemirror-commands";
import { TextSelection, type EditorState, type Transaction } from "prosemirror-state";
import { redo, undo } from "@tiptap/pm/history";
import type { RenderDocument } from "@skriva/renderer";
import { extendSelection } from "./actions.ts";
import { arrowMovementGranularity, type EditorKeyboardEventLike } from "./keyboard.ts";
import { moveSelectionHorizontally, type EditorRenderLineOptions } from "./interaction.ts";
import { normalizeTiptapJson, type JSONContent } from "./model.ts";
import {
  proseMirrorSelectionToSurfaceSelection,
  surfacePointToProseMirrorPosition,
} from "./surface/selection.ts";

export type HeadlessEditorState = {
  editorState: EditorState;
  visualContext: HeadlessInteractionVisualContext;
  effects: HeadlessInteractionEffect[];
};

export type HeadlessInteractionVisualContext = {
  renderDocument: RenderDocument;
  renderLineOptions: EditorRenderLineOptions;
};

export type HeadlessInteractionEffect =
  | {
      type: "transaction";
      transaction: Transaction;
    }
  | {
      type: "unhandled";
      interaction: HeadlessEditorInteraction;
    };

export type HeadlessEditorInteraction =
  | {
      type: "keyboard";
      combo: HeadlessKeyboardCombo;
    }
  | {
      type: "pointer";
      action: "press" | "drag" | "release";
    }
  | {
      type: "clipboard";
      action: "copy" | "cut" | "paste";
    };

export type HeadlessKeyboardCombo = EditorKeyboardEventLike;

export function reduceHeadlessInteraction(
  state: HeadlessEditorState,
  interaction: HeadlessEditorInteraction,
): HeadlessEditorState {
  if (interaction.type !== "keyboard") return withUnhandledEffect(state, interaction);

  const key = interaction.combo.key.toLowerCase();
  if (key === "a" && isModShortcut(interaction.combo) && interaction.combo.shiftKey !== true) {
    return selectAllDocument(state);
  }

  if (key === "b" && isModShortcut(interaction.combo)) {
    return toggleMarkShortcut(state, "bold");
  }

  if (key === "u" && isModShortcut(interaction.combo)) {
    return toggleMarkShortcut(state, "underline");
  }

  if (key === "z" && isModShortcut(interaction.combo)) {
    return historyShortcut(state, interaction.combo.shiftKey === true ? "redo" : "undo");
  }

  if (key === "arrowleft" || key === "arrowright") {
    return moveHorizontally(state, interaction.combo, key === "arrowleft" ? "left" : "right");
  }

  if ((key === "arrowup" || key === "arrowdown") && isModShortcut(interaction.combo)) {
    return moveToDocumentEdge(state, interaction.combo, key === "arrowup" ? "start" : "end");
  }

  if (key === "backspace" || key === "delete") {
    return deleteSelection(state, interaction);
  }

  return withUnhandledEffect(state, interaction);
}

function historyShortcut(
  state: HeadlessEditorState,
  direction: "undo" | "redo",
): HeadlessEditorState {
  let transaction = state.editorState.tr;
  const handled = (direction === "undo" ? undo : redo)(state.editorState, (nextTransaction) => {
    transaction = nextTransaction;
  });
  if (!handled) return withUnhandledEffect(state, { type: "keyboard", combo: { key: "z" } });

  return applyTransaction(state, transaction);
}

function selectAllDocument(state: HeadlessEditorState): HeadlessEditorState {
  const range = editableDocumentTextRange(state.editorState);
  if (range === undefined) {
    return withUnhandledEffect(state, { type: "keyboard", combo: { key: "a" } });
  }

  const transaction = state.editorState.tr.setSelection(
    TextSelection.create(state.editorState.doc, range.from, range.to),
  );
  return applyTransaction(state, transaction);
}

function editableDocumentTextRange(state: EditorState) {
  let from: number | undefined;
  let to: number | undefined;

  state.doc.descendants((node, position) => {
    if (!node.isText || node.text === undefined || node.text.length === 0) return;
    from ??= position;
    to = position + node.text.length;
  });

  return from === undefined || to === undefined ? undefined : { from, to };
}

function toggleMarkShortcut(state: HeadlessEditorState, markName: string): HeadlessEditorState {
  const markType = state.editorState.schema.marks[markName];
  if (markType === undefined) {
    return withUnhandledEffect(state, {
      type: "keyboard",
      combo: { key: markName },
    });
  }

  let transaction = state.editorState.tr;
  const handled = toggleMark(markType)(state.editorState, (nextTransaction) => {
    transaction = nextTransaction;
  });
  if (!handled) return withUnhandledEffect(state, { type: "keyboard", combo: { key: markName } });

  return applyTransaction(state, transaction);
}

function moveHorizontally(
  state: HeadlessEditorState,
  combo: HeadlessKeyboardCombo,
  direction: "left" | "right",
): HeadlessEditorState {
  const surfaceSelection = proseMirrorSelectionToSurfaceSelection(state.editorState.selection);
  if (surfaceSelection === undefined) {
    return withUnhandledEffect(state, { type: "keyboard", combo });
  }

  const doc = normalizeTiptapJson(state.editorState.doc.toJSON() as JSONContent);
  const nextPoint = moveSelectionHorizontally(
    doc,
    state.visualContext.renderDocument,
    surfaceSelection,
    {
      direction,
      granularity: arrowMovementGranularity(combo),
      renderLines: state.visualContext.renderLineOptions,
    },
  );
  const nextSelection = extendSelection(surfaceSelection, nextPoint, combo.shiftKey === true);
  const focusPosition = surfacePointToProseMirrorPosition(state.editorState.doc, nextSelection);
  if (focusPosition === undefined) {
    return withUnhandledEffect(state, { type: "keyboard", combo });
  }

  const anchorPosition =
    nextSelection.anchor === undefined
      ? focusPosition
      : surfacePointToProseMirrorPosition(state.editorState.doc, nextSelection.anchor);
  if (anchorPosition === undefined) {
    return withUnhandledEffect(state, { type: "keyboard", combo });
  }

  const transaction = state.editorState.tr.setSelection(
    TextSelection.create(state.editorState.doc, anchorPosition, focusPosition),
  );

  return applyTransaction(state, transaction);
}

function moveToDocumentEdge(
  state: HeadlessEditorState,
  combo: HeadlessKeyboardCombo,
  edge: "start" | "end",
): HeadlessEditorState {
  const range = editableDocumentTextRange(state.editorState);
  if (range === undefined) {
    return withUnhandledEffect(state, { type: "keyboard", combo });
  }

  const position = edge === "start" ? range.from : range.to;
  const anchor = combo.shiftKey === true ? state.editorState.selection.anchor : position;
  const transaction = state.editorState.tr.setSelection(
    TextSelection.create(state.editorState.doc, anchor, position),
  );

  return applyTransaction(state, transaction);
}

function deleteSelection(
  state: HeadlessEditorState,
  interaction: HeadlessEditorInteraction,
): HeadlessEditorState {
  if (state.editorState.selection.empty) return withUnhandledEffect(state, interaction);

  return applyTransaction(state, state.editorState.tr.deleteSelection());
}

function isModShortcut(combo: HeadlessKeyboardCombo) {
  return (combo.ctrlKey === true || combo.metaKey === true) && combo.altKey !== true;
}

function withUnhandledEffect(
  state: HeadlessEditorState,
  interaction: HeadlessEditorInteraction,
): HeadlessEditorState {
  return {
    ...state,
    effects: [...state.effects, { type: "unhandled", interaction }],
  };
}

function applyTransaction(
  state: HeadlessEditorState,
  transaction: Transaction,
): HeadlessEditorState {
  return {
    ...state,
    editorState: state.editorState.apply(transaction),
    effects: [{ type: "transaction", transaction }],
  };
}
