import { buildCanvasScene, createCanvasRenderer, type CanvasRendererExtension } from "@vasa/canvas";
import {
  collectExtensionRenderers,
  collectLayoutExtensions,
  collectRendererExtensions,
  type VasaExtension,
} from "@vasa/core";
import {
  createCanvasFontValue,
  type FontDescriptor,
  type FontSource,
  type VasaFont,
} from "@vasa/font";
import {
  createPageGeometry,
  updatePageMarginGuide,
  type LayoutNode,
  type LayoutOptions,
  type PageMarginGuide,
  type ResolvedBoxEdges,
} from "@vasa/layout";
import type { PdfRendererExtension } from "@vasa/pdf";
import { createRenderDocument, type RenderDocument } from "@vasa/renderer";
import { useEditor as useTiptapEditor, type UseEditorOptions } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState, type DependencyList } from "react";
import {
  createEditorParityDocument,
  createEditorRenderDocument,
  createEditorRenderMeasureText,
  createEditorRenderTextMeasurer,
  createEditorSession,
  createBarebonesEditorExtensions,
  applyEditorSessionMutation,
  currentEditorTextStyleAttrs,
  currentTextBlockType,
  deleteCurrentTable,
  deleteCurrentTableColumn,
  deleteCurrentTableRow,
  editorHeadingTextStyleAttrs,
  editorCodeFontDescriptor,
  insertTableColumnAfter,
  insertTableColumnBefore,
  insertBlankTableAfterCurrentBlock,
  insertHorizontalRuleAfterCurrentBlock,
  insertPageBreakAtDocumentEnd,
  insertTableRowAfter,
  insertTableRowBefore,
  isSelectionExpanded,
  paintEditorCaret,
  paintEditorSelection,
  setColor,
  setCurrentTextBlockType,
  setEditorSessionTextStyle,
  setFontFamily,
  setFontSize,
  setLineHeight,
  toggleCurrentBlockquote,
  toggleBold,
  toggleEditorSessionMark,
  updateEditorSessionSelection,
  type EditorJson,
  type EditorSelection,
  type EditorSession,
} from "../src/index.ts";
import { domCanvasSurface } from "../src/browser.ts";
import type { EditorKeymap } from "./keymap.ts";
import { useEditorFonts } from "./use-editor-fonts.ts";
import { useEditorInput } from "./use-editor-input.ts";
import { useEditorMovement } from "./use-editor-movement.ts";

export type EditorConfig = {
  bundledFont: VasaFont;
  bundledFontSource?: FontSource;
  fallbackFont: VasaFont;
  fallbackFontSource?: FontSource;
  defaultFontId?: string;
  page: LayoutOptions["page"];
  onPageMarginChange?: (margin: ResolvedBoxEdges) => void;
  pageGap: number;
  textCharWidth: number;
  textFontSize: number;
  textLineHeight: number;
  lineHeightOptions?: number[];
  document?: EditorJson;
  extensions?: Array<
    VasaExtension<{
      canvas: CanvasRendererExtension;
      pdf: PdfRendererExtension;
    }>
  >;
  extraChildren?: LayoutNode[];
  fontFamilies?: Array<string | FontDescriptor>;
  fontSizeOptions: number[];
  initialColor?: string;
  pageBackground?: string;
  showPageMarginGuides?: boolean;
  textColor?: string;
  multiClickIntervalMs?: number;
  multiClickMaxDistancePx?: number;
  keymap?: EditorKeymap;
  tiptap?: UseEditorOptions;
  tiptapDeps?: DependencyList;
};

export type EditorProps = {
  config: EditorConfig;
};

