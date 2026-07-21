import type { Editor } from "@skriva/core";
import { serializeEditorClipboardHtml } from "../html.ts";
import { normalizeTiptapJson, type JSONContent } from "../model.ts";
import { getSelectedContent } from "../selection.ts";
import { proseMirrorSelectionToSurfaceSelection } from "./selection.ts";

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
      const html = selectedHtml(editor);
      if (isRichClipboardHtml(html)) target.setData("text/html", html);
      return true;
    },
    cut(editor, target) {
      const text = selectedText(editor);
      if (text.length === 0) return false;
      target.setData("text/plain", text);
      const html = selectedHtml(editor);
      if (isRichClipboardHtml(html)) target.setData("text/html", html);
      return editor.commands.deleteSelection();
    },
    paste(editor, source) {
      const html = source.getData("text/html");
      const text = source.getData("text/plain");
      if (isRichClipboardHtml(html)) return editor.view.pasteHTML(html);
      if (text.length === 0) return false;
      return editor.view.pasteText(text);
    },
  };
}

function selectedText(editor: Editor) {
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  return editor.state.doc.textBetween(from, to, "\n");
}

function selectedHtml(editor: Editor) {
  const selection = proseMirrorSelectionToSurfaceSelection(editor.state.selection);
  if (selection === undefined) return "";

  const content = getSelectedContent(
    normalizeTiptapJson(editor.getJSON() as JSONContent),
    selection,
  );
  return content === undefined ? "" : serializeEditorClipboardHtml(content);
}

function isRichClipboardHtml(html: string) {
  if (html.trim().length === 0) return false;
  return /<(strong|b|em|i|u|s|del|strike|code|sub|sup|mark|span|h[1-6]|blockquote|table|tbody|tr|td|th|ul|ol|li|p|br)\b/i.test(
    html,
  );
}
