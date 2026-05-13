import {
  useSkrivaEditor,
  type SkrivaEditorConfig,
  type SkrivaEditorProps,
  type SkrivaEditorSurfaceDropContext,
  type SkrivaEditorSurfaceDropHandler,
  type UseSkrivaEditorReturn,
} from "./use-editor.ts";
import { useEditorFonts, type UseEditorFontsReturn } from "./use-editor-fonts.ts";
import { useEditorPdf, type UseEditorPdfReturn } from "./use-editor-pdf.ts";

export { SkrivaCanvasEditor, type SkrivaCanvasEditorProps } from "./canvas-editor.tsx";
export {
  SkrivaEditorShellProvider,
  useOptionalSkrivaEditorShell,
  useSkrivaEditorShell,
  type SkrivaEditorShellContextValue,
} from "./editor-shell-context.tsx";
export {
  applyEditorKeymap,
  defaultEditorKeymap,
  editorHistoryKeymap,
  editorKeyForEvent,
  editorTextKeymap,
} from "./keymap.ts";
export { useSkrivaEditor };
export { useEditorFonts };
export { useEditorPdf };
export {
  canvasVisualScale,
  isSelectionInsideEditorNodeType,
  pageCanvasY,
  preferredSelectableFonts,
  renderPageContainsSourcePath,
  scrollEditorCanvasToPage,
  selectedRenderPageIndex,
} from "./shell-utils.ts";
export type {
  SkrivaEditorConfig,
  SkrivaEditorProps,
  SkrivaEditorSurfaceDropContext,
  SkrivaEditorSurfaceDropHandler,
  UseEditorFontsReturn,
  UseSkrivaEditorReturn,
  UseEditorPdfReturn,
};
export type { EditorKeymap, EditorKeymapHandler, EditorKeymapOptions } from "./keymap.ts";
export type { UseEditorFontsOptions } from "./use-editor-fonts.ts";
export type { UseEditorPdfOptions } from "./use-editor-pdf.ts";
