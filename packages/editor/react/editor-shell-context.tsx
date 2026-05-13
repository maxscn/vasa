import { createContext, useContext, type ReactNode } from "react";
import type { UseEditorPdfReturn } from "./use-editor-pdf.ts";
import type { UseSkrivaEditorReturn } from "./use-editor.ts";

export type SkrivaEditorShellContextValue = {
  editor: UseSkrivaEditorReturn;
  pdf?: UseEditorPdfReturn;
};

const SkrivaEditorShellContext = createContext<SkrivaEditorShellContextValue | undefined>(
  undefined,
);

export function SkrivaEditorShellProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SkrivaEditorShellContextValue;
}) {
  return (
    <SkrivaEditorShellContext.Provider value={value}>{children}</SkrivaEditorShellContext.Provider>
  );
}

export function useSkrivaEditorShell() {
  const value = useOptionalSkrivaEditorShell();
  if (value === undefined) {
    throw new Error(
      "Skriva editor shell components must be rendered inside SkrivaEditorShellProvider.",
    );
  }
  return value;
}

export function useOptionalSkrivaEditorShell() {
  return useContext(SkrivaEditorShellContext);
}
