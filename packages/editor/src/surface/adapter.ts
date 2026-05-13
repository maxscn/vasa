import type { Editor } from "@skriva/core";
import {
  deleteSelection,
  joinBackward,
  joinForward,
  selectNodeBackward,
  selectNodeForward,
} from "prosemirror-commands";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { TextSelection, type Command } from "prosemirror-state";
import { isWordSeparator } from "../word.ts";
import type { ClipboardAdapter, ClipboardSource, ClipboardTarget } from "./clipboard.ts";
import type { ProjectSurfaceSelection, SurfaceSelection } from "./selection.ts";

export type SkrivaSurfacePoint = {
  path: number[];
  offset: number;
};

export type SkrivaSurfaceLine = {
  path: number[];
  start: number;
  text: string;
};

export type SkrivaSelectionIntent = {
  extend?: boolean;
};

export type SkrivaDeleteIntent = {
  granularity?: "character" | "word" | "line";
};

export type SkrivaShortcut = {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export type SkrivaSurfaceAdapter = {
  placeSelectionAt(point: SkrivaSurfacePoint, intent?: SkrivaSelectionIntent): boolean;
  extendSelectionTo(point: SkrivaSurfacePoint): boolean;
  selectWordAt(point: SkrivaSurfacePoint): boolean;
  selectLineAt(point: SkrivaSurfacePoint, line?: SkrivaSurfaceLine): boolean;
  insertText(text: string): boolean;
  insertLineBreak(): boolean;
  splitBlock(): boolean;
  deleteBackward(intent?: SkrivaDeleteIntent): boolean;
  deleteForward(intent?: SkrivaDeleteIntent): boolean;
  copySelection(target: ClipboardTarget): boolean;
  cutSelection(target: ClipboardTarget): boolean;
  pasteClipboard(source: ClipboardSource): boolean;
  runShortcut(shortcut: SkrivaShortcut): boolean;
};

export type CreateSkrivaSurfaceAdapterOptions = {
  editor: Editor;
  projectSelection: ProjectSurfaceSelection;
  projectWordSelection?: ProjectSurfaceSelection;
  projectLineSelection?: (
    point: SkrivaSurfacePoint,
    line?: SkrivaSurfaceLine,
  ) => SurfaceSelection | undefined;
  clipboard: ClipboardAdapter;
};

export function createSkrivaSurfaceAdapter(
  options: CreateSkrivaSurfaceAdapterOptions,
): SkrivaSurfaceAdapter {
  return {
    placeSelectionAt(point, intent = {}) {
      const selection = options.projectSelection(point, intent);
      if (selection === undefined) return false;
      return applySurfaceSelection(options.editor, selection);
    },
    extendSelectionTo(point) {
      const selection = options.projectSelection(point, { extend: true });
      if (selection === undefined) return false;
      return applySurfaceSelection(options.editor, selection);
    },
    selectWordAt(point) {
      const selection = options.projectWordSelection?.(point, {});
      if (selection === undefined) return false;
      return applySurfaceSelection(options.editor, selection);
    },
    selectLineAt(point, line) {
      const selection = options.projectLineSelection?.(point, line);
      if (selection === undefined) return false;
      return applySurfaceSelection(options.editor, selection);
    },
    insertText(text) {
      if (insertParagraphAtGapCursor(options.editor, text)) return true;
      options.editor.view.dispatch(options.editor.state.tr.insertText(text).scrollIntoView());
      return true;
    },
    insertLineBreak() {
      if (insertParagraphAtGapCursor(options.editor)) return true;
      return options.editor.commands.insertContent("\n");
    },
    splitBlock() {
      if (insertParagraphAtGapCursor(options.editor)) return true;
      return options.editor.commands.splitBlock();
    },
    deleteBackward(intent = {}) {
      return applySurfaceDelete(options.editor, "backspace", intent);
    },
    deleteForward(intent = {}) {
      return applySurfaceDelete(options.editor, "delete", intent);
    },
    copySelection(target) {
      return options.clipboard.copy(options.editor, target);
    },
    cutSelection(target) {
      return options.clipboard.cut(options.editor, target);
    },
    pasteClipboard(source) {
      return options.clipboard.paste(options.editor, source);
    },
    runShortcut(shortcut) {
      return options.editor.commands.keyboardShortcut(shortcutName(shortcut));
    },
  };
}

function applySurfaceDelete(
  editor: Editor,
  type: "backspace" | "delete",
  intent: SkrivaDeleteIntent,
) {
  const command = commandForSurfaceDelete(type, intent);
  return command(editor.state, editor.view.dispatch, editor.view);
}

function applySurfaceSelection(editor: Editor, selection: SurfaceSelection) {
  if (isGapCursorSurfaceSelection(selection)) {
    const position = editor.state.doc.resolve(selection.position);
    editor.view.dispatch(editor.state.tr.setSelection(new GapCursor(position)).scrollIntoView());
    return true;
  }

  return editor.commands.setTextSelection(selection);
}

function isGapCursorSurfaceSelection(
  selection: SurfaceSelection,
): selection is Extract<SurfaceSelection, { type: "gapCursor" }> {
  return (
    typeof selection === "object" &&
    selection !== null &&
    "type" in selection &&
    selection.type === "gapCursor"
  );
}

function insertParagraphAtGapCursor(editor: Editor, text = "") {
  if (!(editor.state.selection instanceof GapCursor)) return false;

  const paragraphType = editor.state.schema.nodes.paragraph;
  if (paragraphType === undefined) return false;

  const paragraph =
    text.length === 0
      ? paragraphType.createAndFill()
      : paragraphType.create(null, editor.state.schema.text(text));
  if (paragraph === null) return false;

  const position = editor.state.selection.from;
  const tr = editor.state.tr.insert(position, paragraph);
  editor.view.dispatch(
    tr.setSelection(TextSelection.create(tr.doc, position + 1 + text.length)).scrollIntoView(),
  );
  return true;
}

function commandForSurfaceDelete(
  type: "backspace" | "delete",
  intent: SkrivaDeleteIntent,
): Command {
  return (state, dispatch, view) => {
    if (deleteSelection(state, dispatch, view)) return true;

    const textDeleted =
      intent.granularity === "line"
        ? deleteTextblockSide(state, dispatch, type)
        : intent.granularity === "word"
          ? deleteAdjacentWord(state, dispatch, type)
          : deleteAdjacentCharacter(state, dispatch, type);
    if (textDeleted) return true;

    const structuralCommands =
      type === "backspace" ? [joinBackward, selectNodeBackward] : [joinForward, selectNodeForward];
    return structuralCommands.some((command) => command(state, dispatch, view));
  };
}

function deleteAdjacentCharacter(
  state: Parameters<Command>[0],
  dispatch: Parameters<Command>[1],
  type: "backspace" | "delete",
) {
  const cursor = state.selection instanceof TextSelection ? state.selection.$cursor : null;
  if (cursor === null) return false;

  const from = type === "backspace" ? cursor.pos - 1 : cursor.pos;
  const to = type === "backspace" ? cursor.pos : cursor.pos + 1;
  if (
    (type === "backspace" && cursor.parentOffset <= 0) ||
    (type === "delete" && cursor.parentOffset >= cursor.parent.content.size)
  ) {
    return false;
  }

  if (dispatch !== undefined) {
    const selectionPosition = type === "backspace" ? from : cursor.pos;
    const tr = state.tr.delete(from, to);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, selectionPosition)).scrollIntoView());
  }
  return true;
}

