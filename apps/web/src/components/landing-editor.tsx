import {
  buildCanvasScene,
  createCanvasRenderer,
  type CanvasRendererExtension,
  type CanvasSurface,
} from "@vasa/canvas";
import { collectExtensionRenderers, collectLayoutExtensions } from "@vasa/core";
import {
  applyEditorControllerAction,
  createSelection,
  createEditorCanvasTextPaint,
  createEditorLayoutTree,
  createEditorPdfOutlineText,
  createEditorRenderResolveTextStyle,
  createEditorRenderTextStyle,
  createEditorExtensionKeymap,
  defaultEditorExtensions,
  editorKeyForEvent,
  insertTextWithMarks,
  isSelectionExpanded,
  moveSelectionHorizontallyByKeyboard,
  setCurrentTextBlockType,
  splitParagraph,
  toggleBold,
  toggleCurrentBlockquote,
  type EditorKeymapOptions,
  type EditorJson,
  type EditorMarkSpec,
  type EditorSelection,
  type EditorSelectionPoint,
} from "@vasa/editor";
import { createCanvasFontValue, createStandardFontMetrics, type VasaFont } from "@vasa/font";
import { layoutDocument, type Rect, type TextMeasurer } from "@vasa/layout";
import { renderDocumentToPdf } from "@vasa/pdf";
import { createRenderDocument, type RenderDocument } from "@vasa/renderer";
import {
  ChevronDown,
  Columns2,
  Download,
  Image,
  Moon,
  MousePointer2,
  PanelTop,
  Plus,
  Rows3,
  Search,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import { Button } from "#/components/ui/button";

const page = {
  width: 612,
  height: 792,
  margin: { top: 162, right: 86, bottom: 64, left: 86 },
};

const pageGap = 34;
const previewScale = 1;
const fontSize = 16;
const lineHeight = 19;
const textCharWidth = 8;
const documentExtensions: never[] = [];

const fallbackFont: VasaFont = {
  id: "arimo",
  family: "Arimo",
  displayName: "Arimo",
  weight: "400",
  style: "normal",
  fallbackFamilies: ["Arial", "sans-serif"],
  cssFamily: "Arimo, Arial, sans-serif",
  data: { kind: "native", metrics: createStandardFontMetrics({ family: "Arimo" }) },
};

const initialText = `vasa.sh

A canvas based text editor
with a 1 to 1 mapping to PDF.

What you see is exactly what you get.
Every pixel on the canvas maps to the PDF.
No surprises. No reflow. Just clarity.`;

export function LandingEditor() {
  const [editorDocument, setEditorDocument] = useState<EditorJson>(() =>
    textToEditorDocument(initialText),
  );
  const [selection, setSelection] = useState<EditorSelection>({ path: [1, 0], offset: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef(selection);
  const pendingMarksRef = useRef<EditorMarkSpec[]>([]);
  const extensionKeymap = useMemo(() => createEditorExtensionKeymap(defaultEditorExtensions), []);

  const editorCanvasFont = useMemo(() => createCanvasFontValue(fallbackFont, { fontSize }), []);
  const measureText = useMemo(() => {
    const canvas = typeof document === "undefined" ? undefined : document.createElement("canvas");
    const context = canvas?.getContext("2d");

    return (text: string, font?: string) => {
      if (context === null || context === undefined) return text.length * textCharWidth;
      context.font = font ?? editorCanvasFont;
      return context.measureText(text).width;
    };
  }, [editorCanvasFont]);
  const textMeasurer = useMemo(() => createCanvasTextMeasurer(measureText), [measureText]);
  const renderProfile = useMemo(
    () => ({
      fonts: [fallbackFont],
      defaultFontId: fallbackFont.id,
      fallbackFont,
      fontSize,
      lineHeight,
      textColor: "#101010",
      whiteSpace: "pre-wrap" as const,
      wordBreak: "normal" as const,
    }),
    [],
  );
  const editorTextStyle = useMemo(
    () => createEditorRenderTextStyle(renderProfile),
    [renderProfile],
  );
  const resolveTextStyle = useMemo(
    () => createEditorRenderResolveTextStyle(renderProfile),
    [renderProfile],
  );
  const layoutTree = useMemo(
    () =>
      createEditorLayoutTree(editorDocument, {
        rootStyle: { gap: 15 },
        paragraphStyle: { flexDirection: "column" },
        textStyle: editorTextStyle,
        resolveTextStyle,
      }),
    [editorDocument, editorTextStyle, resolveTextStyle],
  );
  const layout = useMemo(
    () =>
      layoutDocument(layoutTree, {
        page,
        measurer: textMeasurer,
        extensions: collectLayoutExtensions(documentExtensions),
      }),
    [layoutTree, textMeasurer],
  );
  const renderDocument = useMemo(() => createRenderDocument(layout), [layout]);
  const canvasRenderers = useMemo(
    () => collectExtensionRenderers(documentExtensions, "canvas") as CanvasRendererExtension[],
    [],
  );
  const canvasScene = useMemo(
    () => buildCanvasScene(renderDocument, { pageGap, extensions: canvasRenderers }),
    [canvasRenderers, renderDocument],
  );
  const pdfResult = useMemo(
    () =>
      renderDocumentToPdf(layoutTree, {
        page,
        measurer: textMeasurer,
        extensions: collectLayoutExtensions(documentExtensions),
        metadata: { title: "vasa.sh landing document", author: "vasa.sh" },
        defaultTextFill: renderProfile.textColor,
        outlineText: (node, lineIndex) =>
          createEditorPdfOutlineText(editorDocument, renderProfile, node, lineIndex),
        textMode: "embedded",
      }),
    [editorDocument, layoutTree, renderProfile, textMeasurer],
  );

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas === null || canvas === undefined || context === null || context === undefined) {
      return;
    }

    const width = Math.max(page.width, ...canvasScene.pages.map((item) => item.rect.width));
    const height = Math.max(
      page.height,
      ...canvasScene.pages.map((item) => item.rect.y + item.rect.height),
    );
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.style.width = `${width * previewScale}px`;
    canvas.style.height = `${height * previewScale}px`;

    context.setTransform(scale, 0, 0, scale, 0, 0);
    createCanvasRenderer(domCanvasSurface(context, editorCanvasFont), {
      pageGap,
      extensions: canvasRenderers,
      text: (box, lineIndex) =>
        createEditorCanvasTextPaint(editorDocument, renderProfile, box, lineIndex),
    }).render(renderDocument);
    drawCaret(context, scale, renderDocument, selection, measureText);
  }, [
    canvasRenderers,
    canvasScene,
    editorCanvasFont,
    editorDocument,
    renderDocument,
    renderProfile,
    measureText,
    selection,
  ]);

  function focusKeyboardBridge() {
    inputRef.current?.focus({ preventScroll: true });
  }

  function applyEditorMutation(
    mutate: (
      doc: EditorJson,
      currentSelection: EditorSelection,
    ) => {
      doc: EditorJson;
      selection: EditorSelection;
    },
  ) {
    const currentSelection = selectionRef.current;
    setEditorDocument((currentDocument) => {
      const next = mutate(currentDocument, currentSelection);
      selectionRef.current = next.selection;
      setSelection(next.selection);
      return next.doc;
    });
  }

  function handleKeyboardInput(event: FormEvent<HTMLTextAreaElement>) {
    const value = event.currentTarget.value;
    if (value.length === 0) return;

    applyEditorMutation((doc, currentSelection) => {
      if (pendingMarksRef.current.length > 0 && !isSelectionExpanded(currentSelection)) {
        return insertTextWithMarks(doc, currentSelection, value, pendingMarksRef.current);
      }

      return applyEditorControllerAction(
        { doc, selection: currentSelection },
        { type: "insertText", text: value },
      ).state;
    });
    event.currentTarget.value = "";
  }

  function handleKeyboardDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (applyExtensionShortcut(event)) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      applyEditorMutation(
        (doc, currentSelection) =>
          applyEditorControllerAction({ doc, selection: currentSelection }, { type: "backspace" })
            .state,
      );
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      applyEditorMutation(
        (doc, currentSelection) =>
          applyEditorControllerAction({ doc, selection: currentSelection }, { type: "delete" })
            .state,
      );
      return;
    }

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      applyEditorMutation((doc, currentSelection) => {
        if (pendingMarksRef.current.length > 0 && !isSelectionExpanded(currentSelection)) {
          return insertTextWithMarks(doc, currentSelection, "\n", pendingMarksRef.current);
        }

        return applyEditorControllerAction(
          { doc, selection: currentSelection },
          { type: "insertText", text: "\n" },
        ).state;
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      applyEditorMutation(splitParagraph);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      updateSelection(
        moveSelectionHorizontallyByKeyboard(
          editorDocument,
          renderDocument,
          selectionRef.current,
          event,
          {
            direction: event.key === "ArrowLeft" ? "left" : "right",
            renderLines: { pageHeight: page.height, pageGap },
          },
        ),
      );
    }
  }

  function applyExtensionShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    const shortcut = extensionKeymap[editorKeyForEvent(event)];
    if (shortcut === undefined) return false;

    return shortcut(event, {
      editorDocument,
      renderDocument,
      renderLineOptions: { pageHeight: page.height, pageGap },
      measureText,
      updateEditor: () => {},
      updateSelection: (nextSelection) =>
        updateSelection(
          typeof nextSelection === "function" ? nextSelection(selectionRef.current) : nextSelection,
        ),
      suppressBeforeInput: () => {},
      undo: () => {},
      redo: () => {},
      toggleBold: () => toggleExtensionMark("bold", toggleBold),
      toggleMark: toggleExtensionMark,
      toggleBlockquote: () =>
        applyEditorMutation((doc, currentSelection) =>
          toggleCurrentBlockquote(doc, currentSelection),
        ),
      setBlockType: (type, attrs = {}) =>
        applyEditorMutation((doc, currentSelection) =>
          setCurrentTextBlockType(doc, currentSelection, type, attrs),
        ),
      insertLineBreak: () => {},
      splitParagraph: () => applyEditorMutation(splitParagraph),
    } satisfies EditorKeymapOptions);
  }

  function toggleExtensionMark(
    type: string,
    mutate: (
      doc: EditorJson,
      currentSelection: EditorSelection,
    ) => {
      doc: EditorJson;
      selection: EditorSelection;
    },
    attrs: Record<string, unknown> = {},
  ) {
    if (isSelectionExpanded(selectionRef.current)) {
      applyEditorMutation((doc, currentSelection) => mutate(doc, currentSelection));
      pendingMarksRef.current = pendingMarksRef.current.filter((mark) => mark.type !== type);
      return;
    }

    pendingMarksRef.current = togglePendingMark(pendingMarksRef.current, { type, attrs });
  }

  function updateSelection(nextSelection: EditorSelection) {
    selectionRef.current = nextSelection;
    if (inputRef.current !== null) inputRef.current.value = "";
    setSelection(nextSelection);
  }

  function resetDocument() {
    const nextDocument = textToEditorDocument(initialText);
    setEditorDocument(nextDocument);
    updateSelection({ path: [1, 0], offset: 0 });
    focusKeyboardBridge();
  }

  function clearDocument() {
    const nextDocument = textToEditorDocument("");
    setEditorDocument(nextDocument);
    updateSelection({ path: [0, 0], offset: 0 });
    focusKeyboardBridge();
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    event.preventDefault();
    focusKeyboardBridge();
    const point = hitTestCanvas(canvas, event.clientX, event.clientY, renderDocument, measureText);
    if (point !== undefined) updateSelection(createSelection(point, undefined));
  }

  async function downloadPdf() {
    const bytes = await pdfResult.compressedBytes();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vasa-document.pdf";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="real-editor-hero" aria-label="Interactive vasa editor">
      <div className="real-editor-toolbar">
        <a className="real-editor-brand" href="/" aria-label="vasa.sh home">
          <span className="real-editor-mark">/\</span>
          <span>vasa.sh</span>
        </a>
        <div className="real-editor-tools" aria-label="Editor tools">
          <Button
            className="tool-button"
            data-active="true"
            size="icon"
            type="button"
            variant="toolbar"
          >
            <MousePointer2 />
          </Button>
          <Button className="tool-button" size="icon" type="button" variant="toolbar">
            <Type />
          </Button>
          <Button className="tool-button" size="icon" type="button" variant="toolbar">
            <PanelTop />
          </Button>
          <Button className="tool-button" size="icon" type="button" variant="toolbar">
            <Columns2 />
          </Button>
          <Button className="tool-button" size="icon" type="button" variant="toolbar">
            <SlidersHorizontal />
          </Button>
          <Button className="tool-button" size="icon" type="button" variant="toolbar">
            <Rows3 />
          </Button>
          <Button className="tool-button" size="icon" type="button" variant="toolbar">
            <Image />
          </Button>
        </div>
        <Button className="zoom-button" size="sm" type="button" variant="ghost">
          100%
          <ChevronDown size={12} />
        </Button>
        <Button
          className="tool-button toolbar-end-icon"
          size="icon"
          type="button"
          variant="toolbar"
        >
          <Search />
        </Button>
        <Button className="tool-button" size="icon" type="button" variant="toolbar">
          <Moon />
        </Button>
        <Button
          className="ghost-action"
          onClick={resetDocument}
          size="sm"
          type="button"
          variant="ghost"
        >
          Reset
        </Button>
        <Button
          className="download-button"
          onClick={downloadPdf}
          size="sm"
          type="button"
          variant="outline"
        >
          <Download size={15} />
          PDF
        </Button>
      </div>

      <div className="real-editor-workspace">
        <aside className="real-editor-pages">
          <div className="panel-heading">
            <span>Pages</span>
            <Plus size={17} />
          </div>
          <PageThumb active page="1" />
          <PageThumb page="2" dark />
          <PageThumb page="3" dark />
          <PageThumb page="4" dark />
          <ChevronDown className="pages-more" size={18} />
        </aside>

        <div className="real-editor-canvas-wrap">
          <canvas
            ref={canvasRef}
            aria-label="Rendered editor canvas"
            className="real-editor-canvas"
            onPointerDown={handleCanvasPointerDown}
            role="textbox"
            tabIndex={0}
            onFocus={focusKeyboardBridge}
          />
          <textarea
            ref={inputRef}
            aria-hidden="true"
            className="keyboard-bridge"
            defaultValue=""
            onInput={handleKeyboardInput}
            onKeyDown={handleKeyboardDown}
          />
          <div className="next-page-peek">
            <span>2</span>
          </div>
        </div>

        <aside className="real-editor-inspector">
          <div className="inspector-section first">
            <h2>Page</h2>
            <div className="field-label">Size</div>
            <Button className="select-field" type="button" variant="outline">
              A4
              <ChevronDown size={14} />
            </Button>
            <p className="muted">210 x 297 mm</p>

            <div className="field-label">Margins</div>
            <Button className="select-field" type="button" variant="outline">
              Normal (25mm)
              <ChevronDown size={14} />
            </Button>

            <div className="field-label">Document</div>
            <div className="inspector-actions">
              <Button onClick={clearDocument} size="sm" type="button" variant="outline">
                Clear
              </Button>
              <Button onClick={downloadPdf} size="sm" type="button" variant="outline">
                Export PDF
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function togglePendingMark(marks: EditorMarkSpec[], mark: EditorMarkSpec) {
  const isActive = marks.some((candidate) => candidate.type === mark.type);
  const next = marks.filter(
    (candidate) =>
      candidate.type !== mark.type && !excludedPendingMarks(mark.type).has(candidate.type),
  );

  return isActive ? next : [...next, mark];
}

function excludedPendingMarks(type: string) {
  if (type === "subscript") return new Set(["superscript"]);
  if (type === "superscript") return new Set(["subscript"]);
  return new Set<string>();
}

function PageThumb({
  active = false,
  dark = false,
  page,
}: {
  active?: boolean;
  dark?: boolean;
  page: string;
}) {
  return (
    <button className={active ? "page-thumb is-active" : "page-thumb"} type="button">
      <div className={dark ? "thumb-sheet is-dark" : "thumb-sheet"} />
      <span>{page}</span>
    </button>
  );
}

function domCanvasSurface(context: CanvasRenderingContext2D, defaultFont: string): CanvasSurface {
  return {
    clearRect: (x, y, width, height) => context.clearRect(x, y, width, height),
    fillRect: (x, y, width, height) => context.fillRect(x, y, width, height),
    strokeRect: (x, y, width, height) => context.strokeRect(x, y, width, height),
    fillText: (text, x, y) => context.fillText(text, x, y),
    beginPath: () => context.beginPath(),
    moveTo: (x, y) => context.moveTo(x, y),
    lineTo: (x, y) => context.lineTo(x, y),
    bezierCurveTo: (x1, y1, x2, y2, x, y) => context.bezierCurveTo(x1, y1, x2, y2, x, y),
    closePath: () => context.closePath(),
    fill: () => context.fill(),
    stroke: () => context.stroke(),
    set fillStyle(value: string | undefined) {
      context.fillStyle = value ?? "#000000";
    },
    set strokeStyle(value: string | undefined) {
      context.strokeStyle = value ?? "#000000";
    },
    get lineWidth() {
      return context.lineWidth;
    },
    set lineWidth(value) {
      context.lineWidth = value ?? 1;
    },
    get font() {
      return context.font;
    },
    set font(value) {
      context.font = value ?? defaultFont;
    },
    get textBaseline() {
      return context.textBaseline;
    },
    set textBaseline(value) {
      context.textBaseline = value ?? "top";
    },
  };
}

function textToEditorDocument(value: string): EditorJson {
  return {
    type: "doc",
    content: value.split(/\n{2,}/g).map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    })),
  };
}

