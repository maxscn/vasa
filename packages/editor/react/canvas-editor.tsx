import { Edit3 } from "lucide-react";
import type { ReactNode } from "react";
import type { UseSkrivaEditorReturn } from "./use-editor.ts";
import { useOptionalSkrivaEditorShell } from "./editor-shell-context.tsx";

export type SkrivaCanvasEditorProps = {
  editor?: UseSkrivaEditorReturn;
  label?: string;
  rail?: ReactNode;
};

export function SkrivaCanvasEditor({
  editor: editorProp,
  label = "Editor",
  rail,
}: SkrivaCanvasEditorProps) {
  const shell = useOptionalSkrivaEditorShell();
  const editor = editorProp ?? shell?.editor;
  if (editor === undefined) {
    throw new Error("SkrivaCanvasEditor requires an editor prop or SkrivaEditorShellProvider.");
  }
  const activeFont = editor.fonts.find((font) => font.id === editor.selectedFontId);

  return (
    <section className="editor-panel" aria-label="Canvas editor">
      {rail}
      <div className="editor-stage">
        <span className="panel-label">
          <Edit3 size={17} aria-hidden="true" />
          {label}
        </span>
        <div
          className="canvas-frame editor-canvas-frame"
          onDragOver={editor.handleSurfaceDragOver}
          onDrop={editor.handleSurfaceDrop}
        >
          <canvas
            ref={editor.canvasRef}
            data-active-font-family={activeFont?.family}
            data-active-font-id={activeFont?.id}
            data-canvas-text-mode={editor.canvasTextMode}
            data-outline-font-ready={editor.hasActiveOutlineFont ? "true" : "false"}
            data-font-ready={editor.isFontReady ? "true" : "false"}
            onPointerDown={editor.handleCanvasPointerDown}
            onPointerMove={editor.handleCanvasPointerMove}
            onPointerUp={editor.handleCanvasPointerUp}
            onPointerCancel={editor.handleCanvasPointerUp}
            role="textbox"
            aria-label="Document body"
            aria-multiline="true"
            tabIndex={0}
            onFocus={editor.focusKeyboardBridge}
          />
        </div>
      </div>
      <textarea
        ref={editor.inputRef}
        className="keyboard-bridge"
        defaultValue=""
        onBeforeInput={editor.handleBeforeInput}
        onInput={editor.handleInput}
        onCopy={editor.handleCopy}
        onCut={editor.handleCut}
        onPaste={editor.handlePaste}
        onKeyDown={editor.handleKeyDown}
        onFocus={editor.handleKeyboardBridgeFocus}
        onBlur={editor.handleKeyboardBridgeBlur}
        spellCheck
        aria-hidden="true"
      />
    </section>
  );
}