export function useEditor({ config }: EditorProps) {
  const documentExtensions = config.extensions ?? [];
  const tiptapExtensions = useMemo(
    () => [
      ...createBarebonesEditorExtensions(),
      ...documentExtensions.flatMap((extension) => extension.tiptap ?? []),
      ...(config.tiptap?.extensions ?? []),
    ],
    [config.tiptap?.extensions, documentExtensions],
  );
  const tiptapOptions = useMemo(
    () => ({
      immediatelyRender: false,
      ...config.tiptap,
      extensions: tiptapExtensions,
    }),
    [config.tiptap, tiptapExtensions],
  );
  const tiptapEditor = useTiptapEditor(tiptapOptions, config.tiptapDeps ?? []);
  const extraChildren = config.extraChildren ?? [];
  const pageBackground = config.pageBackground ?? "#fffdfa";
  const textColor = config.textColor ?? "#1f2937";
  const multiClickIntervalMs = config.multiClickIntervalMs ?? 500;
  const multiClickMaxDistancePx = config.multiClickMaxDistancePx ?? 6;
  const editorRenderLineOptions = useMemo(
    () => ({
      pageHeight: config.page.height,
      pageGap: config.pageGap,
      minLineWidth: config.textCharWidth,
    }),
    [config.page.height, config.pageGap, config.textCharWidth],
  );
  const [editorSession, setEditorSession] = useState<EditorSession>(() =>
    createEditorSession({ doc: config.document ?? createEditorParityDocument() }),
  );
  const editorDocument = editorSession.doc;
  const selection = editorSession.selection;
  const storedMarks = editorSession.storedMarks;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editorSessionRef = useRef(editorSession);
  const marginDragRef = useRef<PageMarginGuide | undefined>(undefined);
  const editorFontFamilies = useMemo(
    () => [editorCodeFontDescriptor, ...(config.fontFamilies ?? [])],
    [config.fontFamilies],
  );
  const editorFonts = useEditorFonts({
    bundledFont: config.bundledFont,
    bundledFontSource: config.bundledFontSource,
    fallbackFont: config.fallbackFont,
    fallbackFontSource: config.fallbackFontSource,
    fontFamilies: editorFontFamilies,
  });
  const [selectedColor, setSelectedColor] = useState(config.initialColor ?? "#2563eb");
  const defaultRenderFontId = config.defaultFontId ?? config.bundledFont.id;
  const defaultRenderFont =
    editorFonts.fonts.find((font) => font.id === defaultRenderFontId) ??
    editorFonts.fonts.find((font) => font.id === config.bundledFont.id) ??
    config.bundledFont;
  const suppressedBeforeInputRef = useRef<Record<string, number>>({});
  const [editorMeasureText, setEditorMeasureText] = useState<
    (text: string, font?: string) => number
  >(() => (text: string) => text.length * config.textCharWidth);
  const [isEditorInputFocused, setIsEditorInputFocused] = useState(false);
  const editorCanvasFont = useMemo(
    () => createCanvasFontValue(defaultRenderFont, { fontSize: config.textFontSize }),
    [defaultRenderFont, config.textFontSize],
  );
  const editorRenderProfile = useMemo(
    () => ({
      fonts: editorFonts.fonts,
      defaultFontId: defaultRenderFont.id,
      fallbackFont: config.fallbackFont,
      fontSize: config.textFontSize,
      lineHeight: config.textLineHeight,
      textColor,
      whiteSpace: "pre-wrap" as const,
      wordBreak: "normal" as const,
    }),
    [
      config.fallbackFont,
      config.textFontSize,
      config.textLineHeight,
      defaultRenderFont.id,
      editorFonts.fonts,
      textColor,
    ],
  );
  const editorRenderMeasureText = useMemo(
    () => createEditorRenderMeasureText(editorRenderProfile, editorMeasureText),
    [editorMeasureText, editorRenderProfile],
  );
  const editorTextMeasurer = useMemo(
    () => createEditorRenderTextMeasurer(editorRenderProfile, editorMeasureText),
    [editorMeasureText, editorRenderProfile],
  );
  const currentTextStyleAttrs = useMemo(
    () => currentEditorTextStyleAttrs(editorDocument, selection, storedMarks),
    [editorDocument, selection, storedMarks],
  );
  const currentTextBlock = useMemo(
    () => currentTextBlockType(editorDocument, selection),
    [editorDocument, selection],
  );
  const selectedRenderFont =
    editorFonts.fonts.find(
      (font) => font.id === (currentTextStyleAttrs.fontId ?? defaultRenderFont.id),
    ) ?? defaultRenderFont;
  const selectedFontSize =
    currentTextStyleAttrs.fontSize ??
    (currentTextBlock.type === "heading"
      ? editorHeadingTextStyleAttrs(currentTextBlock.attrs).fontSize
      : config.textFontSize);
  const selectedLineHeight = currentTextStyleAttrs.lineHeight ?? baseLineHeightScale(config);
  const shouldPaintSelection = isEditorInputFocused || isSelectionExpanded(selection);
  const editorRenderContract = useMemo(
    () =>
      createEditorRenderDocument({
        doc: editorDocument,
        page: config.page,
        measurer: editorTextMeasurer,
        profile: editorRenderProfile,
        rootStyle: { gap: 14 },
        paragraphStyle: { flexDirection: "column" },
        extraChildren,
        layoutExtensions: collectLayoutExtensions(documentExtensions),
        rendererExtensions: collectRendererExtensions(documentExtensions),
        createRenderDocument,
      }),
    [
      config.page,
      documentExtensions,
      editorDocument,
      editorRenderProfile,
      editorTextMeasurer,
      extraChildren,
    ],
  );
  const layoutTree = editorRenderContract.layoutTree;
  const renderDocument = editorRenderContract.renderDocument;
  const canvasRenderers = useMemo(
    () => collectExtensionRenderers(documentExtensions, "canvas"),
    [],
  );
  const canvasScene = useMemo(
    () =>
      buildCanvasScene(renderDocument, { pageGap: config.pageGap, extensions: canvasRenderers }),
    [canvasRenderers, config.pageGap, renderDocument],
  );
  const showPageMarginGuides = config.showPageMarginGuides ?? true;
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context === null) return;

    context.font = editorCanvasFont;
    setEditorMeasureText(() => (text: string, font?: string) => {
      context.font = font ?? editorCanvasFont;
      return context.measureText(text).width;
    });
  }, [editorCanvasFont]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const context = canvas.getContext("2d");
    if (context === null) return;

    const width = Math.max(
      config.page.width,
      ...canvasScene.pages.map((pageItem) => pageItem.rect.width),
    );
    const height = Math.max(
      config.page.height,
      ...canvasScene.pages.map((pageItem) => pageItem.rect.y + pageItem.rect.height),
    );
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(scale, 0, 0, scale, 0, 0);
    createCanvasRenderer(domCanvasSurface(context, editorCanvasFont), {
      pageBackground,
      pageGap: config.pageGap,
      extensions: canvasRenderers,
      text: editorRenderContract.canvasTextPaint,
    }).render(renderDocument);
    if (showPageMarginGuides) {
      paintPageMarginGuides(context, renderDocument, config.pageGap, scale);
    }
    if (shouldPaintSelection) {
      paintEditorSelection(
        context,
        renderDocument,
        selection,
        editorRenderMeasureText,
        editorRenderLineOptions,
        {
          scale,
        },
      );
    }
    if (isEditorInputFocused) {
      paintEditorCaret(
        context,
        renderDocument,
        selection,
        editorRenderMeasureText,
        editorRenderLineOptions,
        {
          scale,
        },
      );
    }
  }, [
    canvasScene,
    canvasRenderers,
    editorCanvasFont,
    editorRenderContract.canvasTextPaint,
    editorRenderMeasureText,
    isEditorInputFocused,
    shouldPaintSelection,
    renderDocument,
    selection,
    config.pageGap,
    showPageMarginGuides,
  ]);

  function updateSelectedFont(fontId: string) {
    editorFonts.setSelectedFontId(fontId);
    updateEditor((session) =>
      setEditorSessionTextStyle(session, { fontId }, (doc, currentSelection) =>
        setFontFamily(doc, currentSelection, fontId),
      ),
    );
    focusKeyboardBridge();
  }

  function updateSelectedFontSize(fontSize: number) {
    updateEditor((session) =>
      setEditorSessionTextStyle(session, { fontSize }, (doc, currentSelection) =>
        setFontSize(doc, currentSelection, fontSize),
      ),
    );
    focusKeyboardBridge();
  }

  function updateSelectedLineHeight(lineHeight: number) {
    updateEditor((session) =>
      setEditorSessionTextStyle(session, { lineHeight }, (doc, currentSelection) =>
        setLineHeight(doc, currentSelection, lineHeight),
      ),
    );
    focusKeyboardBridge();
  }

  function toggleSelectedBold() {
    toggleSelectedMark("bold", toggleBold);
  }

  function toggleSelectedMark(
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
    updateEditor((session) => toggleEditorSessionMark(session, { type, attrs }, mutate));
    focusKeyboardBridge();
  }

  function updateSelectedColor(color: string) {
    setSelectedColor(color);
    updateEditor((session) =>
      setEditorSessionTextStyle(session, { color }, (doc, currentSelection) =>
        setColor(doc, currentSelection, color),
      ),
    );
    focusKeyboardBridge();
  }

  function updateSelectedBlockStyle(style: "paragraph" | "heading-1" | "heading-2" | "heading-3") {
    updateEditor((session) =>
      applyEditorSessionMutation(session, (doc, currentSelection) => {
        if (style === "paragraph") {
          return setCurrentTextBlockType(doc, currentSelection, "paragraph");
        }

        return setCurrentTextBlockType(doc, currentSelection, "heading", {
          level: Number(style.at(-1)),
        });
      }),
    );
    focusKeyboardBridge();
  }

  function toggleSelectedBlockquote() {
    updateEditor((session) =>
      applyEditorSessionMutation(session, (doc, currentSelection) =>
        toggleCurrentBlockquote(doc, currentSelection),
      ),
    );
    focusKeyboardBridge();
  }

  function insertHorizontalRule() {
    updateEditor((session) =>
      applyEditorSessionMutation(session, (doc, currentSelection) =>
        insertHorizontalRuleAfterCurrentBlock(doc, currentSelection),
      ),
    );
    focusKeyboardBridge();
  }

  function insertBlankTable() {
    updateEditor((session) =>
      applyEditorSessionMutation(session, (doc, currentSelection) =>
        insertBlankTableAfterCurrentBlock(doc, currentSelection),
      ),
    );
    focusKeyboardBridge();
  }

  function insertPageBreak() {
    const currentPage = lastPage();
    const remainingHeight =
      currentPage === undefined
        ? config.page.height
        : currentPage.content.y + currentPage.content.height - lastPageContentBottomY(currentPage);

    updateEditor((session) => {
      return applyEditorSessionMutation(session, (doc) => {
        return insertPageBreakAtDocumentEnd(
          doc,
          Math.max(config.textLineHeight, remainingHeight + config.textLineHeight),
        );
      });
    });
    focusKeyboardBridge();
  }

  function mutateSelectedTable(
    mutate: (
      doc: EditorJson,
      currentSelection: EditorSelection,
    ) => {
      doc: EditorJson;
      selection: EditorSelection;
    },
  ) {
    updateEditor((session) =>
      applyEditorSessionMutation(session, (doc, currentSelection) => mutate(doc, currentSelection)),
    );
    focusKeyboardBridge();
  }

  function focusKeyboardBridge() {
    if (inputRef.current !== null) {
      inputRef.current.value = "";
      inputRef.current.focus({ preventScroll: true });
      setIsEditorInputFocused(true);
    }
  }

  function blurKeyboardBridge() {
    setIsEditorInputFocused(false);
  }

  function updateEditor(update: (session: EditorSession) => EditorSession) {
    const next = update(editorSessionRef.current);
    editorSessionRef.current = next;
    if (inputRef.current !== null) inputRef.current.value = "";
    setEditorSession(next);
  }

  function updateSelection(
    nextSelection: EditorSelection | ((currentSelection: EditorSelection) => EditorSelection),
  ) {
    const resolved =
      typeof nextSelection === "function"
        ? nextSelection(editorSessionRef.current.selection)
        : nextSelection;
    updateEditor((session) => updateEditorSessionSelection(session, resolved));
  }

  const movement = useEditorMovement({
    canvasRef,
    editorDocument,
    renderDocument,
    renderLineOptions: editorRenderLineOptions,
    measureText: editorRenderMeasureText,
    currentSelection: () => editorSessionRef.current.selection,
    updateSelection,
    focusKeyboardBridge,
    multiClickIntervalMs,
    multiClickMaxDistancePx,
  });

  function handleCanvasPointerDown(event: Parameters<typeof movement.handleCanvasPointerDown>[0]) {
    const guide = marginGuideAtPointer(event);
    if (guide !== undefined && config.onPageMarginChange !== undefined) {
      event.preventDefault();
      marginDragRef.current = guide;
      event.currentTarget.setPointerCapture(event.pointerId);
      updatePageMarginFromPointer(event, guide);
      focusKeyboardBridge();
      return;
    }

    movement.handleCanvasPointerDown(event);
  }

  function handleCanvasPointerMove(event: Parameters<typeof movement.handleCanvasPointerMove>[0]) {
    const guide = marginDragRef.current;
    if (guide !== undefined) {
      event.preventDefault();
      updatePageMarginFromPointer(event, guide);
      return;
    }

    movement.handleCanvasPointerMove(event);
  }

  function handleCanvasPointerUp(event: Parameters<typeof movement.handleCanvasPointerUp>[0]) {
    marginDragRef.current = undefined;
    movement.handleCanvasPointerUp(event);
  }

  function marginGuideAtPointer(event: Parameters<typeof movement.handleCanvasPointerDown>[0]) {
    const point = canvasPointForEvent(event.currentTarget, event.clientX, event.clientY);
    const pageIndex = pageIndexAtY(point.y, config.page.height, config.pageGap);
    const localY = point.y - pageIndex * (config.page.height + config.pageGap);
    const geometry = createPageGeometry(config.page);
    const tolerance = 6;

    if (Math.abs(point.x - geometry.guides.left) <= tolerance) return "left";
    if (Math.abs(point.x - geometry.guides.right) <= tolerance) return "right";
    if (Math.abs(localY - geometry.guides.top) <= tolerance) return "top";
    if (Math.abs(localY - geometry.guides.bottom) <= tolerance) return "bottom";

    return undefined;
  }

  function updatePageMarginFromPointer(
    event: Parameters<typeof movement.handleCanvasPointerDown>[0],
    guide: PageMarginGuide,
  ) {
    const point = canvasPointForEvent(event.currentTarget, event.clientX, event.clientY);
    const pageIndex = pageIndexAtY(point.y, config.page.height, config.pageGap);
    const localY = point.y - pageIndex * (config.page.height + config.pageGap);
    const position = guide === "left" || guide === "right" ? point.x : localY;
    config.onPageMarginChange?.(
      updatePageMarginGuide(config.page, guide, position, {
        minContentWidth: config.textCharWidth * 8,
        minContentHeight: config.textLineHeight * 4,
      }),
    );
  }

  function lastPage() {
    return renderDocument.pages.at(-1);
  }

  function lastPageContentBottomY(page: RenderDocument["pages"][number]) {
    return Math.max(page.content.y, ...page.nodes.map(renderNodeBottomY));
  }

  const input = useEditorInput({
    editorDocument,
    editorSessionRef,
    keymap: config.keymap,
    measureText: editorRenderMeasureText,
    renderDocument,
    renderLineOptions: editorRenderLineOptions,
    suppressedBeforeInputRef,
    updateEditor,
    updateSelection,
    toggleBold: toggleSelectedBold,
    toggleMark: toggleSelectedMark,
    toggleBlockquote: toggleSelectedBlockquote,
    setBlockType: (type, attrs = {}) => {
      updateEditor((session) =>
        applyEditorSessionMutation(session, (doc, currentSelection) =>
          setCurrentTextBlockType(doc, currentSelection, type, attrs),
        ),
      );
      focusKeyboardBridge();
    },
  });

  return {
    canvasRef,
    canvasSelection: selection,
    cursorPosition: selection,
    editorDocument,
    editorSession,
    disabledMarks: editorSession.disabledMarks,
    fonts: editorFonts.fonts,
    hasActiveOutlineFont: selectedRenderFont.outlineFont !== undefined,
    isFontReady: editorFonts.isReady,
    focusKeyboardBridge,
    handleBeforeInput: input.handleBeforeInput,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleCopy: input.handleCopy,
    handleCut: input.handleCut,
    handleInput: input.handleInput,
    handleKeyDown: input.handleKeyDown,
    handleKeyboardBridgeBlur: blurKeyboardBridge,
    handleKeyboardBridgeFocus: () => setIsEditorInputFocused(true),
    handlePaste: input.handlePaste,
    inputRef,
    layoutTree,
    outlineText: editorRenderContract.pdfOutlineText,
    renderDocument,
    renderLineOptions: editorRenderLineOptions,
    textMeasurer: editorTextMeasurer,
    selectedColor,
    selectedFontId: selectedRenderFont.id,
    selectedFontSize,
    selectedLineHeight,
    selection,
    storedMarks,
    selectedBlock: currentTextBlock,
    tiptapEditor,
    fontSizeOptions: config.fontSizeOptions,
    lineHeightOptions: normalizeLineHeightOptions(config.lineHeightOptions, selectedLineHeight),
    insertHorizontalRule,
    insertBlankTable,
    insertPageBreak,
    insertTableColumnAfter: () => mutateSelectedTable(insertTableColumnAfter),
    insertTableColumnBefore: () => mutateSelectedTable(insertTableColumnBefore),
    insertTableRowAfter: () => mutateSelectedTable(insertTableRowAfter),
    insertTableRowBefore: () => mutateSelectedTable(insertTableRowBefore),
    deleteCurrentTable: () => mutateSelectedTable(deleteCurrentTable),
    deleteCurrentTableColumn: () => mutateSelectedTable(deleteCurrentTableColumn),
    deleteCurrentTableRow: () => mutateSelectedTable(deleteCurrentTableRow),
    toggleSelectedBold,
    toggleSelectedBlockquote,
    toggleSelectedMark,
    updateSelectedBlockStyle,
    updateSelectedColor,
    updateSelectedFont,
    updateSelectedFontSize,
    updateSelectedLineHeight,
  };
}