function drawCaret(
  context: CanvasRenderingContext2D,
  scale: number,
  document: RenderDocument,
  selection: EditorSelection,
  measureText: (text: string, font?: string) => number,
) {
  const caret = findCaretRect(document, selection, measureText);
  if (caret === undefined) return;

  context.save();
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = "#2563eb";
  context.fillRect(caret.x, caret.y, 2, caret.height);
  context.restore();
}

function hitTestCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  document: RenderDocument,
  measureText: (text: string, font?: string) => number,
): EditorSelectionPoint | undefined {
  const canvasRect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const scaleX = canvas.width / pixelRatio / canvasRect.width;
  const scaleY = canvas.height / pixelRatio / canvasRect.height;
  const point = {
    x: (clientX - canvasRect.left) * scaleX,
    y: (clientY - canvasRect.top) * scaleY,
  };
  const lines = renderTextLines(document);
  if (lines.length === 0) return undefined;

  const nearestLine = lines.reduce((nearest, line) => {
    const currentDistance = distanceToRect(point.x, point.y, line.rect);
    const nearestDistance = distanceToRect(point.x, point.y, nearest.rect);
    return currentDistance < nearestDistance ? line : nearest;
  });

  return pointInRenderLine(nearestLine, point.x, measureText);
}

function findCaretRect(
  document: RenderDocument,
  selection: EditorSelection,
  measureText: (text: string, font?: string) => number,
): Rect | undefined {
  const sourceId = pathToSourceId(selection.path);
  const textLines = renderTextLines(document).filter((line) => line.sourceId === sourceId);
  if (textLines.length === 0) return undefined;

  const text = textLines[0]?.sourceText ?? "";
  const targetOffset = Math.max(0, Math.min(selection.offset, text.length));
  const line =
    textLines.find(
      (candidate) =>
        targetOffset >= candidate.start && targetOffset <= candidate.start + candidate.text.length,
    ) ?? textLines.at(-1);
  if (line === undefined) return undefined;

  return {
    x: xForLineOffset(line, targetOffset, measureText),
    y: line.rect.y,
    width: 2,
    height: line.rect.height,
  };
}

