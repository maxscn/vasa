import { Canvas, type CanvasRendererExtension } from "@skriva/canvas";
import { type Editor, type JSONContent, type SkrivaExtension } from "@skriva/core";
import {
  createCanvasFontValue,
  type FontDescriptor,
  type FontSource,
  type SkrivaFont,
} from "@skriva/font";
import {
  createPageGeometry,
  updatePageMarginGuide,
  type LayoutNode,
  type LayoutOptions,
  type PageMarginGuide,
  type ResolvedBoxEdges,
} from "@skriva/layout";
import type { PdfRendererExtension } from "@skriva/pdf";
import { type RenderDocument } from "@skriva/renderer";
import { useEditor as useTiptapEditor, type UseEditorOptions } from "@tiptap/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DependencyList,
  type DragEvent,
} from "react";
import {
  createEditorRenderMeasureText,
  createEditorRenderTextMeasurer,
  createSkrivaHeadlessRenderModel,
  inspectSkrivaHeadlessRenderModel,
  createSkrivaSurfaceAdapter,
  createPlainTextClipboardAdapter,
  createProjectSurfaceLineSelection,
  createProjectSurfaceSelection,
  createProjectSurfaceWordSelection,
  createTextareaBrowserInputAdapter,
  proseMirrorSelectionToSurfaceSelection,
  currentEditorTextStyleAttrs,
  currentTextBlockType,
  defaultEditorExtensions,
  editorHeadingTextStyleAttrs,
  editorCodeFontDescriptor,
  isSelectionExpanded,
  paintEditorCaret,
  paintEditorSelection,
  type EditorMarkSpec,
  type EditorSelection,
  pageBreakSpacerHeightForRemainingPage,
} from "../src/index.ts";
import { domCanvasSurface } from "../src/browser.ts";
import type { EditorKeymap } from "./keymap.ts";
import { useEditorFonts } from "./use-editor-fonts.ts";
import { useEditorInput, type UseEditorInputOptions } from "./use-editor-input.ts";
import { useEditorMovement, type UseEditorMovementOptions } from "./use-editor-movement.ts";

const EDITOR_ROOT_BLOCK_GAP = 14;

export type SkrivaEditorConfig = {
  bundledFont: SkrivaFont;
  bundledFontSource?: FontSource;
  fallbackFont: SkrivaFont;
  fallbackFontSource?: FontSource;
  defaultFontId?: string;
  page: LayoutOptions["page"];
  onPageMarginChange?: (margin: ResolvedBoxEdges) => void;
  pageGap: number;
  textCharWidth: number;
  textFontSize: number;
  textLineHeight: number;
  lineHeightOptions?: number[];
  document?: JSONContent;
  extensions?: Array<
    SkrivaExtension<{
      canvas: CanvasRendererExtension;
      pdf: PdfRendererExtension;
    }>
  >;
  extraChildren?: LayoutNode[];
  fontFamilies?: Array<string | FontDescriptor>;
  controlledFontFamilies?: string[];
  fontSizeOptions: number[];
  initialColor?: string;
  canvasTextMode?: "native" | "outline";
  canvasBitmapScale?: number;
  outlinePixelSnap?: number;
  pageBackground?: string;
  showPageMarginGuides?: boolean;
  textColor?: string;
  multiClickIntervalMs?: number;
  multiClickMaxDistancePx?: number;
  keymap?: EditorKeymap;
  surfaceDropHandlers?: SkrivaEditorSurfaceDropHandler[];
  tiptap?: UseEditorOptions;
  tiptapDeps?: DependencyList;
};

export type SkrivaEditorProps = {
  config: SkrivaEditorConfig;
};

export type SkrivaEditorSurfaceDropContext = {
  focusEditor: () => void;
};

export type SkrivaEditorSurfaceDropHandler = {
  canDrop: (event: DragEvent<HTMLElement>) => boolean;
  drop: (
    event: DragEvent<HTMLElement>,
    context: SkrivaEditorSurfaceDropContext,
  ) => boolean | Promise<boolean>;
};

