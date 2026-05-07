import {
  Baseline,
  ChevronDown,
  Code2,
  Columns3,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Heading1,
  Highlighter,
  Minus,
  Quote,
  Rows3,
  Table2,
  Type,
} from "lucide-react";
import type { ResolvedBoxEdges } from "@vasa/layout";
import {
  isToolbarMarkActive,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleStrike,
  toggleSubscript,
  toggleSuperscript,
  toggleUnderline,
  useEditor,
  useEditorPdf,
  type UseEditorPdfReturn,
  type UseEditorReturn,
} from "@vasa/editor";
import { createSvgNode, type SvgNode, type SvgPathSpec } from "@vasa/extension-svg";
import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { editorConfig } from "./editor-demo";

export type EditorShellProps = {
  bundledFontUrl: string;
  fallbackFontUrl?: string;
  pdfWorkerUrl: string;
  showPdfPreview?: boolean;
  showInspector?: boolean;
  showPagesRail?: boolean;
};

type EditorShellContextValue = {
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

const pagePresets = {
  a4: { label: "A4", width: 695, height: 842, note: "210 x 297 mm" },
  letter: { label: "Letter", width: 712, height: 792, note: "8.5 x 11 in" },
  legal: { label: "Legal", width: 712, height: 1008, note: "8.5 x 14 in" },
} as const;

type PagePresetId = keyof typeof pagePresets;

const marginPresets = {
  compact: { label: "Compact", value: 36 },
  normal: { label: "Normal", value: 56 },
  wide: { label: "Wide", value: 72 },
} as const;

type MarginPresetId = keyof typeof marginPresets;

export function EditorShell({
  bundledFontUrl,
  fallbackFontUrl,
  pdfWorkerUrl,
  showInspector = false,
  showPagesRail = false,
  showPdfPreview = true,
}: EditorShellProps) {
  const [droppedSvgNodes, setDroppedSvgNodes] = useState<SvgNode[]>([]);
  const [marginPreset, setMarginPresetState] = useState<MarginPresetId>("normal");
  const [pagePreset, setPagePreset] = useState<PagePresetId>("a4");
  const [showMarginOutlines, setShowMarginOutlines] = useState(true);
  const [pageMargin, setPageMargin] = useState<ResolvedBoxEdges>(() => ({
    top: editorConfig.page.margin.top,
    right: editorConfig.page.margin.right,
    bottom: editorConfig.page.margin.bottom,
    left: editorConfig.page.margin.left,
  }));
  const config = useMemo(
    () => ({
      ...editorConfig,
      page: {
        width: pagePresets[pagePreset].width,
        height: pagePresets[pagePreset].height,
        margin: pageMargin,
      },
      onPageMarginChange: setPageMargin,
      showPageMarginGuides: showMarginOutlines,
      extraChildren: [...(editorConfig.extraChildren ?? []), ...droppedSvgNodes],
    }),
    [droppedSvgNodes, pageMargin, pagePreset, showMarginOutlines],
  );
  const editor = useEditor({ bundledFontUrl, fallbackFontUrl, config });
  const pdf = useEditorPdf({
    document: editor.layoutTree,
    page: config.page,
    measurer: editor.textMeasurer,
    pageGap: config.pageGap,
    pdfWorkerUrl,
    extensions: config.extensions,
    metadata: { title: "Vasa editor demo", author: "Vasa" },
    outlineText: editor.outlineText,
    defaultTextFill: config.textColor,
    downloadTextMode: "outline",
    downloadFileName: "vasa-editor-demo.pdf",
  });

  return (
    <EditorShellProvider
      value={{
        editor,
        pdf,
        addDroppedSvgNodes: (nodes) =>
          setDroppedSvgNodes((currentNodes) => [...currentNodes, ...nodes]),
        marginPreset,
        pagePreset,
        setMarginPreset: (preset) => {
          setMarginPresetState(preset);
          const value = marginPresets[preset].value;
          setPageMargin({ top: value, right: value, bottom: value, left: value });
        },
        setPagePreset,
        setShowMarginOutlines,
        showMarginOutlines,
        showPagesRail,
      }}
    >
      <main className="editor-shell">
        <Toolbar />
        <section className="workspace-grid">
          <CanvasEditor />
          {showInspector ? <Inspector /> : null}
          {showPdfPreview ? <PdfRenderer /> : null}
        </section>
      </main>
    </EditorShellProvider>
  );
}

function EditorShellProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: EditorShellContextValue;
}) {
  return <EditorShellContext.Provider value={value}>{children}</EditorShellContext.Provider>;
}

