import type { Editor } from "@skriva/core";

export type ClipboardTarget = {
  setData(type: string, value: string): void;
};

export type ClipboardSource = {
  getData(type: string): string;
};

export type ClipboardAdapter = {
  copy(editor: Editor, target: ClipboardTarget): boolean;
  cut(editor: Editor, target: ClipboardTarget): boolean;
  paste(editor: Editor, source: ClipboardSource): boolean;
};

export function createPlainTextClipboardAdapter(): ClipboardAdapter {
  return {
    copy(editor, target) {
      const text = selectedText(editor);
      if (text.length === 0) return false;
      target.setData("text/plain", text);
      return true;
    },
    cut(editor, target) {
      const text = selectedText(editor);
      if (text.length === 0) return false;
      target.setData("text/plain", text);
      return editor.commands.deleteSelection();
    },
    paste(editor, source) {
      const html = source.getData("text/html");
      const text = source.getData("text/plain");
      const content = html.length > 0 ? html : text;
      if (content.length === 0) return false;
      return editor.commands.insertContent(content);
    },
  };
}

function selectedText(editor: Editor) {
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  return editor.state.doc.textBetween(from, to, "\n");
}
