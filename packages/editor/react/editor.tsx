import {
  useEditor,
  type EditorConfig,
  type EditorProps,
  type UseEditorReturn,
} from "./use-editor.ts";
import { useEditorFonts, type UseEditorFontsReturn } from "./use-editor-fonts.ts";
import { useEditorPdf, type UseEditorPdfReturn } from "./use-editor-pdf.ts";

export {
  applyEditorKeymap,
  defaultEditorKeymap,
  editorHistoryKeymap,
  editorKeyForEvent,
  editorTextKeymap,
} from "./keymap.ts";
export { useEditor };
export { useEditorFonts };
export { useEditorPdf };
export type {
  EditorConfig,
  EditorProps,
  UseEditorFontsReturn,
  UseEditorReturn,
  UseEditorPdfReturn,
};
export type { EditorKeymap, EditorKeymapHandler, EditorKeymapOptions } from "./keymap.ts";
export type { UseEditorFontsOptions } from "./use-editor-fonts.ts";
export type { UseEditorPdfOptions } from "./use-editor-pdf.ts";