function useEditorShell() {
  const value = useContext(EditorShellContext);
  if (value === undefined) {
    throw new Error("Editor shell components must be rendered inside EditorShell.");
  }
  return value;
}

function Toolbar() {
  const { editor } = useEditorShell();
  const selectableFonts = editor.fonts.filter(
    (font, index, fonts) =>
      fonts.findIndex(
        (candidate) => candidate.family === font.family && candidate.style === font.style,
      ) === index,
  );
  const selectedFontId =
    selectableFonts.find((font) => font.id === editor.selectedFontId)?.id ??
    selectableFonts.find(
      (font) =>
        font.family ===
        editor.fonts.find((candidate) => candidate.id === editor.selectedFontId)?.family,
    )?.id ??
    editor.selectedFontId;
  const blockStyle =
    editor.selectedBlock.type === "heading" && editor.selectedBlock.attrs?.level === 1
      ? "heading-1"
      : editor.selectedBlock.type === "heading" && editor.selectedBlock.attrs?.level === 2
        ? "heading-2"
        : editor.selectedBlock.type === "heading" && editor.selectedBlock.attrs?.level === 3
          ? "heading-3"
          : "paragraph";
  const fontSizeOptions = editor.fontSizeOptions.includes(editor.selectedFontSize)
    ? editor.fontSizeOptions
    : [...editor.fontSizeOptions, editor.selectedFontSize].sort((left, right) => left - right);

  return (
    <section className="editor-toolbar" aria-label="Document actions">
      <div>
        <p className="eyebrow">Vasa</p>
        <h1>vasa.sh</h1>
      </div>
      <div className="toolbar-controls">
        <label className="font-select-label">
          <Type size={17} aria-hidden="true" />
          <select
            value={selectedFontId}
            onChange={(event) => editor.updateSelectedFont(event.currentTarget.value)}
            aria-label="Font family"
          >
            {selectableFonts.map((font) => (
              <option key={font.id} value={font.id}>
                {font.family}
              </option>
            ))}
          </select>
        </label>
        <label className="block-select-label">
          <Heading1 size={17} aria-hidden="true" />
          <select
            value={blockStyle}
            onChange={(event) =>
              editor.updateSelectedBlockStyle(
                event.currentTarget.value as "paragraph" | "heading-1" | "heading-2" | "heading-3",
              )
            }
            aria-label="Block style"
          >
            <option value="paragraph">Paragraph</option>
            <option value="heading-1">Heading 1</option>
            <option value="heading-2">Heading 2</option>
            <option value="heading-3">Heading 3</option>
          </select>
        </label>
        <select
          className="style-select"
          value={editor.selectedFontSize}
          onChange={(event) => editor.updateSelectedFontSize(Number(event.currentTarget.value))}
          aria-label="Font size"
        >
          {fontSizeOptions.map((fontSize) => (
            <option key={fontSize} value={fontSize}>
              {fontSize}px
            </option>
          ))}
        </select>
        <MarkButton label="Bold" mark="bold" onClick={editor.toggleSelectedBold}>
          B
        </MarkButton>
        <MarkButton
          label="Italic"
          mark="italic"
          onClick={() => editor.toggleSelectedMark("italic", toggleItalic)}
        >
          I
        </MarkButton>
        <MarkButton
          label="Underline"
          mark="underline"
          onClick={() => editor.toggleSelectedMark("underline", toggleUnderline)}
        >
          U
        </MarkButton>
        <MarkButton
          label="Strike"
          mark="strike"
          onClick={() => editor.toggleSelectedMark("strike", toggleStrike)}
        >
          S
        </MarkButton>
        <MarkButton
          label="Code"
          mark="code"
          onClick={() => editor.toggleSelectedMark("code", toggleCode)}
        >
          <Code2 size={16} aria-hidden="true" />
        </MarkButton>
        <MarkButton
          label="Highlight"
          mark="highlight"
          onClick={() =>
            editor.toggleSelectedMark(
              "highlight",
              (doc, currentSelection) =>
                toggleHighlight(doc, currentSelection, { color: "#fef08a" }),
              { color: "#fef08a" },
            )
          }
        >
          <Highlighter size={16} aria-hidden="true" />
        </MarkButton>
        <MarkButton
          className="toggle-action script-action"
          label="Superscript"
          mark="superscript"
          onClick={() => editor.toggleSelectedMark("superscript", toggleSuperscript)}
        >
          x2
        </MarkButton>
        <MarkButton
          className="toggle-action script-action"
          label="Subscript"
          mark="subscript"
          onClick={() => editor.toggleSelectedMark("subscript", toggleSubscript)}
        >
          x2
        </MarkButton>
        <button
          className="toggle-action"
          type="button"
          aria-label="Blockquote"
          aria-pressed={editor.selectedBlock.inBlockquote}
          onClick={editor.toggleSelectedBlockquote}
        >
          <Quote size={16} aria-hidden="true" />
        </button>
        <button
          className="toggle-action"
          type="button"
          aria-label="Insert horizontal rule"
          onClick={editor.insertHorizontalRule}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <label className="color-control" aria-label="Text color">
          <Baseline size={16} aria-hidden="true" />
          <input
            type="color"
            value={editor.selectedColor}
            onChange={(event) => editor.updateSelectedColor(event.currentTarget.value)}
          />
        </label>
        <a
          className="primary-action github-action"
          href="https://github.com/maxscn/vasa"
          rel="noreferrer"
          target="_blank"
        >
          GitHub
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function MarkButton({
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
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CanvasEditor() {
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
    const nodes = await Promise.all(files.map(readSvgFileAsNode));
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

function Inspector() {
  const {
    editor,
    marginPreset,
    pagePreset,
    pdf,
    setMarginPreset,
    setPagePreset,
    setShowMarginOutlines,
    showMarginOutlines,
  } = useEditorShell();
  const tableSelected = isSelectionInsideTable(editor.editorDocument, editor.selection.path);
  const currentPage = pagePresets[pagePreset];

  return (
    <aside className="inspector-panel" aria-label="Inspector">
      {tableSelected ? (
        <div className="inspector-section first">
          <h2>Table</h2>
          <div className="field-label">Rows</div>
          <div className="inspector-actions">
            <button type="button" onClick={editor.insertTableRowBefore}>
              <Rows3 size={16} aria-hidden="true" />
              Add row above
            </button>
            <button type="button" onClick={editor.insertTableRowAfter}>
              <Rows3 size={16} aria-hidden="true" />
              Add row below
            </button>
            <button type="button" onClick={editor.deleteCurrentTableRow}>
              <Rows3 size={16} aria-hidden="true" />
              Delete current row
            </button>
          </div>

          <div className="field-label">Columns</div>
          <div className="inspector-actions">
            <button type="button" onClick={editor.insertTableColumnBefore}>
              <Columns3 size={16} aria-hidden="true" />
              Add column left
            </button>
            <button type="button" onClick={editor.insertTableColumnAfter}>
              <Columns3 size={16} aria-hidden="true" />
              Add column right
            </button>
            <button type="button" onClick={editor.deleteCurrentTableColumn}>
              <Columns3 size={16} aria-hidden="true" />
              Delete current column
            </button>
          </div>

          <div className="field-label">Table</div>
          <div className="inspector-actions">
            <button className="danger-action" type="button" onClick={editor.deleteCurrentTable}>
              Delete table
            </button>
          </div>
        </div>
      ) : (
        <div className="inspector-section first">
          <h2>Page</h2>
          <div className="field-label">Size</div>
          <InspectorSelect
            ariaLabel="Page size"
            value={pagePreset}
            options={Object.entries(pagePresets).map(([id, preset]) => ({
              label: preset.label,
              value: id,
            }))}
            onValueChange={(value) => setPagePreset(value as PagePresetId)}
          />
          <p className="muted">{currentPage.note}</p>

          <div className="field-label">Margins</div>
          <InspectorSelect
            ariaLabel="Page margins"
            value={marginPreset}
            options={Object.entries(marginPresets).map(([id, preset]) => ({
              label: `${preset.label} (${preset.value}px)`,
              value: id,
            }))}
            onValueChange={(value) => setMarginPreset(value as MarginPresetId)}
          />
          <ToggleField
            checked={showMarginOutlines}
            label="Show outlines"
            onCheckedChange={setShowMarginOutlines}
          />

          <div className="field-label">Insert</div>
          <div className="inspector-actions">
            <button type="button" onClick={editor.insertBlankTable}>
              <Table2 size={16} aria-hidden="true" />
              New table
            </button>
          </div>

          <div className="field-label">Document</div>
          <div className="inspector-actions">
            <button type="button" onClick={pdf.renderPdf}>
              <Download size={16} aria-hidden="true" />
              Export PDF
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function ToggleField({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="switch-field">
      <span>{label}</span>
      <button
        aria-checked={checked}
        aria-label={label}
        className="switch-control"
        data-state={checked ? "checked" : "unchecked"}
        onClick={() => onCheckedChange(!checked)}
        role="switch"
        type="button"
      >
        <span />
      </button>
    </div>
  );
}

function InspectorSelect({
  ariaLabel,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className="select-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="select-trigger"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="select-content" role="listbox" aria-label={ariaLabel} tabIndex={-1}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="select-item"
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isSelectionInsideTable(doc: { type: string; content?: unknown[] }, path: number[]) {
  let node: unknown = doc;

  for (const index of path) {
    if (isEditorJsonNode(node) && node.type === "table") return true;
    node = isEditorJsonNode(node) ? node.content?.[index] : undefined;
  }

  return isEditorJsonNode(node) && node.type === "table";
}

function isEditorJsonNode(value: unknown): value is { type: string; content?: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function PagesRail() {
  const { editor } = useEditorShell();
  const shouldScrollToInsertedPageRef = useRef(false);
  const activePageIndexRef = useRef<number | undefined>(undefined);
  const pages =
    editor.renderDocument.pages.length === 0 ? [{ index: 0 }] : editor.renderDocument.pages;
  const activePageIndex = selectedPageIndex(editor.renderDocument, editor.selection.path);

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

function PageThumb({
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

function selectedPageIndex(
  document: UseEditorReturn["renderDocument"],
  selectionPathParts: number[],
) {
  const selectionPath = selectionPathParts.join(".");
  const page = document.pages.find((candidate) => renderPageContainsPath(candidate, selectionPath));

  return page?.index ?? document.pages[0]?.index ?? 0;
}

function renderPageContainsPath(
  page: UseEditorReturn["renderDocument"]["pages"][number],
  selectionPath: string,
) {
  return findRenderNode(page.nodes, (sourceId) => {
    if (sourceId.length === 0) return false;
    return sourceId === selectionPath || selectionPath.startsWith(`${sourceId}.`);
  });
}

function findRenderNode(
  nodes: UseEditorReturn["renderDocument"]["pages"][number]["nodes"],
  match: (sourceId: string) => boolean,
) {
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.shift();
    if (node === undefined) continue;
    if (match(node.sourceId ?? "")) return true;
    stack.push(...node.children);
  }

  return false;
}

function pageCanvasY(
  page: UseEditorReturn["renderDocument"]["pages"][number],
  ordinal: number,
  pageGap: number,
) {
  return page.rect.y + ordinal * (page.rect.height + pageGap);
}

function scrollEditorCanvasToPage(
  editor: UseEditorReturn,
  pageIndex: number,
  behavior: ScrollBehavior,
) {
  const renderedPage = editor.renderDocument.pages.find(
    (candidate) => candidate.index === pageIndex,
  );
  const ordinal = editor.renderDocument.pages.findIndex(
    (candidate) => candidate.index === pageIndex,
  );
  const frame = editor.canvasRef.current?.parentElement;
  if (renderedPage === undefined || ordinal < 0 || frame === undefined || frame === null) return;

  const scale = canvasVisualScale(editor.canvasRef.current);
  const pageY = pageCanvasY(renderedPage, ordinal, editor.renderLineOptions.pageGap ?? 0);

  frame.scrollTo({ top: Math.max(0, pageY * scale - 24), behavior });
}

function canvasVisualScale(canvas: HTMLCanvasElement | null) {
  if (canvas === null) return 1;

  const rect = canvas.getBoundingClientRect();
  const styleWidth = Number.parseFloat(canvas.style.width);

  return styleWidth > 0 ? rect.width / styleWidth : 1;
}

function svgFilesFromDataTransfer(dataTransfer: DataTransfer) {
  const itemFiles = Array.from(dataTransfer.items ?? []).flatMap((item) => {
    if (item.kind !== "file" || !isSvgTransferType(item.type)) return [];
    const file = item.getAsFile();
    return file === null ? [] : [file];
  });
  const files = itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files ?? []);

  return files.filter(
    (file) => isSvgTransferType(file.type) || file.name.toLowerCase().endsWith(".svg"),
  );
}

async function readSvgFileAsNode(file: File) {
  const source = await file.text();
  const svg = new DOMParser().parseFromString(source, "image/svg+xml").querySelector("svg");
  if (svg === null) throw new Error("Dropped SVG file does not contain an <svg> element.");

  const viewBox = svg.getAttribute("viewBox") ?? undefined;
  const viewBoxSize = viewBox?.split(/[\s,]+/).map(Number);
  const width = svgLength(svg.getAttribute("width")) ?? viewBoxSize?.[2] ?? 180;
  const height = svgLength(svg.getAttribute("height")) ?? viewBoxSize?.[3] ?? 92;
  const paths = Array.from(
    svg.querySelectorAll("path, rect, circle, ellipse, line, polygon, polyline"),
    (element) => (element instanceof SVGElement ? svgShapeSpec(element) : []),
  ).flat();

  if (paths.length === 0) throw new Error("Dropped SVG file does not contain supported paths.");

  return createSvgNode({
    id: `dropped-svg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    width,
    height,
    viewBox,
    title: svg.querySelector("title")?.textContent ?? file.name,
    style: { margin: { top: 10 } },
    paths,
  });
}

function svgShapeSpec(element: SVGElement): SvgPathSpec[] {
  const d = svgShapePath(element);
  if (d === undefined) return [];

  return [
    {
      d,
      fill: svgPaint(element.getAttribute("fill")),
      stroke: svgPaint(element.getAttribute("stroke")),
      strokeWidth: svgLength(element.getAttribute("stroke-width")),
    },
  ];
}

function svgShapePath(element: SVGElement) {
  if (element instanceof SVGPathElement) return element.getAttribute("d") ?? undefined;
  if (element instanceof SVGRectElement) return svgRectPath(element);
  if (element instanceof SVGCircleElement) {
    return svgEllipsePath(
      svgLength(element.getAttribute("cx")) ?? 0,
      svgLength(element.getAttribute("cy")) ?? 0,
      svgLength(element.getAttribute("r")) ?? 0,
      svgLength(element.getAttribute("r")) ?? 0,
    );
  }
  if (element instanceof SVGEllipseElement) {
    return svgEllipsePath(
      svgLength(element.getAttribute("cx")) ?? 0,
      svgLength(element.getAttribute("cy")) ?? 0,
      svgLength(element.getAttribute("rx")) ?? 0,
      svgLength(element.getAttribute("ry")) ?? 0,
    );
  }
  if (element instanceof SVGLineElement) {
    return `M${svgLength(element.getAttribute("x1")) ?? 0} ${svgLength(element.getAttribute("y1")) ?? 0} L${svgLength(element.getAttribute("x2")) ?? 0} ${svgLength(element.getAttribute("y2")) ?? 0}`;
  }
  if (element instanceof SVGPolygonElement) return svgPointsPath(element, true);
  if (element instanceof SVGPolylineElement) return svgPointsPath(element, false);

  return undefined;
}

function svgRectPath(rect: SVGRectElement) {
  const x = svgLength(rect.getAttribute("x")) ?? 0;
  const y = svgLength(rect.getAttribute("y")) ?? 0;
  const width = svgLength(rect.getAttribute("width")) ?? 0;
  const height = svgLength(rect.getAttribute("height")) ?? 0;
  if (width <= 0 || height <= 0) return undefined;

  return `M${x} ${y} L${x + width} ${y} L${x + width} ${y + height} L${x} ${y + height} Z`;
}

function svgEllipsePath(cx: number, cy: number, rx: number, ry: number) {
  if (rx <= 0 || ry <= 0) return undefined;
  const kappa = 0.5522847498307936;
  const ox = rx * kappa;
  const oy = ry * kappa;

  return [
    `M${cx - rx} ${cy}`,
    `C${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry}`,
    `C${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy}`,
    `C${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry}`,
    `C${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy}`,
    "Z",
  ].join(" ");
}

function svgPointsPath(element: SVGPolygonElement | SVGPolylineElement, closed: boolean) {
  const points = element.getAttribute("points")?.trim();
  if (points === undefined || points.length === 0) return undefined;

  const values = points.split(/[\s,]+/).map(Number);
  const commands: string[] = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    commands.push(`${commands.length === 0 ? "M" : "L"}${x} ${y}`);
  }

  if (commands.length === 0) return undefined;
  return closed ? `${commands.join(" ")} Z` : commands.join(" ");
}

function isSvgTransferType(type: string) {
  return type === "image/svg+xml" || type === "text/xml" || type === "application/xml";
}

function svgLength(value: string | null) {
  if (value === null) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function svgPaint(value: string | null) {
  return value === null || value === "none" ? undefined : value;
}

function PdfRenderer() {
  const { pdf } = useEditorShell();

  return (
    <section className="preview-panel" aria-label="Rendered PDF">
      <span className="panel-label">
        <FileText size={17} aria-hidden="true" />
        Rendered PDF
      </span>
      <div className="pdf-frame">
        <canvas ref={pdf.pdfCanvasRef} aria-label="Rendered PDF preview" />
      </div>
    </section>
  );
}
