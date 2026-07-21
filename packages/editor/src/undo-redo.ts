import { Extension } from "@skriva/core";
import { history, redo, undo } from "@tiptap/pm/history";

type HistoryCommandProps = {
  state: Parameters<typeof undo>[0];
  dispatch?: Parameters<typeof undo>[1];
  view?: Parameters<typeof undo>[2];
};

export const UndoRedo = {
  name: "undoRedo",
  tiptap: Extension.create({
    name: "undoRedo",
    addProseMirrorPlugins() {
      return [history()];
    },
    addCommands() {
      return {
        undo:
          () =>
          ({ state, dispatch, view }: HistoryCommandProps) =>
            undo(state, dispatch, view),
        redo:
          () =>
          ({ state, dispatch, view }: HistoryCommandProps) =>
            redo(state, dispatch, view),
      };
    },
    addKeyboardShortcuts() {
      return {
        "Mod-z": () => historyCommand(this.editor.commands, "undo"),
        "Mod-Shift-z": () => historyCommand(this.editor.commands, "redo"),
        "Mod-y": () => historyCommand(this.editor.commands, "redo"),
      };
    },
  } as Parameters<typeof Extension.create>[0]),
};

function historyCommand(commands: unknown, name: "undo" | "redo") {
  const command = (commands as Record<string, (() => boolean) | undefined>)[name];
  return command?.() ?? false;
}