export function useSkrivaEditor({ config }: SkrivaEditorProps) {
  const documentExtensions = config.extensions ?? [];
  const initialEditorDocument = useMemo<JSONContent>(
    () => config.document ?? createDefaultTiptapDocument(),
    [config.document],
  );
  const tiptapExtensions = useMemo(
    () =>
      uniqueTiptapExtensions([
        ...defaultEditorExtensions.flatMap((extension) => extension.tiptap ?? []),
        ...documentExtensions.flatMap((extension) => extension.tiptap ?? []),
        ...(config.tiptap?.extensions ?? []),
      ]),
    [config.tiptap?.extensions, documentExtensions],
  );
  const tiptapOptions = useMemo(
    () => ({
      immediatelyRender: false,
      ...config.tiptap,
      content: config.tiptap?.content ?? initialEditorDocument,
      extensions: tiptapExtensions,
    }),
    [config.tiptap, initialEditorDocument, tiptapExtensions],
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [tiptapProjectionRevision, setTiptapProjectionRevision] = useState(0);
  const tiptapProjectionFrameRef = useRef<number | undefined>(undefined);
  const fontChangeRequestRef = useRef(0);
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
    controlledFontFamilies: config.controlledFontFamilies,
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
  const canvasTextMode = config.canvasTextMode;
  const canvasBitmapScale = useCanvasBitmapScale(config.canvasBitmapScale ?? 1);
  const tiptapProjection = useMemo(
    () => createTiptapProjection(tiptapEditor, initialEditorDocument),
    [initialEditorDocument, tiptapEditor, tiptapProjectionRevision],
  );
  const scheduleTiptapProjectionSync = useCallback(() => {
    if (typeof window === "undefined") {
      setTiptapProjectionRevision((revision) => revision + 1);
      return;
    }
    if (tiptapProjectionFrameRef.current !== undefined) return;

    tiptapProjectionFrameRef.current = window.requestAnimationFrame(() => {
      tiptapProjectionFrameRef.current = undefined;
      setTiptapProjectionRevision((revision) => revision + 1);
    });
  }, []);
  const editorDocument = tiptapProjection.document;
  const selection = tiptapProjection.selection;
  const storedMarks = tiptapProjection.storedMarks;
  const disabledMarks = tiptapProjection.disabledMarks;
  const editorCanvasFont = useMemo(
    () => createCanvasFontValue(defaultRenderFont, { fontSize: config.textFontSize }),
    [defaultRenderFont, config.textFontSize],
  );
  const editorRenderProfile = useMemo(
    () => ({
      fonts: editorFonts.fonts,
      defaultFontId: defaultRenderFont.id,
      fallbackFont: config.fallbackFont,
      fontCatalog: editorFonts.fontCatalog,
      fontSize: config.textFontSize,
      lineHeight: config.textLineHeight,
      outlinePixelSnap: config.outlinePixelSnap,
      textColor,
      whiteSpace: "pre-wrap" as const,
      wordBreak: "normal" as const,
    }),
    [
      config.fallbackFont,
      editorFonts.fontCatalog,
      config.textFontSize,
      config.textLineHeight,
      config.outlinePixelSnap,
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
    () =>
      currentEditorTextStyleAttrs(
        editorDocument as Parameters<typeof currentEditorTextStyleAttrs>[0],
        selection,
        storedMarks,
      ),
    [editorDocument, selection, storedMarks],
  );
  const currentTextBlock = useMemo(
    () =>
      currentTextBlockType(editorDocument as Parameters<typeof currentTextBlockType>[0], selection),
    [editorDocument, selection],
  );
  const selectedRenderFont =
    editorFonts.fonts.find(
      (font) => font.id === (currentTextStyleAttrs.fontId ?? defaultRenderFont.id),
    ) ?? defaultRenderFont;
  const documentFontIds = useMemo(
    () => collectEditorDocumentFontIds(editorDocument),
    [editorDocument],
  );
  const documentFontIdsKey = documentFontIds.join("\u0000");
  useEffect(() => {
    void editorFonts.ensureFontLoaded(selectedRenderFont.id);
    for (const fontId of documentFontIds) void editorFonts.ensureFontLoaded(fontId);
  }, [documentFontIdsKey, editorFonts.ensureFontLoaded, selectedRenderFont.id]);
  const selectedFontSize =
    currentTextStyleAttrs.fontSize ??
    (currentTextBlock.type === "heading"
      ? editorHeadingTextStyleAttrs(currentTextBlock.attrs).fontSize
      : config.textFontSize);
  const selectedLineHeight = currentTextStyleAttrs.lineHeight ?? baseLineHeightScale(config);
  const shouldPaintSelection = isEditorInputFocused || isSelectionExpanded(selection);
  const editorRenderContract = useMemo(
    () =>
      createSkrivaHeadlessRenderModel({
        logicLayer: tiptapEditor ?? createStaticLogicLayer(editorDocument),
        page: config.page,
        measurer: editorTextMeasurer,
        profile: editorRenderProfile,
        enrichments: documentExtensions,
        rootStyle: { gap: EDITOR_ROOT_BLOCK_GAP },
        paragraphStyle: { flexDirection: "column" },
        extraChildren,
      }),
    [
      config.page,
      documentExtensions,
      editorDocument,
      editorRenderProfile,
      editorTextMeasurer,
      extraChildren,
      tiptapEditor,
    ],
  );
  const editorRenderInspection = useMemo(
    () => inspectSkrivaHeadlessRenderModel(editorRenderContract),
    [editorRenderContract],
  );
  const renderDocument = editorRenderInspection.documentSceneGraph;
  const canvasRenderers = editorRenderInspection.canvasRenderers;
  const canvasScene = useMemo(
    () => editorRenderContract.createCanvasScene({ pageGap: config.pageGap }),
    [config.pageGap, editorRenderContract],
  );
  const canvasTextPaint = useMemo(() => {
    if (canvasTextMode !== "native") return editorRenderInspection.canvasTextPaint;

    return (...args: Parameters<typeof editorRenderInspection.canvasTextPaint>) => {
      const paint = editorRenderInspection.canvasTextPaint(...args);
      return {
        ...paint,
        outlineFont: undefined,
        pixelSnap: config.outlinePixelSnap ?? 1,
      };
    };
  }, [canvasTextMode, config.outlinePixelSnap, editorRenderInspection.canvasTextPaint]);
  const clipboardAdapter = useMemo(() => createPlainTextClipboardAdapter(), []);
  const browserInputAdapter = useMemo(
    () => createTextareaBrowserInputAdapter({ input: () => inputRef.current }),
    [],
  );
  const surfaceAdapter = useMemo(
    () =>
      tiptapEditor === null
        ? undefined
        : createSkrivaSurfaceAdapter({
            editor: tiptapEditor,
            clipboard: clipboardAdapter,
            projectSelection: createProjectSurfaceSelection(tiptapEditor),
            projectWordSelection: createProjectSurfaceWordSelection(tiptapEditor),
            projectLineSelection: createProjectSurfaceLineSelection(tiptapEditor),
          }),
    [clipboardAdapter, tiptapEditor],
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
    if (tiptapEditor === null) return;

    const syncSessionFromTiptap = () => {
      scheduleTiptapProjectionSync();
    };

    tiptapEditor.on("update", syncSessionFromTiptap);
    tiptapEditor.on("selectionUpdate", syncSessionFromTiptap);
    return () => {
      tiptapEditor.off("update", syncSessionFromTiptap);
      tiptapEditor.off("selectionUpdate", syncSessionFromTiptap);
    };
  }, [scheduleTiptapProjectionSync, tiptapEditor]);

  useEffect(
    () => () => {
      const frame = tiptapProjectionFrameRef.current;
      if (frame === undefined || typeof window === "undefined") return;
      window.cancelAnimationFrame(frame);
    },
    [],
  );

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
    const scale = canvasBitmapScale;
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(scale, 0, 0, scale, 0, 0);
    Canvas(domCanvasSurface(context, editorCanvasFont), {
      pageBackground,
      pageGap: config.pageGap,
      extensions: canvasRenderers,
      text: canvasTextPaint,
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
    canvasBitmapScale,
    canvasTextPaint,
    editorCanvasFont,
    editorRenderMeasureText,
    isEditorInputFocused,
    shouldPaintSelection,
    renderDocument,
    selection,
    config.page,
    config.pageGap,
    showPageMarginGuides,
  ]);

  function updateSelectedFont(fontId: string) {
    const requestId = fontChangeRequestRef.current + 1;
    fontChangeRequestRef.current = requestId;
    editorFonts.setSelectedFontId(fontId);
    void editorFonts.ensureFontLoaded(fontId).then(() => {
      if (fontChangeRequestRef.current !== requestId) return;
      runTiptapCommand("setFontFamily", fontId);
    });
    focusKeyboardBridge();
  }

  function updateSelectedFontSize(fontSize: number) {
    runTiptapCommand("setFontSize", fontSize);
    focusKeyboardBridge();
  }

  function updateSelectedLineHeight(lineHeight: number) {
    runTiptapCommand("setLineHeight", lineHeight);
    focusKeyboardBridge();
  }

  function toggleSelectedBold() {
    toggleSelectedMark("bold", (doc, currentSelection) => ({ doc, selection: currentSelection }));
  }

  const toggleSelectedMark: UseEditorInputOptions["toggleMark"] = (type, mutate, attrs = {}) => {
    void mutate;
    const commandName = toggleMarkCommandName(type);
    if (commandName !== undefined) {
      if (Object.keys(attrs).length === 0) {
        runTiptapCommand(commandName);
      } else {
        runTiptapCommand(commandName, attrs);
      }
    }
    focusKeyboardBridge();
  };

  function updateSelectedColor(color: string) {
    setSelectedColor(color);
    runTiptapCommand("setColor", color);
    focusKeyboardBridge();
  }

  function updateSelectedBlockStyle(style: "paragraph" | "heading-1" | "heading-2" | "heading-3") {
    if (style === "paragraph") {
      runTiptapCommand("setParagraph");
    } else {
      runTiptapCommand("setHeading", { level: Number(style.at(-1)) });
    }
    focusKeyboardBridge();
  }

  function toggleSelectedBlockquote() {
    runTiptapCommand("toggleBlockquote");
    focusKeyboardBridge();
  }

  function insertHorizontalRule() {
    runTiptapCommand("setHorizontalRule");
    focusKeyboardBridge();
  }

  function insertBlankTable() {
    runTiptapCommand("insertTable", { rows: 4, cols: 3, withHeaderRow: false });
    focusKeyboardBridge();
  }

  function insertPageBreak() {
    const currentPage = lastPage();
    const remainingHeight =
      currentPage === undefined
        ? config.page.height
        : currentPage.content.y + currentPage.content.height - lastPageContentBottomY(currentPage);
    const spacerHeight = pageBreakSpacerHeightForRemainingPage({
      remainingHeight,
      precedingBlockGap:
        currentPage === undefined || currentPage.nodes.length === 0 ? 0 : EDITOR_ROOT_BLOCK_GAP,
    });

    const fontId = currentTextStyleAttrs.fontId;
    runTiptapCommand("insertPageBreak", { spacerHeight });
    if (fontId !== undefined) runTiptapCommand("setFontFamily", fontId);
    focusKeyboardBridge();
  }

  function runTiptapCommand(commandName: string, ...args: unknown[]) {
    const chain = tiptapEditor?.chain().focus() as unknown as
      | (Record<string, (...commandArgs: unknown[]) => { run: () => boolean }> & {
          run: () => boolean;
        })
      | undefined;
    const command = chain?.[commandName];
    if (command === undefined) return false;
    return command(...args).run();
  }

  function runTiptapTableCommand(commandName: string) {
    runTiptapCommand(commandName);
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

  function updateSelection(
    nextSelection: EditorSelection | ((currentSelection: EditorSelection) => EditorSelection),
  ) {
    const resolved = typeof nextSelection === "function" ? nextSelection(selection) : nextSelection;
    if (inputRef.current !== null) inputRef.current.value = "";
    if (resolved.anchor !== undefined) {
      surfaceAdapter?.placeSelectionAt(resolved.anchor);
      surfaceAdapter?.extendSelectionTo(resolved);
    } else {
      surfaceAdapter?.placeSelectionAt(resolved);
    }
    scheduleTiptapProjectionSync();
  }

  const movement = useEditorMovement({
    canvasRef,
    editorDocument: editorDocument as UseEditorMovementOptions["editorDocument"],
    renderDocument,
    renderLineOptions: editorRenderLineOptions,
    measureText: editorRenderMeasureText,
    currentSelection: () => selection,
    updateSelection,
    surfaceAdapter,
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

  function handleSurfaceDragOver(event: DragEvent<HTMLElement>) {
    if (!surfaceDropHandlersCanDrop(config.surfaceDropHandlers, event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  async function handleSurfaceDrop(event: DragEvent<HTMLElement>) {
    const handlers = config.surfaceDropHandlers?.filter((handler) => handler.canDrop(event)) ?? [];
    if (handlers.length === 0) return;

    event.preventDefault();
    for (const handler of handlers) {
      const handled = await handler.drop(event, { focusEditor: focusKeyboardBridge });
      if (handled) {
        focusKeyboardBridge();
        return;
      }
    }
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
    editorDocument: editorDocument as UseEditorInputOptions["editorDocument"],
    keymap: config.keymap,
    measureText: editorRenderMeasureText,
    renderDocument,
    renderLineOptions: editorRenderLineOptions,
    suppressedBeforeInputRef,
    browserInput: browserInputAdapter,
    surfaceAdapter,
    updateSelection,
    toggleBold: toggleSelectedBold,
    toggleMark: toggleSelectedMark,
    toggleBlockquote: toggleSelectedBlockquote,
    setBlockType: (type, attrs = {}) => {
      if (type === "paragraph") {
        runTiptapCommand("setParagraph");
      } else {
        runTiptapCommand("setHeading", attrs);
      }
      focusKeyboardBridge();
    },
  });

  return {
    canvasRef,
    canvasBitmapScale,
    canvasTextMode: canvasTextMode ?? "outline",
    configPageGap: config.pageGap,
    canvasSelection: selection,
    cursorPosition: selection,
    editorDocument,
    disabledMarks,
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
    handleSurfaceDragOver,
    handleSurfaceDrop,
    inputRef,
    renderModel: editorRenderContract,
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
    insertTableColumnAfter: () => runTiptapTableCommand("addColumnAfter"),
    insertTableColumnBefore: () => runTiptapTableCommand("addColumnBefore"),
    insertTableRowAfter: () => runTiptapTableCommand("addRowAfter"),
    insertTableRowBefore: () => runTiptapTableCommand("addRowBefore"),
    deleteCurrentTable: () => runTiptapTableCommand("deleteTable"),
    deleteCurrentTableColumn: () => runTiptapTableCommand("deleteColumn"),
    deleteCurrentTableRow: () => runTiptapTableCommand("deleteRow"),
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

export type UseSkrivaEditorReturn = ReturnType<typeof useSkrivaEditor>;

function surfaceDropHandlersCanDrop(
  handlers: SkrivaEditorSurfaceDropHandler[] | undefined,
  event: DragEvent<HTMLElement>,
) {
  return handlers?.some((handler) => handler.canDrop(event)) ?? false;
}

function collectEditorDocumentFontIds(doc: JSONContent): string[] {
  const fontIds = new Set<string>();
  collectEditorNodeFontIds(doc, fontIds);
  return [...fontIds].sort();
}

function collectEditorNodeFontIds(node: JSONContent, fontIds: Set<string>) {
  for (const mark of node.marks ?? []) {
    const fontId = mark.attrs?.fontId;
    if (typeof fontId === "string") fontIds.add(fontId);
  }
  for (const child of node.content ?? []) collectEditorNodeFontIds(child, fontIds);
}

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

function baseLineHeightScale(config: SkrivaEditorConfig) {
  return config.textLineHeight / config.textFontSize;
}

function normalizeLineHeightOptions(options: number[] | undefined, selectedLineHeight: number) {
  return [...new Set([...(options ?? []), selectedLineHeight])]
    .filter((lineHeight) => Number.isFinite(lineHeight) && lineHeight > 0)
    .sort((left, right) => left - right);
}

function toggleMarkCommandName(type: string) {
  const commands: Record<string, string> = {
    bold: "toggleBold",
    italic: "toggleItalic",
    underline: "toggleUnderline",
    strike: "toggleStrike",
    code: "toggleCode",
    highlight: "toggleHighlight",
    subscript: "toggleSubscript",
    superscript: "toggleSuperscript",
  };

  return commands[type];
}

function uniqueTiptapExtensions(extensions: NonNullable<UseEditorOptions["extensions"]>) {
  const seen = new Set<string>();
  return extensions.filter((extension) => {
    const name = extension.name;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

type TiptapProjection = {
  document: JSONContent;
  selection: EditorSelection;
  storedMarks: EditorMarkSpec[];
  disabledMarks: string[];
};

function createTiptapProjection(
  editor: Editor | null,
  fallbackDocument: JSONContent,
): TiptapProjection {
  if (editor === null) {
    return {
      document: fallbackDocument,
      selection: { path: [0, 0], offset: 0 },
      storedMarks: [],
      disabledMarks: [],
    };
  }

  return {
    document: editor.getJSON(),
    selection: proseMirrorSelectionToSurfaceSelection(editor.state.selection) ?? {
      path: [0, 0],
      offset: 0,
    },
    storedMarks: proseMirrorMarksToEditorMarks(editor.state.storedMarks ?? []),
    disabledMarks: [],
  };
}

function proseMirrorMarksToEditorMarks(marks: readonly unknown[]): EditorMarkSpec[] {
  return marks.flatMap((mark) => {
    const type = (mark as { type?: { name?: unknown } }).type?.name;
    if (typeof type !== "string") return [];

    const attrs = (mark as { attrs?: unknown }).attrs;
    return [
      {
        type,
        ...(isRecord(attrs) && Object.keys(attrs).length > 0 ? { attrs } : {}),
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createStaticLogicLayer(document: JSONContent) {
  return {
    getJSON: () => document,
  };
}

function createDefaultTiptapDocument(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Skriva" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Deterministic paginated rendering for Tiptap state.",
          },
        ],
      },
    ],
  };
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

function useCanvasBitmapScale(multiplier: number) {
  const [scale, setScale] = useState(() => currentCanvasBitmapScale(multiplier));

  useEffect(() => {
    let media: MediaQueryList | undefined;

    function update() {
      setScale(currentCanvasBitmapScale(multiplier));
    }

    function subscribeDprChange() {
      media?.removeEventListener("change", handleDprChange);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener("change", handleDprChange);
    }

    function handleDprChange() {
      update();
      subscribeDprChange();
    }

    update();
    subscribeDprChange();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      media?.removeEventListener("change", handleDprChange);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [multiplier]);

  return scale;
}

function currentCanvasBitmapScale(multiplier: number) {
  if (typeof window === "undefined") return Math.max(1, multiplier);

  const pixelRatio = window.devicePixelRatio || 1;
  const viewportScale = window.visualViewport?.scale ?? 1;
  const scale = pixelRatio * viewportScale * Math.max(1, multiplier);
  return Math.min(4, Math.max(1, Number(scale.toFixed(3))));
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
