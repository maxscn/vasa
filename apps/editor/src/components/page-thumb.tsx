import { useEffect, useRef } from "react";
import { pageCanvasY, scrollEditorCanvasToPage } from "@openinspection/skriva/editor/react";
import { useEditorShell } from "./editor-shell-context";

export function PageThumb({
  active = false,
  dark = false,
  index,
  ordinal,
  page,
}: {
  active?: boolean;
  dark?: boolean;
  index: number;
  ordinal: number;
  page: string;
}) {
  const { editor } = useEditorShell();
  const thumbnailRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const sourceCanvas = editor.canvasRef.current;
    const thumbnail = thumbnailRef.current;
    const renderedPage = editor.renderDocument.pages.find((candidate) => candidate.index === index);
    if (sourceCanvas === null || thumbnail === null || renderedPage === undefined) {
      return;
    }

    const context = thumbnail.getContext("2d");
    if (context === null) {
      return;
    }

    const sourceScale = sourceCanvas.width / Number.parseFloat(sourceCanvas.style.width);
    const sourceY = pageCanvasY(renderedPage, ordinal, editor.renderLineOptions.pageGap ?? 0);
    const targetWidth = 112;
    const targetHeight = Math.round(
      (renderedPage.rect.height / renderedPage.rect.width) * targetWidth,
    );
    thumbnail.width = targetWidth * 2;
    thumbnail.height = targetHeight * 2;
    thumbnail.style.width = `${targetWidth}px`;
    thumbnail.style.height = `${targetHeight}px`;
    context.fillStyle = "#fffdfa";
    context.fillRect(0, 0, thumbnail.width, thumbnail.height);
    context.drawImage(
      sourceCanvas,
      renderedPage.rect.x * sourceScale,
      sourceY * sourceScale,
      renderedPage.rect.width * sourceScale,
      renderedPage.rect.height * sourceScale,
      0,
      0,
      thumbnail.width,
      thumbnail.height,
    );
  }, [editor.canvasRef, editor.renderDocument, editor.renderLineOptions.pageGap, index, ordinal]);

  function scrollToPage() {
    scrollEditorCanvasToPage(editor, index, "smooth");
  }

  return (
    <button
      className={active ? "page-thumb is-active" : "page-thumb"}
      type="button"
      onClick={scrollToPage}
    >
      <canvas
        ref={thumbnailRef}
        className={dark ? "thumb-sheet is-dark" : "thumb-sheet"}
        aria-hidden="true"
      />
      <span>{page}</span>
    </button>
  );
}
