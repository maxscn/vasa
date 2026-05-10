import {
  insertTextWithMarks,
  isSelectionExpanded,
  type EditorJson,
  type EditorMarkSpec,
  type EditorSelection,
} from "./index.ts";
import { createSelection } from "./actions.ts";
import { TextStyleMark } from "./font-attributes.ts";
import {
  applyEditorControllerAction,
  type EditorControllerAction,
  type EditorControllerResult,
  type EditorControllerState,
} from "./controller.ts";
import {
  areEditorDocumentsEqual,
  cloneEditorJson,
  cloneSelection,
  toggleStoredMark,
  upsertStoredMark,
} from "./interaction.ts";

export type EditorSession = {
  doc: EditorJson;
  selection: EditorSelection;
  storedMarks: EditorMarkSpec[];
  disabledMarks: string[];
  undo: EditorSessionHistoryEntry[];
  redo: EditorSessionHistoryEntry[];
  historyLimit: number;
};

export type EditorSessionHistoryEntry = {
  doc: EditorJson;
  selection: EditorSelection;
};

export type EditorSessionMutation = (
  doc: EditorJson,
  selection: EditorSelection,
) => EditorControllerState;

export type CreateEditorSessionOptions = {
  doc: EditorJson;
  selection?: EditorSelection;
  storedMarks?: EditorMarkSpec[];
  disabledMarks?: string[];
  historyLimit?: number;
};

const defaultHistoryLimit = 100;

export function createEditorSession(options: CreateEditorSessionOptions): EditorSession {
  return {
    doc: cloneEditorJson(options.doc),
    selection: cloneSelection(
      options.selection ?? createSelection({ path: [0, 0], offset: 0 }, undefined),
    ),
    storedMarks: cloneMarks(options.storedMarks ?? []),
    disabledMarks: [...(options.disabledMarks ?? [])],
    undo: [],
    redo: [],
    historyLimit: options.historyLimit ?? defaultHistoryLimit,
  };
}

export function updateEditorSessionSelection(
  session: EditorSession,
  selection: EditorSelection,
): EditorSession {
  return {
    ...session,
    disabledMarks: [],
    storedMarks: [],
    selection: cloneSelection(selection),
  };
}

export function applyEditorSessionMutation(
  session: EditorSession,
  mutate: EditorSessionMutation,
): EditorSession {
  const next = mutate(session.doc, session.selection);
  if (areEditorDocumentsEqual(session.doc, next.doc)) {
    return { ...session, doc: next.doc, selection: next.selection };
  }

  return {
    ...session,
    disabledMarks: [],
    doc: next.doc,
    selection: next.selection,
    undo: pushHistory(session.undo, session, session.historyLimit),
    redo: [],
  };
}

export function runEditorSessionAction(
  session: EditorSession,
  action: EditorControllerAction,
): { session: EditorSession; result: EditorControllerResult } {
  const result = applyEditorControllerAction(
    { doc: session.doc, selection: session.selection },
    action,
  );

  return {
    session: applyEditorSessionMutation(session, () => result.state),
    result,
  };
}

export function insertTextInEditorSession(session: EditorSession, text: string): EditorSession {
  if (
    (session.storedMarks.length > 0 || session.disabledMarks.length > 0) &&
    !isSelectionExpanded(session.selection)
  ) {
    return applyEditorSessionMutation(session, (doc, selection) =>
      insertTextWithSessionMarks(doc, selection, text, activeSessionMarks(session)),
    );
  }

  return runEditorSessionAction(session, { type: "insertText", text }).session;
}

export function toggleEditorSessionMark(
  session: EditorSession,
  mark: EditorMarkSpec,
  mutate: EditorSessionMutation,
): EditorSession {
  if (!isSelectionExpanded(session.selection)) {
    const storedMarkIsActive = session.storedMarks.some(
      (storedMark) => storedMark.type === mark.type,
    );
    const disabledMarkIsActive = session.disabledMarks.includes(mark.type);
    const currentMarkIsActive =
      marksAtSelection(session.doc, session.selection).some(
        (currentMark) => currentMark.type === mark.type,
      ) && !disabledMarkIsActive;

    return currentMarkIsActive || storedMarkIsActive
      ? {
          ...session,
          disabledMarks: [...new Set([...session.disabledMarks, mark.type])],
          storedMarks: session.storedMarks.filter((storedMark) => storedMark.type !== mark.type),
        }
      : {
          ...session,
          disabledMarks: session.disabledMarks.filter((disabledMark) => disabledMark !== mark.type),
          storedMarks: toggleStoredMark(session.storedMarks, mark),
        };
  }

  return applyEditorSessionMutation(session, mutate);
}

export function setEditorSessionTextStyle(
  session: EditorSession,
  attrs: Record<string, unknown>,
  mutate: EditorSessionMutation,
): EditorSession {
  if (!isSelectionExpanded(session.selection)) {
    return {
      ...session,
      storedMarks: upsertStoredMark(session.storedMarks, { type: TextStyleMark.name, attrs }),
    };
  }

  return applyEditorSessionMutation(session, mutate);
}

export function undoEditorSession(session: EditorSession): EditorSession {
  const previous = session.undo.at(-1);
  if (previous === undefined) return session;

  return {
    ...session,
    doc: cloneEditorJson(previous.doc),
    selection: cloneSelection(previous.selection),
    undo: session.undo.slice(0, -1),
    redo: pushHistory(session.redo, session, session.historyLimit),
  };
}

export function redoEditorSession(session: EditorSession): EditorSession {
  const next = session.redo.at(-1);
  if (next === undefined) return session;

  return {
    ...session,
    doc: cloneEditorJson(next.doc),
    selection: cloneSelection(next.selection),
    undo: pushHistory(session.undo, session, session.historyLimit),
    redo: session.redo.slice(0, -1),
  };
}

function insertTextWithSessionMarks(
  doc: EditorJson,
  selection: EditorSelection,
  text: string,
  storedMarks: EditorMarkSpec[],
): EditorControllerState {
  return insertTextWithMarks(doc, selection, text, storedMarks);
}

function activeSessionMarks(session: EditorSession): EditorMarkSpec[] {
  const currentMarks = marksAtSelection(session.doc, session.selection).filter(
    (mark) => !session.disabledMarks.includes(mark.type),
  );
  const storedTypes = new Set(session.storedMarks.map((mark) => mark.type));

  return [...currentMarks.filter((mark) => !storedTypes.has(mark.type)), ...session.storedMarks];
}

function marksAtSelection(doc: EditorJson, selection: EditorSelection): EditorMarkSpec[] {
  const node = getEditorNodeAtPath(doc, selection.path);
  return node?.marks ?? [];
}

function getEditorNodeAtPath(doc: EditorJson, path: number[]): EditorJson | undefined {
  let current: EditorJson | undefined = doc;

  for (const index of path) {
    current = current?.content?.[index];
  }

  return current;
}

function pushHistory(
  entries: EditorSessionHistoryEntry[],
  entry: Pick<EditorSession, "doc" | "selection">,
  limit: number,
) {
  const next = [...entries, cloneHistoryEntry(entry)];
  if (next.length > limit) next.shift();
  return next;
}

function cloneHistoryEntry(
  entry: Pick<EditorSession, "doc" | "selection">,
): EditorSessionHistoryEntry {
  return {
    doc: cloneEditorJson(entry.doc),
    selection: cloneSelection(entry.selection),
  };
}

function cloneMarks(marks: EditorMarkSpec[]) {
  return marks.map((mark) => ({
    type: mark.type,
    ...(mark.attrs === undefined ? {} : { attrs: { ...mark.attrs } }),
  }));
}
