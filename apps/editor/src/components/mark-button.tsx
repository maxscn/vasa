import type { ReactNode } from "react";
import { isToolbarMarkActive } from "@openinspection/skriva/editor/react";
import { useEditorShell } from "./editor-shell-context";

export function MarkButton({
  children,
  className = "toggle-action",
  label,
  mark,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  mark: string;
  onClick: () => void;
}) {
  const { editor } = useEditorShell();

  return (
    <button
      className={className}
      type="button"
      aria-label={label}
      aria-pressed={
        !editor.disabledMarks.includes(mark) &&
        isToolbarMarkActive(editor.editorDocument, editor.selection, editor.storedMarks, mark)
      }
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