function renderTextLines(document: RenderDocument) {
  return document.pages.flatMap((pageItem) =>
    pageItem.nodes.flatMap((node) => collectRenderTextLines(node, pageItem.index)),
  );
}

function collectRenderTextLines(
  node: RenderDocument["pages"][number]["nodes"][number],
  pageIndex: number,
): Array<{
  sourceId: string;
  sourceText: string;
  text: string;
  start: number;
  font?: string;
  rect: Rect;
}> {
  if (node.kind !== "text") {
    return node.children.flatMap((child) => collectRenderTextLines(child, pageIndex));
  }

  const starts = node.lines.some((line) => line.start !== undefined)
    ? node.lines.map((line) => line.start ?? 0)
    : lineStartOffsets(
        node.text,
        node.lines.map((line) => line.text),
      );
  const yOffset = pageIndex * (page.height + pageGap);

  return node.lines.map((line, index) => ({
    sourceId: line.sourceId ?? node.sourceId ?? "",
    sourceText: line.sourceText ?? node.text,
    text: line.text,
    start: starts[index] ?? 0,
    font: line.font,
    rect: {
      x: line.x,
      y: line.y + yOffset,
      width: Math.max(line.width, textCharWidth),
      height: line.height,
    },
  }));
}

function lineStartOffsets(text: string, lines: string[]) {
  let cursor = 0;

  return lines.map((line) => {
    const found = line.length === 0 ? cursor : text.indexOf(line, cursor);
    const start = found >= cursor ? found : cursor;
    cursor = found >= cursor ? found + line.length : cursor + line.length;
    if (text[cursor] === "\n" || text[cursor] === " ") cursor += 1;
    return start;
  });
}

