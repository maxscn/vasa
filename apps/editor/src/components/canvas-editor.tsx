import { Edit3 } from "lucide-react";
import { readSvgFileAsNode, svgFilesFromDataTransfer } from "@vasa/extension-svg";
import type { DragEvent } from "react";
import { useEditorShell } from "./editor-shell-context";
import { PagesRail } from "./pages-rail";

export function CanvasEditor() {
  const { editor, addDroppedSvgNodes, showPagesRail } = useEditorShell();
  const activeFont = editor.fonts.find((font) => font.id === editor.selectedFontId);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (svgFilesFromDataTransfer(event.dataTransfer).length === 0) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    const files = svgFilesFromDataTransfer(event.dataTransfer);
    if (files.length === 0) return;
    event.preventDefault();
    const nodes = await Promise.all(files.map((file) => readSvgFileAsNode(file)));
    addDroppedSvgNodes(nodes);
    editor.focusKeyboardBridge();
  }

  return (
    <section className="editor-panel" aria-label="Canvas editor">
      {showPagesRail ? <PagesRail /> : null}
      <div className="editor-stage">
        <span className="panel-label">
          <Edit3 size={17} aria-hidden="true" />
          Editor
        </span>
        <div
          className="canvas-frame editor-canvas-frame"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
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
