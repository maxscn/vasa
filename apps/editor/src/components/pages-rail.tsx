import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  scrollEditorCanvasToPage,
  selectedRenderPageIndex,
} from "@openinspection/skriva/editor/react";
import { useEditorShell } from "./editor-shell-context";
import { PageThumb } from "./page-thumb";

export function PagesRail() {
  const { editor } = useEditorShell();
  const shouldScrollToInsertedPageRef = useRef(false);
  const activePageIndexRef = useRef<number | undefined>(undefined);
  const pages =
    editor.renderDocument.pages.length === 0 ? [{ index: 0 }] : editor.renderDocument.pages;
  const activePageIndex = selectedRenderPageIndex(editor.renderDocument, editor.selection.path);

  useEffect(() => {
    const previousActivePageIndex = activePageIndexRef.current;
    activePageIndexRef.current = activePageIndex;

    const shouldScroll =
      shouldScrollToInsertedPageRef.current ||
      (previousActivePageIndex !== undefined && previousActivePageIndex !== activePageIndex);

    shouldScrollToInsertedPageRef.current = false;
    if (shouldScroll) scrollEditorCanvasToPage(editor, activePageIndex, "smooth");
  }, [activePageIndex, editor]);

  function insertPageBreakAndMoveToPage() {
    shouldScrollToInsertedPageRef.current = true;
    editor.insertPageBreak();
  }

  return (
    <aside className="pages-rail" aria-label="Pages">
      <div className="pages-heading">
        <span>Pages</span>
        <button type="button" onClick={insertPageBreakAndMoveToPage} aria-label="Insert new page">
          +
        </button>
      </div>
      {pages.map((page, index) => (
        <PageThumb
          key={page.index}
          active={page.index === activePageIndex}
          dark={page.index !== activePageIndex}
          index={page.index}
          ordinal={index}
          page={String(index + 1)}
        />
      ))}
      <ChevronDown className="pages-more" size={18} aria-hidden="true" />
    </aside>
  );
}