function pointInRenderLine(
  line: ReturnType<typeof renderTextLines>[number],
  x: number,
  measureText: (text: string, font?: string) => number,
): EditorSelectionPoint {
  return {
    path: sourceIdToPath(line.sourceId),
    offset: offsetForLineX(line, x, measureText) + line.start,
  };
}

function offsetForLineX(
  line: ReturnType<typeof renderTextLines>[number],
  x: number,
  measureText: (text: string, font?: string) => number,
) {
  const targetX = Math.max(0, x - line.rect.x);

  for (let offset = 0; offset < line.text.length; offset += 1) {
    const currentX = measureText(line.text.slice(0, offset), line.font);
    const nextX = measureText(line.text.slice(0, offset + 1), line.font);
    if (targetX <= (currentX + nextX) / 2) return offset;
  }

  return line.text.length;
}

function xForLineOffset(
  line: ReturnType<typeof renderTextLines>[number],
  absoluteOffset: number,
  measureText: (text: string, font?: string) => number,
) {
  const offsetInLine = Math.max(0, Math.min(absoluteOffset - line.start, line.text.length));
  return line.rect.x + measureText(line.text.slice(0, offsetInLine), line.font);
}

function distanceToRect(x: number, y: number, rect: Rect) {
  const dx = x < rect.x ? rect.x - x : Math.max(0, x - (rect.x + rect.width));
  const dy = y < rect.y ? rect.y - y : Math.max(0, y - (rect.y + rect.height));
  return dx * dx + dy * dy;
}