export type UseEditorReturn = ReturnType<typeof useEditor>;

function canvasPointForEvent(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const surfaceWidth = Number.parseFloat(canvas.style.width);
  const surfaceHeight = Number.parseFloat(canvas.style.height);

  return {
    x: ((clientX - rect.left) * surfaceWidth) / rect.width,
    y: ((clientY - rect.top) * surfaceHeight) / rect.height,
  };
}

function pageIndexAtY(y: number, pageHeight: number, pageGap: number) {
  return Math.max(0, Math.floor(y / (pageHeight + pageGap)));
}

function baseLineHeightScale(config: EditorConfig) {
  return config.textLineHeight / config.textFontSize;
}

function normalizeLineHeightOptions(options: number[] | undefined, selectedLineHeight: number) {
  return [...new Set([...(options ?? []), selectedLineHeight])]
    .filter((lineHeight) => Number.isFinite(lineHeight) && lineHeight > 0)
    .sort((left, right) => left - right);
}

function renderNodeBottomY(node: unknown): number {
  if (!isRenderNodeLike(node)) return 0;

  return Math.max(node.rect.y + node.rect.height, ...node.children.map(renderNodeBottomY));
}

function isRenderNodeLike(
  node: unknown,
): node is { rect: { y: number; height: number }; sourceId?: string; children: unknown[] } {
  return (
    typeof node === "object" &&
    node !== null &&
    "rect" in node &&
    typeof (node as { rect?: unknown }).rect === "object" &&
    (node as { rect?: unknown }).rect !== null &&
    "children" in node &&
    Array.isArray((node as { children?: unknown }).children)
  );
}

function paintPageMarginGuides(
  context: CanvasRenderingContext2D,
  document: RenderDocument,
  pageGap: number,
  scale: number,
) {
  context.save();
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.strokeStyle = "rgb(37 99 235 / 0.45)";
  context.lineWidth = 1;
  context.setLineDash([5, 5]);

  for (const page of document.pages) {
    const yOffset = page.index * (page.rect.height + pageGap);
    const { content, rect } = page;
    context.strokeRect(
      content.x,
      yOffset + content.y,
      Math.max(0, content.width),
      Math.max(0, content.height),
    );

    context.beginPath();
    context.moveTo(content.x, yOffset);
    context.lineTo(content.x, yOffset + rect.height);
    context.moveTo(content.x + content.width, yOffset);
    context.lineTo(content.x + content.width, yOffset + rect.height);
    context.moveTo(0, yOffset + content.y);
    context.lineTo(rect.width, yOffset + content.y);
    context.moveTo(0, yOffset + content.y + content.height);
    context.lineTo(rect.width, yOffset + content.y + content.height);
    context.stroke();
  }

  context.restore();
}
