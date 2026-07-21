import {
  SkrivaSurfaceProvider,
  useSkriva,
  useSkrivaEditor,
  type SkrivaEditorConfig,
  type SkrivaEditorProps,
  type SkrivaEditorSurfaceDropContext,
  type SkrivaEditorSurfaceDropHandler,
  type UseSkrivaOptions,
  type UseSkrivaEditorReturn,
  type UseSkrivaReturn,
} from "./use-editor.ts";
import { useEditorFonts, type UseEditorFontsReturn } from "./use-editor-fonts.ts";
import { useEditorPdf, type UseEditorPdfReturn } from "./use-editor-pdf.ts";
import { usePdf, type UsePdfOptions, type UsePdfReturn } from "./use-pdf.ts";
import { SkrivaCanvasEditor, type SkrivaCanvasEditorProps } from "./canvas-editor.tsx";
import type { Editor as TiptapEditor } from "@skriva/core";
import type { ReactNode } from "react";

export {
  SkrivaEditorShellProvider,
  useOptionalSkrivaEditorShell,
  useSkrivaEditorShell,
  type SkrivaEditorShellContextValue,
} from "./editor-shell-context.tsx";
export {
  applyEditorKeymap,
  createEditorExtensionKeymap,
  defaultEditorKeymap,
  editorHistoryKeymap,
  editorKeyForEvent,
  editorTextKeymap,
} from "./keymap.ts";
export type EditorProps = Omit<SkrivaCanvasEditorProps, "editor"> & {
  editor: TiptapEditor | null;
  config: Omit<SkrivaEditorConfig, "extensions">;
  extensions?: SkrivaEditorConfig["extensions"];
  children?: ReactNode;
};

function EditorRoot({ editor, config, extensions, children, ...canvasProps }: EditorProps) {
  const skriva = useSkriva({
    editor,
    config: {
      ...config,
      extensions,
    },
  });

  return (
    <SkrivaSurfaceProvider value={skriva}>
      {children ?? <SkrivaCanvasEditor editor={skriva} {...canvasProps} />}
    </SkrivaSurfaceProvider>
  );
}

export const Editor = Object.assign(EditorRoot, {
  Canvas: SkrivaCanvasEditor,
});

export { SkrivaCanvasEditor };
export { useSkrivaEditor };
export { useSkriva };
export { useEditorFonts };
export { useEditorPdf };
export { usePdf };
export {
  canvasVisualScale,
  isSelectionInsideEditorNodeType,
  pageCanvasY,
  preferredSelectableFonts,
  renderPageContainsSourcePath,
  scrollEditorCanvasToPage,
  selectedRenderPageIndex,
} from "./shell-utils.ts";
export {
  defaultEditorExtensions,
  toggleBold,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleStrike,
  toggleSubscript,
  toggleSuperscript,
  toggleUnderline,
} from "../src/font-attributes.ts";
export { applyEditorControllerAction } from "../src/controller.ts";
export { createEditorTextStyleForFont, type EditorFontStyleOptions } from "../src/font.ts";
export { isToolbarMarkActive, paintEditorCaret, paintEditorSelection } from "../src/interaction.ts";
export { moveSelectionHorizontallyByKeyboard } from "../src/keyboard.ts";
export {
  createEditorLayoutTree,
  editorHeadingTextStyleAttrs,
  pageBreakSpacerHeightForRemainingPage,
} from "../src/layout-tree.ts";
export { createSelection, isSelectionExpanded } from "../src/actions.ts";
export {
  insertTextWithMarks,
  setCurrentTextBlockType,
  splitParagraph,
  toggleCurrentBlockquote,
} from "../src/transforms.ts";
export type { EditorMarkSpec } from "../src/font-attributes.ts";
export type { EditorSelection, EditorSelectionPoint, JSONContent } from "../src/model.ts";
export type {
  SkrivaEditorConfig,
  SkrivaEditorProps,
  SkrivaEditorSurfaceDropContext,
  SkrivaEditorSurfaceDropHandler,
  UseEditorFontsReturn,
  UseSkrivaOptions,
  UseSkrivaReturn,
  UseSkrivaEditorReturn,
  UseEditorPdfReturn,
  UsePdfOptions,
  UsePdfReturn,
  SkrivaCanvasEditorProps,
};
export type { EditorKeymap, EditorKeymapHandler, EditorKeymapOptions } from "./keymap.ts";
export type { UseEditorFontsOptions } from "./use-editor-fonts.ts";
export type { UseEditorPdfOptions } from "./use-editor-pdf.ts";
