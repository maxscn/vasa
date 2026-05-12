import { createContext, useContext, type ReactNode } from "react";
import type { SvgNode } from "@vasa/extension-svg";
import type { UseEditorPdfReturn, UseEditorReturn } from "@vasa/editor";
import type { MarginPresetId, PagePresetId } from "./presets";

export type EditorShellContextValue = {
  editor: UseEditorReturn;
  pdf: UseEditorPdfReturn;
  addDroppedSvgNodes: (nodes: SvgNode[]) => void;
  marginPreset: MarginPresetId;
  pagePreset: PagePresetId;
  setMarginPreset: (preset: MarginPresetId) => void;
  setPagePreset: (preset: PagePresetId) => void;
  setShowMarginOutlines: (show: boolean) => void;
  showMarginOutlines: boolean;
  showPagesRail: boolean;
};

const EditorShellContext = createContext<EditorShellContextValue | undefined>(undefined);

export function EditorShellProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: EditorShellContextValue;
}) {
  return <EditorShellContext.Provider value={value}>{children}</EditorShellContext.Provider>;
}

export function useEditorShell() {
  const value = useContext(EditorShellContext);
  if (value === undefined) {
    throw new Error("Editor shell components must be rendered inside EditorShell.");
  }
  return value;
}