function deleteAdjacentWord(
  state: Parameters<Command>[0],
  dispatch: Parameters<Command>[1],
  type: "backspace" | "delete",
) {
  const cursor = state.selection instanceof TextSelection ? state.selection.$cursor : null;
  if (cursor === null) return false;

  const text = cursor.parent.textBetween(0, cursor.parent.content.size, "", "");
  const range =
    type === "backspace"
      ? previousWordOffsetRange(text, cursor.parentOffset)
      : nextWordOffsetRange(text, cursor.parentOffset);
  if (range === undefined) return false;

  if (dispatch !== undefined) {
    const from = cursor.start() + range.start;
    const to = cursor.start() + range.end;
    const selectionPosition = type === "backspace" ? from : cursor.pos;
    const tr = state.tr.delete(from, to);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, selectionPosition)).scrollIntoView());
  }
  return true;
}

function deleteTextblockSide(
  state: Parameters<Command>[0],
  dispatch: Parameters<Command>[1],
  type: "backspace" | "delete",
) {
  const cursor = state.selection instanceof TextSelection ? state.selection.$cursor : null;
  if (cursor === null) return false;

  const range =
    type === "backspace"
      ? { start: 0, end: cursor.parentOffset }
      : { start: cursor.parentOffset, end: cursor.parent.content.size };
  if (range.start === range.end) return false;

  if (dispatch !== undefined) {
    const from = cursor.start() + range.start;
    const to = cursor.start() + range.end;
    const selectionPosition = type === "backspace" ? from : cursor.pos;
    const tr = state.tr.delete(from, to);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, selectionPosition)).scrollIntoView());
  }
  return true;
}

function previousWordOffsetRange(text: string, offset: number) {
  if (offset <= 0) return undefined;

  let start = offset;
  while (start > 0 && isWordSeparator(text[start - 1])) start -= 1;
  while (start > 0 && !isWordSeparator(text[start - 1])) start -= 1;

  return start === offset ? undefined : { start, end: offset };
}

function nextWordOffsetRange(text: string, offset: number) {
  if (offset >= text.length) return undefined;

  let end = offset;
  while (end < text.length && isWordSeparator(text[end])) end += 1;
  while (end < text.length && !isWordSeparator(text[end])) end += 1;

  return end === offset ? undefined : { start: offset, end };
}

function shortcutName(shortcut: SkrivaShortcut) {
  return [
    shortcut.mod === true ? "Mod" : undefined,
    shortcut.alt === true ? "Alt" : undefined,
    shortcut.shift === true ? "Shift" : undefined,
    shortcut.key,
  ]
    .filter((part): part is string => part !== undefined)
    .join("-");
}