function pathToSourceId(path: number[]) {
  return path.join(".");
}

function sourceIdToPath(sourceId: string | undefined) {
  if (sourceId === undefined || sourceId.length === 0) return [0, 0];
  return sourceId.split(".").map((part) => Number.parseInt(part, 10));
}

function createCanvasTextMeasurer(
  measureText: (text: string, font?: string) => number,
): TextMeasurer {
  return {
    measureText(input) {
      const maxWidth = Math.max(1, input.maxWidth);
      const rawLines =
        input.whiteSpace === "pre-wrap"
          ? input.text.split("\n")
          : [input.text.replaceAll(/\s+/g, " ").trim()];
      const lines = rawLines.flatMap((line) =>
        wrapMeasuredLine(measureText, line, maxWidth, input.font),
      );

      return {
        width: lines.reduce((max, line) => Math.max(max, measureText(line, input.font)), 0),
        height: lines.length * input.lineHeight,
        lineCount: lines.length,
        lines: lines.map((line) => ({ text: line, width: measureText(line, input.font) })),
      };
    },
  };
}

function wrapMeasuredLine(
  measureText: (text: string, font?: string) => number,
  line: string,
  maxWidth: number,
  font?: string,
) {
  if (line.length === 0) return [""];

  const words = line.split(/(\s+)/g).filter((word) => word.length > 0);
  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = `${current}${word}`;
    if (current.length === 0 || measureText(candidate, font) <= maxWidth) {
      current = candidate;
    } else {
      wrapped.push(current.trimEnd());
      current = word.trimStart();
    }
  }

  if (current.length > 0) wrapped.push(current.trimEnd());
  return wrapped;
}
