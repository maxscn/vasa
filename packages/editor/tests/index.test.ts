// @vitest-environment happy-dom
import { buildCanvasScene, type CanvasNode, type CanvasScene } from "@vasa/canvas";
import { generateHTML, generateJSON, getSchema } from "@vasa/core";
import { createFontStrikeoutStyle, createStandardFontMetrics, type VasaFont } from "@vasa/font";
import { layoutDocument, type LayoutResult } from "@vasa/layout";
import { createRenderDocument, type TextOutlineFont } from "@vasa/renderer";
import { analyzeWebGlScene } from "@vasa/webgl";
import { expect, test } from "vite-plus/test";
import { applyEditorKeymap, type EditorKeymapOptions } from "../react/keymap.ts";
import {
  createBarebonesEditorExtensions,
  createEditorCanvasTextMeasurer,
  currentEditorTextStyleAttrs,
  createEditorLayoutTree,
  deleteByGranularity,
  deleteBackward,
  deleteForward,
  deleteLeft,
  deleteRange,
  deleteRight,
  deleteCurrentTable,
  deleteCurrentTableColumn,
  deleteCurrentTableRow,
  ensureParagraphAfterCurrentTable,
  getSelectedText,
  getSelectedContent,
  getSelectedHtml,
  findCaretRect,
  applyKeyboardIntent,
  applyEditorControllerAction,
  applyTextStyleToSelection,
  createEditorSession,
  createEditorRenderResolveTextStyle,
  insertAt,
  insertTextInEditorSession,
  insertEditorContent,
  insertPageBreakAtDocumentEnd,
  insertTableColumnAfter,
  insertTableColumnBefore,
  insertTableRowAfter,
  insertTableRowBefore,
  insertText,
  insertTextWithMarks,
  isMarkActive,
  isSelectionInsideEditorNodeType,
  isSelectionPointAtCurrentTableEnd,
  moveSelection,
  moveSelectionHorizontally,
  moveSelectionHorizontallyByKeyboard,
  moveSelectionVertically,
  parseEditorHtml,
  pointToEditorSelection,
  runEditorCommand,
  selectAllDocument,
  selectLineAtPoint,
  selectWordAtPoint,
  setEditorSessionTextStyle,
  updateEditorSessionSelection,
  setCurrentTextBlockType,
  setFontFamily,
  setLineHeight,
  splitParagraph,
  setColor,
  preferredSelectableFonts,
  trimTrailingInlineWhitespaceSelection,
  toggleBold,
  toggleCode,
  toggleEditorSessionMark,
  toggleHighlight,
  toggleItalic,
  toggleStrike,
  toggleSubscript,
  toggleSuperscript,
  toggleUnderline,
  undoEditorSession,
  createEditorParityDocument,
  createEditorCanvasTextPaint,
  createEditorPdfOutlineText,
  createEditorRenderDocument,
  createEditorRenderMeasureText,
  createEditorRenderTextMeasurer,
  createEditorTextStyleResolver,
  defaultEditorExtensions,
  editorCodeFontId,
  editorHeadingTextStyleAttrs,
  selectedRenderPageIndex,
  type EditorSelection,
  type EditorJson,
  type EditorRenderProfileOptions,
  type EditorRenderLineDocument,
} from "../src/index.ts";

const cursorRenderLineOptions = { pageHeight: 100 };

function fixedWidthMeasureText(text: string) {
  return text.length * 10;
}

function testFont(overrides: Partial<VasaFont>): VasaFont {
  return {
    id: "inter-400",
    family: "Inter",
    displayName: "Inter",
    cssFamily: "Inter, Arial, sans-serif",
    weight: "400",
    style: "normal",
    fallbackFamilies: ["Arial", "sans-serif"],
    data: { kind: "native" },
    ...overrides,
  };
}

const parityOutlineFont = {
  unitsPerEm: 1000,
  ascender: 750,
  descender: -250,
  source: {
    unitsPerEm: 1000,
    ascender: 750,
    descender: -250,
    charToGlyph(_character: string) {
      return {
        index: 0,
        advanceWidth: 600,
        getPath(x: number, y: number, fontSize: number) {
          return {
            commands: [
              { type: "M", x, y },
              { type: "L", x: x + fontSize * 0.5, y },
              { type: "L", x: x + fontSize * 0.5, y: y - fontSize },
              { type: "L", x, y: y - fontSize },
              { type: "Z" },
            ],
          };
        },
      };
    },
  },
} satisfies TextOutlineFont;

function outlineFontWithAdvance(advanceWidth: number): TextOutlineFont {
  return {
    unitsPerEm: 1000,
    ascender: 750,
    descender: -250,
    source: {
      unitsPerEm: 1000,
      ascender: 750,
      descender: -250,
      charToGlyph(_character: string) {
        return {
          index: 0,
          advanceWidth,
          getPath(x: number, y: number, fontSize: number) {
            return {
              commands: [
                { type: "M", x, y },
                { type: "L", x: x + fontSize * 0.5, y },
                { type: "L", x: x + fontSize * 0.5, y: y - fontSize },
                { type: "L", x, y: y - fontSize },
                { type: "Z" },
              ],
            };
          },
        };
      },
    },
  };
}

function outlineFontWithAdvanceAndRightOverhang(
  advanceWidth: number,
  rightOverhang: number,
): TextOutlineFont {
  return {
    unitsPerEm: 1000,
    ascender: 750,
    descender: -250,
    source: {
      unitsPerEm: 1000,
      ascender: 750,
      descender: -250,
      charToGlyph(_character: string) {
        return {
          index: 0,
          advanceWidth,
          getPath(x: number, y: number, fontSize: number) {
            return {
              commands: [
                { type: "M", x, y },
                { type: "L", x: x + ((advanceWidth + rightOverhang) / 1000) * fontSize, y },
                { type: "Z" },
              ],
            };
          },
        };
      },
    },
  };
}

function testOutlineFont(): VasaFont {
  const family = "Parity";
  const metrics = createStandardFontMetrics({ family });

  return testFont({
    id: "parity-400",
    family,
    displayName: family,
    cssFamily: `${family}, Arial, sans-serif`,
    data: {
      kind: "outline",
      bytes: new Uint8Array(),
      metrics,
      outlineFont: parityOutlineFont,
    },
    outlineFont: parityOutlineFont,
  });
}

function webGlParityScene(doc: EditorJson) {
  const font = testOutlineFont();
  const profile = {
    fonts: [font],
    defaultFontId: font.id,
    fallbackFont: font,
    fontSize: 16,
    lineHeight: 20,
    textColor: "#111111",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "normal" as const,
  };
  const contract = createEditorRenderDocument({
    doc,
    page: { width: 360, height: 360, margin: 24 },
    profile,
    measurer: createEditorRenderTextMeasurer(profile),
    createRenderDocument,
  });

  return buildCanvasScene(contract.renderDocument, { text: contract.canvasTextPaint });
}

function canvasTextLines(scene: CanvasScene) {
  return scene.pages.flatMap((page) => flattenCanvasTextLines(page.children));
}

function flattenCanvasTextLines(nodes: CanvasNode[]): Extract<CanvasNode, { kind: "textLine" }>[] {
  return nodes.flatMap((node) => {
    if (node.kind === "textLine") return [node];
    if (node.kind === "box") return flattenCanvasTextLines(node.children);
    return [];
  });
}

function fontSizeFromCanvasFont(font: string) {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match === null ? 0 : Number.parseFloat(match[1]);
}

function editorTiptapExtensions() {
  return [
    ...createBarebonesEditorExtensions(),
    ...defaultEditorExtensions.flatMap((extension) => extension.tiptap ?? []),
  ];
}

function renderLine(text: string, x: number, y: number, start?: number) {
  return {
    text,
    x,
    y,
    width: fixedWidthMeasureText(text),
    height: 18,
    ...(start === undefined ? {} : { start }),
  };
}

test("converts a doc with one paragraph and text into a BoxNode", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello, Vasa." }],
      },
    ],
  };

  expect(createEditorLayoutTree(doc)).toEqual({
    type: "box",
    style: { flexDirection: "column" },
    children: [
      {
        id: "0",
        type: "box",
        style: { flexDirection: "column" },
        children: [{ id: "0.0", type: "text", text: "Hello, Vasa." }],
      },
    ],
  });
});

test("joins adjacent text children deterministically", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: ", " },
          { type: "text", text: "world" },
        ],
      },
    ],
  };

  expect(createEditorLayoutTree(doc).children?.[0]).toEqual({
    id: "0",
    type: "box",
    style: { flexDirection: "column" },
    children: [{ id: "0.0", type: "text", text: "Hello, world" }],
  });
});

test("preserves styled text runs in layout conversion", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          {
            type: "text",
            text: "Vasa",
            marks: [{ type: "textStyle", attrs: { fontId: "serif" } }, { type: "bold" }],
          },
        ],
      },
    ],
  };

  expect(
    createEditorLayoutTree(doc, {
      textStyle: { font: "16px sans-serif" },
      resolveTextStyle: (attrs) =>
        attrs.fontId === "serif" ? { font: "700 18px serif", lineHeight: 24 } : undefined,
    }).children?.[0],
  ).toEqual({
    id: "0",
    type: "box",
    style: { flexDirection: "column" },
    children: [
      {
        id: "0",
        type: "inlineText",
        runs: [
          { id: "0.0", text: "Hello ", style: { font: "16px sans-serif" } },
          {
            id: "0.1",
            text: "Vasa",
            style: { font: "700 18px serif", lineHeight: 24 },
          },
        ],
        style: { font: "16px sans-serif" },
      },
    ],
  });
});

test("renders code marks without changing the current font", () => {
  const defaultFont: VasaFont = {
    id: "arimo",
    family: "Arimo",
    displayName: "Arimo",
    cssFamily: "Arimo, Arial, sans-serif",
    weight: "400",
    style: "normal",
    fallbackFamilies: ["Arial", "sans-serif"],
    data: { kind: "native" },
  };
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "const x = 1", marks: [{ type: "code" }] }],
      },
    ],
  };

  expect(
    createEditorLayoutTree(doc, {
      resolveTextStyle: createEditorRenderResolveTextStyle({
        fonts: [defaultFont],
        defaultFontId: defaultFont.id,
        fallbackFont: defaultFont,
        fontSize: 16,
        lineHeight: 16,
      }),
    }).children?.[0],
  ).toMatchObject({
    children: [
      {
        type: "text",
        style: {
          font: "normal 400 16px Arimo, Arial, sans-serif",
          backgroundColor: "#eef2f7",
        },
      },
    ],
  });
});

test("aligns code font baselines with the default editor font", () => {
  const defaultFont = testFont({
    id: "liberation-sans",
    family: "Vasa Liberation Sans",
    cssFamily: '"Vasa Liberation Sans", Arial, sans-serif',
    data: {
      kind: "native",
      metrics: createStandardFontMetrics({
        family: "Vasa Liberation Sans",
        fallbackFamilies: ["Arial", "sans-serif"],
      }),
    },
  });
  const monoFont = testFont({
    id: editorCodeFontId,
    family: "Courier New",
    cssFamily: '"Courier New", Courier, Menlo, Consolas, monospace',
    fallbackFamilies: ["Courier", "Menlo", "Consolas", "monospace"],
    data: {
      kind: "native",
      metrics: createStandardFontMetrics({
        family: "Courier New",
        fallbackFamilies: ["Courier", "Menlo", "Consolas", "monospace"],
      }),
    },
  });
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Label " },
          {
            type: "text",
            text: "code",
            marks: [
              {
                type: "textStyle",
                attrs: { fontId: editorCodeFontId, backgroundColor: "#eef2f7" },
              },
            ],
          },
        ],
      },
    ],
  };

  const paragraph = createEditorLayoutTree(doc, {
    resolveTextStyle: createEditorRenderResolveTextStyle({
      fonts: [defaultFont, monoFont],
      defaultFontId: defaultFont.id,
      fallbackFont: defaultFont,
      fontSize: 16,
      lineHeight: 16,
    }),
  }).children?.[0];
  const inline = paragraph?.type === "box" ? paragraph.children?.[0] : undefined;

  expect(inline).toMatchObject({
    type: "inlineText",
    runs: [
      { text: "Label " },
      {
        text: "code",
        style: {
          font: 'normal 400 16px "Courier New", Courier, Menlo, Consolas, monospace',
          backgroundColor: "#eef2f7",
        },
      },
    ],
  });
  expect(
    inline?.type === "inlineText" ? inline.runs[1]?.style?.baselineShift : undefined,
  ).toBeCloseTo(1.164, 3);
});

test("uses real bold font faces without faux outline emboldening", () => {
  const regularOutline = { id: "regular-outline" } as unknown as NonNullable<
    VasaFont["outlineFont"]
  >;
  const boldOutline = { id: "bold-outline" } as unknown as NonNullable<VasaFont["outlineFont"]>;
  const regular = testFont({ id: "inter-400", weight: "400", outlineFont: regularOutline });
  const bold = testFont({ id: "inter-700", weight: "700", outlineFont: boldOutline });
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Bold Inter",
            marks: [{ type: "textStyle", attrs: { fontId: "inter-400" } }, { type: "bold" }],
          },
        ],
      },
    ],
  };
  const profile = {
    fonts: [regular, bold],
    defaultFontId: "inter-400",
    fallbackFont: regular,
    fontSize: 16,
    lineHeight: 16,
  };

  expect(
    createEditorCanvasTextPaint(doc, profile, { lines: [{ sourceId: "0.0" }] }, 0),
  ).toMatchObject({
    font: "normal 700 16px Inter, Arial, sans-serif",
    outlineFont: boldOutline,
    embolden: undefined,
  });
  expect(
    createEditorPdfOutlineText(doc, profile, { sourceId: "0.0", lines: [{}] }, 0),
  ).toMatchObject({
    font: boldOutline,
    embolden: undefined,
  });
});

test("uses the resolved font face metrics for strike geometry", () => {
  const regular = testFont({
    id: "inter-400",
    weight: "400",
    data: {
      kind: "native",
      metrics: {
        ...createStandardFontMetrics({ family: "Inter" }),
        capHeight: 900,
        strikeoutPosition: 120,
        strikeoutSize: 40,
      },
    },
  });
  const bold = testFont({
    id: "inter-700",
    weight: "700",
    data: {
      kind: "native",
      metrics: {
        ...createStandardFontMetrics({ family: "Inter" }),
        capHeight: 1200,
        strikeoutPosition: 520,
        strikeoutSize: 80,
      },
    },
  });
  const profile: EditorRenderProfileOptions = {
    fonts: [regular, bold],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 20,
    lineHeight: 24,
  };
  const style = createEditorRenderResolveTextStyle(profile)({
    fontId: regular.id,
    fontWeight: "700",
    textDecorationLine: "line-through",
  });
  const expected = createFontStrikeoutStyle(bold, { fontSize: 20 });
  const regularStrikeout = createFontStrikeoutStyle(regular, { fontSize: 20 });

  expect(style.textDecorationOffset).toBeCloseTo(expected.offset, 5);
  expect(style.textDecorationThickness).toBe(expected.thickness);
  expect(style.textDecorationOffset).not.toBeCloseTo(regularStrikeout.offset, 5);
});

test("faux emboldens only when no bold face is available", () => {
  const regularOutline = { id: "regular-outline" } as unknown as NonNullable<
    VasaFont["outlineFont"]
  >;
  const regular = testFont({ id: "inter-400", weight: "400", outlineFont: regularOutline });
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Bold Inter",
            marks: [{ type: "textStyle", attrs: { fontId: "inter-400" } }, { type: "bold" }],
          },
        ],
      },
    ],
  };
  const profile = {
    fonts: [regular],
    defaultFontId: "inter-400",
    fallbackFont: regular,
    fontSize: 16,
    lineHeight: 16,
  };

  expect(
    createEditorCanvasTextPaint(doc, profile, { lines: [{ sourceId: "0.0" }] }, 0),
  ).toMatchObject({
    font: "normal 700 16px Inter, Arial, sans-serif",
    outlineFont: regularOutline,
    embolden: 1.12,
  });
});

test("uses real italic font faces for layout and paint without faux skew", () => {
  const regularOutline = outlineFontWithAdvance(1000);
  const italicOutline = outlineFontWithAdvance(500);
  const regular = testFont({ id: "inter-400", weight: "400", outlineFont: regularOutline });
  const italic = testFont({
    id: "inter-italic",
    weight: "400",
    style: "italic",
    outlineFont: italicOutline,
  });
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Italic Inter", marks: [{ type: "italic" }] }],
      },
    ],
  };
  const profile = {
    fonts: [regular, italic],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 10,
    lineHeight: 12,
    italicSkewX: 0.25,
  };

  expect(createEditorRenderResolveTextStyle(profile)({ fontStyle: "italic" })).toMatchObject({
    font: "italic 400 10px Inter, Arial, sans-serif",
  });
  expect(
    createEditorCanvasTextPaint(doc, profile, { lines: [{ sourceId: "0.0" }] }, 0),
  ).toMatchObject({
    font: "italic 400 10px Inter, Arial, sans-serif",
    outlineFont: italicOutline,
    skewX: undefined,
  });
  expect(
    createEditorPdfOutlineText(doc, profile, { sourceId: "0.0", lines: [{}] }, 0),
  ).toMatchObject({
    font: italicOutline,
    skewX: undefined,
  });
});

test("applies faux italic skew only when the italic face is synthetic", () => {
  const regularOutline = outlineFontWithAdvance(1000);
  const regular = testFont({ id: "inter-400", weight: "400", outlineFont: regularOutline });
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Synthetic italic", marks: [{ type: "italic" }] }],
      },
    ],
  };
  const profile = {
    fonts: [regular],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 10,
    lineHeight: 12,
    italicSkewX: 0.25,
  };

  expect(
    createEditorCanvasTextPaint(doc, profile, { lines: [{ sourceId: "0.0" }] }, 0),
  ).toMatchObject({
    font: "italic 400 10px Inter, Arial, sans-serif",
    outlineFont: regularOutline,
    skewX: 0.25,
  });
  expect(
    createEditorPdfOutlineText(doc, profile, { sourceId: "0.0", lines: [{}] }, 0),
  ).toMatchObject({
    font: regularOutline,
    skewX: 0.25,
  });
});

test("uses bold face plus skew for bold italic when italic bold face is unavailable", () => {
  const regularOutline = outlineFontWithAdvance(1000);
  const boldOutline = outlineFontWithAdvance(1000);
  const regular = testFont({ id: "inter-400", weight: "400", outlineFont: regularOutline });
  const bold = testFont({ id: "inter-700", weight: "700", outlineFont: boldOutline });
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "bold italic",
            marks: [{ type: "bold" }, { type: "italic" }],
          },
        ],
      },
    ],
  };
  const profile = {
    fonts: [regular, bold],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 10,
    lineHeight: 12,
    italicSkewX: 0.25,
  };
  const paint = createEditorCanvasTextPaint(doc, profile, { lines: [{ sourceId: "0.0" }] }, 0);

  expect(paint).toMatchObject({
    font: "italic 700 10px Inter, Arial, sans-serif",
    outlineFont: boldOutline,
    embolden: undefined,
    skewX: 0.25,
  });
});

test("uses real bold italic font faces without synthetic skew or emboldening", () => {
  const regularOutline = outlineFontWithAdvance(1000);
  const boldOutline = outlineFontWithAdvance(1000);
  const boldItalicOutline = outlineFontWithAdvance(1000);
  const regular = testFont({ id: "inter-400", weight: "400", outlineFont: regularOutline });
  const bold = testFont({ id: "inter-700", weight: "700", outlineFont: boldOutline });
  const boldItalic = testFont({
    id: "inter-700-italic",
    weight: "700",
    style: "italic",
    outlineFont: boldItalicOutline,
  });
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "bold italic",
            marks: [{ type: "bold" }, { type: "italic" }],
          },
        ],
      },
    ],
  };
  const profile = {
    fonts: [regular, bold, boldItalic],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 10,
    lineHeight: 12,
    italicSkewX: 0.25,
  };
  const paint = createEditorCanvasTextPaint(doc, profile, { lines: [{ sourceId: "0.0" }] }, 0);

  expect(paint).toMatchObject({
    font: "italic 700 10px Inter, Arial, sans-serif",
    outlineFont: boldItalicOutline,
    embolden: undefined,
    skewX: undefined,
  });
  expect(
    createEditorPdfOutlineText(doc, profile, { sourceId: "0.0", lines: [{}] }, 0),
  ).toMatchObject({
    font: boldItalicOutline,
    embolden: undefined,
    skewX: undefined,
  });
});

test("measures synthetic bold italic with the closest bold outline face", () => {
  const regular = testFont({
    id: "inter-400",
    weight: "400",
    outlineFont: outlineFontWithAdvance(1000),
  });
  const bold = testFont({
    id: "inter-700",
    weight: "700",
    outlineFont: outlineFontWithAdvance(2000),
  });
  const measureText = createEditorRenderMeasureText({
    fonts: [regular, bold],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 10,
    lineHeight: 12,
  });

  expect(measureText("B", "italic 700 10px Inter, Arial, sans-serif")).toBe(20);
});

test("measures positive outline ink overhang so italic runs do not cover following runs", () => {
  const regular = testFont({
    id: "arimo-400",
    family: "Arimo",
    weight: "400",
    outlineFont: outlineFontWithAdvanceAndRightOverhang(1000, 500),
  });
  const measureText = createEditorRenderMeasureText({
    fonts: [regular],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 10,
    lineHeight: 12,
  });

  expect(measureText("A", "italic 400 10px Arimo, Arial, sans-serif")).toBe(15);
});

test("measures the primary CSS font family before fallback families", () => {
  const arial = testFont({
    id: "arial",
    family: "Arial",
    displayName: "Arial",
    cssFamily: "Arial, sans-serif",
  });
  const regular = testFont({
    id: "inter-400",
    weight: "400",
    outlineFont: outlineFontWithAdvance(1000),
  });
  const bold = testFont({
    id: "inter-700",
    weight: "700",
    outlineFont: outlineFontWithAdvance(2000),
  });
  const measureText = createEditorRenderMeasureText(
    {
      fonts: [arial, regular, bold],
      defaultFontId: regular.id,
      fallbackFont: arial,
      fontSize: 10,
      lineHeight: 12,
    },
    () => 999,
  );

  expect(measureText("A", "normal 400 10px Inter, Arial, sans-serif")).toBe(10);
  expect(
    createEditorRenderMeasureText({
      fonts: [arial, regular, bold],
      defaultFontId: regular.id,
      fallbackFont: arial,
      fontSize: 10,
      lineHeight: 12,
    })("B", "italic 700 10px Inter, Arial, sans-serif"),
  ).toBe(20);
});

test("lets stylesheets extend layout and renderer text styles", () => {
  const outlineFont = outlineFontWithAdvance(1000);
  const font = testFont({ id: "inter-400", outlineFont });
  const profile = {
    fonts: [font],
    defaultFontId: font.id,
    fallbackFont: font,
    fontSize: 10,
    lineHeight: 12,
    stylesheets: [
      {
        name: "accent",
        textStyle: ({ attrs }) => (attrs.code === true ? { letterSpacing: 2 } : undefined),
        canvasTextPaint: ({ attrs }) => (attrs.code === true ? { fill: "#ef4444" } : undefined),
        pdfOutlineText: ({ attrs }) => (attrs.code === true ? { fill: "#ef4444" } : undefined),
      },
    ],
  } satisfies EditorRenderProfileOptions;
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "code", marks: [{ type: "code" }] }],
      },
    ],
  };
  const resolver = createEditorTextStyleResolver({ profile, doc });

  expect(resolver.resolveTextStyle({ code: true })).toMatchObject({ letterSpacing: 2 });
  expect(resolver.canvasTextPaint({ lines: [{ sourceId: "0.0" }] }, 0)).toMatchObject({
    fill: "#ef4444",
  });
  expect(resolver.pdfOutlineText({ sourceId: "0.0", lines: [{}] }, 0)).toMatchObject({
    fill: "#ef4444",
  });
});

test("does not shrink script text again during canvas and PDF paint resolution", () => {
  const outlineFont = outlineFontWithAdvance(1000);
  const font = testFont({ id: "inter-400", outlineFont });
  const profile = {
    fonts: [font],
    defaultFontId: font.id,
    fallbackFont: font,
    fontSize: 16,
    lineHeight: 20,
    scriptScale: 0.5,
  };
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "2", marks: [{ type: "superscript" }] }],
      },
    ],
  };
  const resolvedLine = { sourceId: "0.0", fontSize: 8 };

  expect(createEditorCanvasTextPaint(doc, profile, { lines: [resolvedLine] }, 0).fontSize).toBe(8);
  expect(
    createEditorPdfOutlineText(doc, profile, { sourceId: "0.0", lines: [resolvedLine] }, 0)
      ?.fontSize,
  ).toBe(8);
});

test("uses resolved italic faces when wrapping mixed inline text", () => {
  const regular = testFont({
    id: "inter-400",
    weight: "400",
    outlineFont: outlineFontWithAdvance(1000),
  });
  const italic = testFont({
    id: "inter-italic",
    weight: "400",
    style: "italic",
    outlineFont: outlineFontWithAdvance(500),
  });
  const profile = {
    fonts: [regular, italic],
    defaultFontId: regular.id,
    fallbackFont: regular,
    fontSize: 10,
    lineHeight: 12,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "normal" as const,
  };
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "AA " },
          { type: "text", text: "BBBB", marks: [{ type: "italic" }] },
        ],
      },
    ],
  };
  const layout = layoutDocument(
    createEditorLayoutTree(doc, {
      resolveTextStyle: createEditorRenderResolveTextStyle(profile),
      textStyle: { lineHeight: 12 },
    }),
    {
      page: { width: 50, height: 120, margin: 0 },
      measurer: createEditorRenderTextMeasurer(profile),
      textGrid: false,
    },
  );
  const textBox = layout.pages[0]?.boxes[0]?.children[0];

  expect(textBox?.visualLines).toHaveLength(1);
  expect(textBox?.visualLines?.[0]?.width).toBe(50);
});

test("converts table documents into row and cell layout containers", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                attrs: { colspan: 1, rowspan: 1 },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Feature" }] }],
              },
              {
                type: "tableHeader",
                attrs: { colspan: 1, rowspan: 1 },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Status" }] }],
              },
            ],
          },
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1 },
                content: [{ type: "paragraph", content: [{ type: "text", text: "PDF" }] }],
              },
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1, backgroundColor: "#ecfeff" },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Canvas" }] }],
              },
            ],
          },
        ],
      },
    ],
  };

  const table = createEditorLayoutTree(doc).children?.[0];

  expect(table).toMatchObject({
    id: "0",
    type: "table",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    children: [
      {
        id: "0.0",
        type: "tableRow",
        children: [
          {
            id: "0.0.0",
            type: "tableHeader",
            children: [{ type: "box", children: [{ type: "text", text: "Feature" }] }],
          },
          {
            id: "0.0.1",
            type: "tableHeader",
            children: [{ type: "box", children: [{ type: "text", text: "Status" }] }],
          },
        ],
      },
      {
        id: "0.1",
        type: "tableRow",
        children: [
          {
            id: "0.1.0",
            type: "tableCell",
            children: [{ type: "box", children: [{ type: "text", text: "PDF" }] }],
          },
          {
            id: "0.1.1",
            type: "tableCell",
            backgroundColor: "#ecfeff",
            children: [{ type: "box", children: [{ type: "text", text: "Canvas" }] }],
          },
        ],
      },
    ],
  });
});

test("inserts and deletes table rows around the selected cell", () => {
  const doc = editorTableDoc();
  const after = insertTableRowAfter(doc, { path: [0, 0, 0, 0, 0], offset: 0 });

  expect(after.selection).toEqual({ path: [0, 1, 0, 0, 0], offset: 0 });
  expect(after.doc.content?.[0]?.content).toEqual([
    tableRow(["A1", "B1"], "tableHeader"),
    tableRow(["", ""]),
    tableRow(["A2", "B2"]),
  ]);

  const before = insertTableRowBefore(doc, { path: [0, 1, 1, 0, 0], offset: 0 });
  expect(before.selection).toEqual({ path: [0, 1, 0, 0, 0], offset: 0 });
  expect(before.doc.content?.[0]?.content).toEqual([
    tableRow(["A1", "B1"], "tableHeader"),
    tableRow(["", ""]),
    tableRow(["A2", "B2"]),
  ]);

  const deleted = deleteCurrentTableRow(after.doc, { path: [0, 1, 0, 0, 0], offset: 0 });
  expect(deleted.doc).toEqual(doc);
  expect(deleted.selection).toEqual({ path: [0, 1, 0, 0, 0], offset: 0 });
});

test("inserts and deletes table columns around the selected cell", () => {
  const doc = editorTableDoc();
  const after = insertTableColumnAfter(doc, { path: [0, 0, 0, 0, 0], offset: 0 });

  expect(after.selection).toEqual({ path: [0, 0, 1, 0, 0], offset: 0 });
  expect(after.doc.content?.[0]?.content).toEqual([
    tableRow(["A1", "", "B1"], "tableHeader"),
    tableRow(["A2", "", "B2"]),
  ]);

  const before = insertTableColumnBefore(doc, { path: [0, 1, 1, 0, 0], offset: 0 });
  expect(before.selection).toEqual({ path: [0, 1, 1, 0, 0], offset: 0 });
  expect(before.doc.content?.[0]?.content).toEqual([
    tableRow(["A1", "", "B1"], "tableHeader"),
    tableRow(["A2", "", "B2"]),
  ]);

  const deleted = deleteCurrentTableColumn(after.doc, { path: [0, 0, 1, 0, 0], offset: 0 });
  expect(deleted.doc).toEqual(doc);
  expect(deleted.selection).toEqual({ path: [0, 0, 1, 0, 0], offset: 0 });
});

test("deletes the current table block", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before" }] },
      ...(editorTableDoc().content ?? []),
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ],
  };

  expect(deleteCurrentTable(doc, { path: [1, 0, 0, 0, 0], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    },
    selection: { path: [1, 0], offset: 0 },
  });
});

test("creates an editable paragraph after a terminal table", () => {
  const doc = editorTableDoc();
  const selection = { path: [0, 1, 1, 0, 0], offset: 2 };
  const exited = ensureParagraphAfterCurrentTable(doc, selection);

  expect(exited).toEqual({
    doc: {
      type: "doc",
      content: [
        ...(doc.content ?? []),
        { type: "paragraph", content: [{ type: "text", text: "" }] },
      ],
    },
    selection: { path: [1, 0], offset: 0 },
  });
  expect(isSelectionPointAtCurrentTableEnd(doc, selection, selection)).toBe(true);
});

test("enter at the gap cursor below a table inserts a paragraph below it", () => {
  const doc = editorTableDoc();

  expect(splitParagraph(doc, { path: [0], offset: 1 })).toEqual({
    doc: {
      type: "doc",
      content: [
        ...(doc.content ?? []),
        { type: "paragraph", content: [{ type: "text", text: "" }] },
      ],
    },
    selection: { path: [1, 0], offset: 0 },
  });
});

test("uses the next editable block when exiting a table with content below", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      ...(editorTableDoc().content ?? []),
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ],
  };

  expect(ensureParagraphAfterCurrentTable(doc, { path: [0, 1, 1, 0, 0], offset: 2 })).toEqual({
    doc,
    selection: { path: [1, 0], offset: 0 },
  });
});

test("applies text style attributes to a same-node selection", () => {
  const styled = applyTextStyleToSelection(
    editorDoc("Hello Vasa"),
    {
      path: [0, 0],
      offset: 10,
      anchor: { path: [0, 0], offset: 6 },
    },
    {
      fontId: "serif",
      fontSize: 18,
      fontWeight: "700",
    },
  );

  expect(styled.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          {
            type: "text",
            text: "Vasa",
            marks: [
              { type: "textStyle", attrs: { fontId: "serif", fontSize: 18, fontWeight: "700" } },
            ],
          },
        ],
      },
    ],
  });
  expect(styled.selection).toEqual({
    path: [0, 1],
    offset: 4,
    anchor: { path: [0, 0], offset: 6 },
  });
});

test("keeps a styled character selection active for additional style changes", () => {
  const first = applyTextStyleToSelection(
    editorDoc("Hello Vasa"),
    {
      path: [0, 0],
      offset: 10,
      anchor: { path: [0, 0], offset: 6 },
    },
    { fontId: "serif" },
  );
  const second = applyTextStyleToSelection(first.doc, first.selection, { fontSize: 18 });
  const third = applyTextStyleToSelection(second.doc, second.selection, { fontWeight: "700" });

  expect(third.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          {
            type: "text",
            text: "Vasa",
            marks: [
              { type: "textStyle", attrs: { fontId: "serif", fontSize: 18, fontWeight: "700" } },
            ],
          },
        ],
      },
    ],
  });
  expect(third.selection).toEqual({
    path: [0, 1],
    offset: 4,
    anchor: { path: [0, 0], offset: 6 },
  });
});

test("toggles bold as a Tiptap-style mark", () => {
  const selection = {
    path: [0, 0],
    offset: 10,
    anchor: { path: [0, 0], offset: 6 },
  };
  const bold = toggleBold(editorDoc("Hello Vasa"), selection);
  const unbold = toggleBold(bold.doc, bold.selection);

  expect(bold.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "Vasa", marks: [{ type: "bold" }] },
        ],
      },
    ],
  });
  expect(unbold.doc).toEqual(editorDoc("Hello Vasa"));
});

test("toggles DOM-style inline marks independently", () => {
  const selection = {
    path: [0, 0],
    offset: 10,
    anchor: { path: [0, 0], offset: 6 },
  };
  const italic = toggleItalic(editorDoc("Hello Vasa"), selection);
  const underline = toggleUnderline(editorDoc("Hello Vasa"), selection);
  const strike = toggleStrike(editorDoc("Hello Vasa"), selection);
  const code = toggleCode(editorDoc("Hello Vasa"), selection);
  const highlight = toggleHighlight(editorDoc("Hello Vasa"), selection, { color: "#fef08a" });

  expect(italic.doc.content?.[0]?.content?.[1]?.marks).toEqual([{ type: "italic" }]);
  expect(underline.doc.content?.[0]?.content?.[1]?.marks).toEqual([{ type: "underline" }]);
  expect(strike.doc.content?.[0]?.content?.[1]?.marks).toEqual([{ type: "strike" }]);
  expect(code.doc.content?.[0]?.content?.[1]?.marks).toEqual([{ type: "code" }]);
  expect(highlight.doc.content?.[0]?.content?.[1]?.marks).toEqual([
    { type: "highlight", attrs: { color: "#fef08a" } },
  ]);
});

test("parses browser HTML marks into the shared editor JSON model", () => {
  const json = generateJSON(
    [
      "<p>",
      "<strong>bold</strong> ",
      "<em>italic</em> ",
      "<u>under</u> ",
      "<s>strike</s> ",
      "<code>code</code> ",
      '<mark style="background-color: #fef08a">highlight</mark> ',
      "x<sup>2</sup> H<sub>2</sub>O ",
      '<span data-font-id="serif" style="font-size: 18px; color: #2563eb">styled</span>',
      "</p>",
    ].join(""),
    editorTiptapExtensions(),
  ) as EditorJson;
  const content = json.content?.[0]?.content ?? [];

  expect(content.find((node) => node.text === "bold")?.marks).toEqual([{ type: "bold" }]);
  expect(content.find((node) => node.text === "italic")?.marks).toEqual([{ type: "italic" }]);
  expect(content.find((node) => node.text === "under")?.marks).toEqual([{ type: "underline" }]);
  expect(content.find((node) => node.text === "strike")?.marks).toEqual([{ type: "strike" }]);
  expect(content.find((node) => node.text === "code")?.marks).toEqual([{ type: "code" }]);
  expect(content.find((node) => node.text === "highlight")?.marks).toEqual([
    { type: "highlight", attrs: { color: "#fef08a" } },
  ]);
  expect(content.find((node) => node.text === "2")?.marks).toEqual([{ type: "superscript" }]);
  expect(content.filter((node) => node.text === "2").at(1)?.marks).toEqual([{ type: "subscript" }]);
  expect(content.find((node) => node.text === "styled")?.marks).toEqual([
    {
      type: "textStyle",
      attrs: {
        fontId: "serif",
        fontFamily: null,
        fontSize: 18,
        lineHeight: null,
        fontWeight: null,
        fontStyle: null,
        color: "#2563eb",
        backgroundColor: null,
        textDecorationLine: null,
        textDecorationColor: null,
        verticalAlign: null,
        code: null,
      },
    },
  ]);
});

test("renders shared editor JSON marks back to browser HTML", () => {
  const html = generateHTML(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " " },
            { type: "text", text: "under", marks: [{ type: "underline" }] },
            { type: "text", text: " " },
            { type: "text", text: "code", marks: [{ type: "code" }] },
            { type: "text", text: " " },
            { type: "text", text: "highlight", marks: [{ type: "highlight" }] },
            { type: "text", text: " " },
            {
              type: "text",
              text: "styled",
              marks: [{ type: "textStyle", attrs: { fontId: "serif", fontSize: 18 } }],
            },
          ],
        },
      ],
    },
    editorTiptapExtensions(),
  );

  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain("<u>under</u>");
  expect(html).toContain("<code>code</code>");
  expect(html).toContain("<mark");
  expect(html).toContain("highlight</mark>");
  expect(html).toContain('data-font-id="serif"');
  expect(html).toContain("font-size: 18px");
});

test("combines text-style, color, and script marks in one inline run", () => {
  const selection = {
    path: [0, 0],
    offset: 10,
    anchor: { path: [0, 0], offset: 6 },
  };
  const bold = toggleBold(editorDoc("Hello Vasa"), selection);
  const italic = toggleItalic(bold.doc, bold.selection);
  const colored = setColor(italic.doc, italic.selection, "#2563eb");
  const superscript = toggleSuperscript(colored.doc, colored.selection);
  const subscript = toggleSubscript(editorDoc("Hello Vasa"), selection);

  expect(colored.doc.content?.[0]?.content?.[1]).toEqual({
    type: "text",
    text: "Vasa",
    marks: [
      { type: "bold" },
      { type: "italic" },
      { type: "textStyle", attrs: { color: "#2563eb" } },
    ],
  });
  expect(superscript.doc.content?.[0]?.content?.[1]?.marks).toContainEqual({
    type: "superscript",
  });
  expect(subscript.doc.content?.[0]?.content?.[1]?.marks).toEqual([{ type: "subscript" }]);
});

test("reports mark active only when all selected characters have the mark", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "text", text: " plain" },
        ],
      },
    ],
  };

  expect(
    isMarkActive(
      doc,
      {
        path: [0, 0],
        offset: 4,
        anchor: { path: [0, 0], offset: 0 },
      },
      "bold",
    ),
  ).toBe(true);
  expect(
    isMarkActive(
      doc,
      {
        path: [0, 1],
        offset: 6,
        anchor: { path: [0, 0], offset: 0 },
      },
      "bold",
    ),
  ).toBe(false);
});

test("reports mark active for selected marked fragments after preceding text", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "H" },
          { type: "text", text: "2", marks: [{ type: "subscript" }] },
          { type: "text", text: "O and E=mc" },
          { type: "text", text: "2", marks: [{ type: "superscript" }] },
        ],
      },
    ],
  };

  expect(
    isMarkActive(
      doc,
      { path: [0, 1], offset: 1, anchor: { path: [0, 1], offset: 0 } },
      "subscript",
    ),
  ).toBe(true);
  expect(
    isMarkActive(
      doc,
      { path: [0, 3], offset: 1, anchor: { path: [0, 3], offset: 0 } },
      "superscript",
    ),
  ).toBe(true);
  expect(
    toggleSuperscript(doc, {
      path: [0, 3],
      offset: 1,
      anchor: { path: [0, 3], offset: 0 },
    }).doc.content?.[0]?.content?.[3]?.marks,
  ).toBeUndefined();
});

test("inserts pending styled characters at a collapsed selection", () => {
  const inserted = insertTextWithMarks(editorDoc("Hello"), { path: [0, 0], offset: 5 }, "!", [
    { type: "italic" },
    { type: "bold" },
  ]);

  expect(inserted.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "!", marks: [{ type: "italic" }, { type: "bold" }] },
        ],
      },
    ],
  });
  expect(inserted.selection).toEqual({ path: [0, 1], offset: 1 });
});

test("editor sessions own pending marks, history, and undo", () => {
  const session = createEditorSession({
    doc: editorDoc("Hello"),
    selection: { path: [0, 0], offset: 5 },
  });
  const withBold = toggleEditorSessionMark(session, { type: "bold" }, toggleBold);
  const inserted = insertTextInEditorSession(withBold, "!");
  const undone = undoEditorSession(inserted);

  expect(withBold.storedMarks).toEqual([{ type: "bold" }]);
  expect(inserted.doc.content?.[0]?.content?.[1]).toEqual({
    type: "text",
    text: "!",
    marks: [{ type: "bold" }],
  });
  expect(undone.doc).toEqual(editorDoc("Hello"));
});

test("editor sessions insert unmarked text after disabling script at the cursor", () => {
  const superscript = createEditorSession({
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "2", marks: [{ type: "superscript" }] }],
        },
      ],
    },
    selection: { path: [0, 0], offset: 1 },
    storedMarks: [{ type: "superscript" }],
  });
  const subscript = createEditorSession({
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "2", marks: [{ type: "subscript" }] }],
        },
      ],
    },
    selection: { path: [0, 0], offset: 1 },
    storedMarks: [{ type: "subscript" }],
  });

  const afterSuperscript = insertTextInEditorSession(
    toggleEditorSessionMark(superscript, { type: "superscript" }, toggleSuperscript),
    "x",
  );
  const afterSubscript = insertTextInEditorSession(
    toggleEditorSessionMark(subscript, { type: "subscript" }, toggleSubscript),
    "x",
  );

  expect(afterSuperscript.doc.content?.[0]?.content).toEqual([
    { type: "text", text: "2", marks: [{ type: "superscript" }] },
    { type: "text", text: "x" },
  ]);
  expect(afterSubscript.doc.content?.[0]?.content).toEqual([
    { type: "text", text: "2", marks: [{ type: "subscript" }] },
    { type: "text", text: "x" },
  ]);
});

test("editor sessions apply text style to future or selected characters", () => {
  const collapsed = createEditorSession({
    doc: editorDoc("Hello"),
    selection: { path: [0, 0], offset: 5 },
  });
  const pending = setEditorSessionTextStyle(collapsed, { color: "#2563eb" }, (doc, selection) =>
    setColor(doc, selection, "#2563eb"),
  );
  const selected = createEditorSession({
    doc: editorDoc("Hello"),
    selection: { path: [0, 0], offset: 5, anchor: { path: [0, 0], offset: 0 } },
  });
  const colored = setEditorSessionTextStyle(selected, { color: "#2563eb" }, (doc, selection) =>
    setColor(doc, selection, "#2563eb"),
  );

  expect(pending.storedMarks).toEqual([{ type: "textStyle", attrs: { color: "#2563eb" } }]);
  expect(colored.doc.content?.[0]?.content?.[0]?.marks).toEqual([
    { type: "textStyle", attrs: { color: "#2563eb" } },
  ]);
});

test("reports current text font attributes from cursor marks and stored marks", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          {
            type: "text",
            text: "Vasa",
            marks: [{ type: "textStyle", attrs: { fontId: "lora", fontSize: 22 } }],
          },
        ],
      },
    ],
  };

  expect(currentEditorTextStyleAttrs(doc, { path: [0, 1], offset: 2 })).toMatchObject({
    fontId: "lora",
    fontSize: 22,
  });
  expect(
    currentEditorTextStyleAttrs(doc, { path: [0, 1], offset: 2 }, [
      { type: "textStyle", attrs: { fontSize: 18 } },
    ]),
  ).toMatchObject({
    fontId: "lora",
    fontSize: 18,
  });
});

test("selection changes clear pending text style toolbar state", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Styled",
            marks: [{ type: "textStyle", attrs: { fontId: "lora", fontSize: 22 } }],
          },
          { type: "text", text: " plain" },
        ],
      },
    ],
  };
  const session = createEditorSession({
    doc,
    selection: { path: [0, 0], offset: 3 },
  });
  const pending = setEditorSessionTextStyle(
    session,
    { fontSize: 18, lineHeight: 1.5 },
    (nextDoc) => ({
      doc: nextDoc,
      selection: session.selection,
    }),
  );
  const moved = updateEditorSessionSelection(pending, { path: [0, 1], offset: 2 });

  expect(
    currentEditorTextStyleAttrs(pending.doc, pending.selection, pending.storedMarks),
  ).toMatchObject({
    fontId: "lora",
    fontSize: 18,
    lineHeight: 1.5,
  });
  expect(moved.storedMarks).toEqual([]);
  expect(currentEditorTextStyleAttrs(moved.doc, moved.selection, moved.storedMarks)).toEqual({});
});

test("applies line height as a selectable text style", () => {
  const styled = setLineHeight(
    editorDoc("Hello Vasa"),
    {
      path: [0, 0],
      offset: 10,
      anchor: { path: [0, 0], offset: 6 },
    },
    1.5,
  );

  expect(styled.doc.content?.[0]?.content?.[1]?.marks).toEqual([
    { type: "textStyle", attrs: { lineHeight: 1.5 } },
  ]);
  expect(currentEditorTextStyleAttrs(styled.doc, { path: [0, 1], offset: 2 })).toMatchObject({
    lineHeight: 1.5,
  });
});

test("resolves line height multipliers against styled font size", () => {
  const defaultFont = testFont({
    id: "arimo",
    family: "Arimo",
    cssFamily: "Arimo, Arial, sans-serif",
  });
  const style = createEditorRenderResolveTextStyle({
    fonts: [defaultFont],
    defaultFontId: defaultFont.id,
    fallbackFont: defaultFont,
    fontSize: 16,
    lineHeight: 16,
  })({ fontSize: 20, lineHeight: 1.5 });

  expect(style.lineHeight).toBe(30);
});

test("reports heading level font attributes for toolbar state", () => {
  expect(editorHeadingTextStyleAttrs({ level: 1 })).toEqual({ fontSize: 32, fontWeight: "700" });
  expect(editorHeadingTextStyleAttrs({ level: 3 })).toEqual({ fontSize: 22, fontWeight: "700" });
  expect(editorHeadingTextStyleAttrs({ level: 99 })).toEqual({ fontSize: 32, fontWeight: "700" });
});

test("inserts page breaks before an editable block", () => {
  const inserted = insertPageBreakAtDocumentEnd(editorDoc("Intro"), 120);

  expect(inserted.doc.content).toEqual([
    { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
    {
      type: "paragraph",
      attrs: { pageSpacerHeight: 120 },
      content: [{ type: "text", text: "" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
  ]);
  expect(inserted.selection).toEqual({ path: [2, 0], offset: 0 });

  const heading = setCurrentTextBlockType(inserted.doc, inserted.selection, "heading", {
    level: 1,
  });

  expect(heading.doc.content?.[1]).toMatchObject({
    type: "paragraph",
    attrs: { pageSpacerHeight: 120 },
  });
  expect(heading.doc.content?.[2]).toMatchObject({
    type: "heading",
    attrs: { level: 1 },
  });
});

test("inserts page breaks with the current font ready for new text", () => {
  const inserted = insertPageBreakAtDocumentEnd(editorDoc("Intro"), 120, { fontId: "geist" });

  expect(inserted.doc.content?.[2]).toEqual({
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "",
        marks: [{ type: "textStyle", attrs: { fontId: "geist" } }],
      },
    ],
  });
  expect(currentEditorTextStyleAttrs(inserted.doc, inserted.selection)).toMatchObject({
    fontId: "geist",
  });
});

test("moves a bottom empty paragraph before typing into it", () => {
  let session = createEditorSession({
    doc: editorDoc("Bottom"),
    selection: { path: [0, 0], offset: "Bottom".length },
  });

  for (let index = 0; index < 8; index += 1) {
    session = {
      ...session,
      ...splitParagraph(session.doc, session.selection),
    };
  }

  const emptyPageIndex = editorLayoutPageIndexForPath(session.doc, session.selection.path);
  const typedSession = insertTextInEditorSession(session, "t");
  const typedPageIndex = editorLayoutPageIndexForPath(
    typedSession.doc,
    typedSession.selection.path,
  );

  expect(emptyPageIndex).toBe(1);
  expect(typedPageIndex).toBe(emptyPageIndex);
});

test("sets font family through the textStyle mark like Tiptap", () => {
  const styled = setFontFamily(
    editorDoc("Hello Vasa"),
    {
      path: [0, 0],
      offset: 10,
      anchor: { path: [0, 0], offset: 6 },
    },
    "serif",
  );

  expect(styled.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          {
            type: "text",
            text: "Vasa",
            marks: [{ type: "textStyle", attrs: { fontId: "serif" } }],
          },
        ],
      },
    ],
  });
});

test("runs editor commands through the Tiptap command bridge", () => {
  const result = runEditorCommand(
    {
      doc: editorDoc("Hello Vasa"),
      selection: {
        path: [0, 0],
        offset: 10,
        anchor: { path: [0, 0], offset: 6 },
      },
    },
    "toggleBold",
  );

  expect(result.success).toBe(true);
  expect(result.state.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "Vasa", marks: [{ type: "bold" }] },
        ],
      },
    ],
  });
});

test("runs chained Tiptap commands against Vasa selection primitives", () => {
  const result = runEditorCommand(
    {
      doc: editorDoc("Hello Vasa"),
      selection: {
        path: [0, 0],
        offset: 10,
        anchor: { path: [0, 0], offset: 6 },
      },
    },
    "setFontFamily",
    "serif",
  );

  expect(result.success).toBe(true);
  expect(result.state.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          {
            type: "text",
            text: "Vasa",
            marks: [{ type: "textStyle", attrs: { fontId: "serif" } }],
          },
        ],
      },
    ],
  });
});

test("applies text style attributes across adjacent text runs in a paragraph", () => {
  const styled = applyTextStyleToSelection(
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "Vasa", marks: [{ type: "bold" }] },
            { type: "text", text: " friend" },
          ],
        },
      ],
    },
    {
      path: [0, 0],
      offset: 3,
      anchor: { path: [0, 2], offset: 4 },
    },
    { fontSize: 18 },
  );

  expect(styled.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hel" },
          { type: "text", text: "lo ", marks: [{ type: "textStyle", attrs: { fontSize: 18 } }] },
          {
            type: "text",
            text: "Vasa",
            marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontSize: 18 } }],
          },
          { type: "text", text: " fri", marks: [{ type: "textStyle", attrs: { fontSize: 18 } }] },
          { type: "text", text: "end" },
        ],
      },
    ],
  });
  expect(styled.selection).toEqual({
    path: [0, 0],
    offset: 3,
    anchor: { path: [0, 3], offset: 4 },
  });
});

test("renders supported nested Tiptap nodes without throwing", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [
          {
            type: "heading",
            content: [{ type: "text", text: "Nested title" }],
          },
          {
            type: "unknownEmpty",
            content: [],
          },
        ],
      },
    ],
  };

  expect(createEditorLayoutTree(doc)).toEqual({
    type: "box",
    style: { flexDirection: "column" },
    children: [
      {
        id: "0",
        type: "box",
        blockquoteBorderColor: "#d1d5db",
        blockquoteBorderWidth: 3,
        style: {
          flexDirection: "column",
          padding: { left: 16 },
          margin: { vertical: 24 },
        },
        children: [
          {
            id: "0.0",
            type: "box",
            style: { flexDirection: "column", margin: { top: 10, bottom: 4 } },
            children: [
              {
                id: "0.0.0",
                type: "text",
                text: "Nested title",
              },
            ],
          },
        ],
      },
    ],
  });
});

test("renders empty headings with the heading font attributes", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [{ type: "heading", attrs: { level: 2 }, content: [] }],
  };

  expect(
    createEditorLayoutTree(doc, {
      resolveTextStyle: (attrs) => attrs,
    }),
  ).toEqual({
    type: "box",
    style: { flexDirection: "column" },
    children: [
      {
        id: "0",
        type: "box",
        style: { flexDirection: "column", margin: { top: 10, bottom: 4 } },
        children: [
          {
            id: "0.0",
            type: "text",
            text: "",
            style: { fontSize: 26, fontWeight: "700" },
          },
        ],
      },
    ],
  });
});

test("keeps underline and strikethrough in the WebGL parity geometry", () => {
  const scene = webGlParityScene({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Under", marks: [{ type: "underline" }] },
          { type: "text", text: " " },
          { type: "text", text: "Strike", marks: [{ type: "strike" }] },
        ],
      },
    ],
  });
  const lines = canvasTextLines(scene);

  expect(lines.find((line) => line.text === "Under")).toMatchObject({
    textDecorationLine: "underline",
  });
  expect(lines.find((line) => line.text === "Strike")).toMatchObject({
    textDecorationLine: "line-through",
  });
  const analysis = analyzeWebGlScene(scene);
  const underline = analysis.decorationPrimitives.find((primitive) => primitive.text === "Under");
  const strike = analysis.decorationPrimitives.find((primitive) => primitive.text === "Strike");

  expect(underline).toMatchObject({
    text: "Under",
    line: "underline",
    rect: { height: 1 },
  });
  expect(strike).toMatchObject({
    text: "Strike",
    line: "line-through",
    rect: { height: 1 },
  });
  expect(underline?.rect.y).toBeGreaterThan(lines.find((line) => line.text === "Under")?.y ?? 0);
  expect(strike?.rect.y).toBeGreaterThan(lines.find((line) => line.text === "Strike")?.y ?? 0);
});

test("keeps subscript and superscript smaller in the WebGL parity geometry", () => {
  const scene = webGlParityScene({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Base" },
          { type: "text", text: "Sub", marks: [{ type: "subscript" }] },
          { type: "text", text: "Super", marks: [{ type: "superscript" }] },
        ],
      },
    ],
  });
  const lines = canvasTextLines(scene);
  const base = lines.find((line) => line.text === "Base");
  const subscript = lines.find((line) => line.text === "Sub");
  const superscript = lines.find((line) => line.text === "Super");
  const analysis = analyzeWebGlScene(scene);
  const basePrimitive = analysis.textPrimitives.find((primitive) => primitive.text === "Base");
  const subscriptPrimitive = analysis.textPrimitives.find((primitive) => primitive.text === "Sub");
  const superscriptPrimitive = analysis.textPrimitives.find(
    (primitive) => primitive.text === "Super",
  );

  expect(fontSizeFromCanvasFont(subscript?.font ?? "")).toBeLessThan(
    fontSizeFromCanvasFont(base?.font ?? ""),
  );
  expect(fontSizeFromCanvasFont(superscript?.font ?? "")).toBeLessThan(
    fontSizeFromCanvasFont(base?.font ?? ""),
  );
  expect(subscript?.y).toBeGreaterThan(base?.y ?? 0);
  expect(superscript?.y).toBeLessThan(base?.y ?? Number.POSITIVE_INFINITY);
  expect(subscriptPrimitive?.fontSize).toBeLessThan(basePrimitive?.fontSize ?? 0);
  expect(superscriptPrimitive?.fontSize).toBeLessThan(basePrimitive?.fontSize ?? 0);
  expect(subscriptPrimitive?.bounds.height).toBeLessThan(basePrimitive?.bounds.height ?? 0);
  expect(superscriptPrimitive?.bounds.height).toBeLessThan(basePrimitive?.bounds.height ?? 0);
});

test("keeps heading text larger than body text in the WebGL parity geometry", () => {
  const scene = webGlParityScene({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Heading" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Body" }],
      },
    ],
  });
  const lines = canvasTextLines(scene);
  const heading = lines.find((line) => line.text === "Heading");
  const body = lines.find((line) => line.text === "Body");
  const analysis = analyzeWebGlScene(scene);
  const headingPrimitive = analysis.textPrimitives.find(
    (primitive) => primitive.text === "Heading",
  );
  const bodyPrimitive = analysis.textPrimitives.find((primitive) => primitive.text === "Body");

  expect(fontSizeFromCanvasFont(heading?.font ?? "")).toBeGreaterThan(
    fontSizeFromCanvasFont(body?.font ?? ""),
  );
  expect(analysis.textTriangleCount).toBeGreaterThan(0);
  expect(headingPrimitive?.fontSize).toBeGreaterThan(bodyPrimitive?.fontSize ?? 0);
  expect(headingPrimitive?.bounds.height).toBeGreaterThan(bodyPrimitive?.bounds.height ?? 0);
});

test("mutates text through editor selections", () => {
  const inserted = insertText(editorDoc("Hello"), { path: [0, 0], offset: 5 }, ", Vasa");

  expect(inserted.doc).toEqual(editorDoc("Hello, Vasa"));
  expect(inserted.selection).toEqual({ path: [0, 0], offset: 11 });

  const deleted = deleteBackward(inserted.doc, inserted.selection);

  expect(deleted.doc).toEqual(editorDoc("Hello, Vas"));
  expect(deleted.selection).toEqual({ path: [0, 0], offset: 10 });
});

test("edits text through primitive offset actions", () => {
  const doc = editorDoc("content.");

  expect(deleteLeft(doc, [0, 0], 8)).toEqual({
    doc: editorDoc("content"),
    point: { path: [0, 0], offset: 7 },
  });
  expect(deleteLeft(doc, [0, 0], 8, 6)).toEqual({
    doc: editorDoc("conten"),
    point: { path: [0, 0], offset: 6 },
  });
  expect(deleteRight(doc, [0, 0], 7)).toEqual({
    doc: editorDoc("content"),
    point: { path: [0, 0], offset: 7 },
  });
  expect(deleteRange(doc, [0, 0], 1, 4)).toEqual({
    doc: editorDoc("cent."),
    point: { path: [0, 0], offset: 1 },
  });
  expect(insertAt(editorDoc("content"), [0, 0], ".", 7)).toEqual({
    doc: editorDoc("content."),
    point: { path: [0, 0], offset: 8 },
  });
});

test("applies keyboard intents deterministically", () => {
  const doc = editorDoc("content.");
  const end = { path: [0, 0], offset: 8 };

  const backspaced = applyKeyboardIntent(doc, end, {
    type: "delete",
    direction: "backward",
    granularity: "character",
  });

  expect(backspaced).toEqual({
    doc: editorDoc("content"),
    selection: { path: [0, 0], offset: 7 },
  });
  expect(
    applyKeyboardIntent(backspaced.doc, backspaced.selection, {
      type: "insertText",
      text: ".",
    }),
  ).toEqual({
    doc,
    selection: end,
  });
  expect(
    applyKeyboardIntent(
      editorDoc("Hello content."),
      { path: [0, 0], offset: 6 },
      {
        type: "delete",
        direction: "backward",
        granularity: "word",
      },
    ),
  ).toEqual({
    doc: editorDoc("Hello ."),
    selection: { path: [0, 0], offset: 6 },
  });
});

test("simulates editor controller actions deterministically", () => {
  const initial = {
    doc: editorDoc("content."),
    selection: { path: [0, 0], offset: 8 },
  };
  const backspaced = applyEditorControllerAction(initial, { type: "backspace" });

  expect(backspaced).toEqual({
    state: {
      doc: editorDoc("content"),
      selection: { path: [0, 0], offset: 7 },
    },
  });
  expect(applyEditorControllerAction(backspaced.state, { type: "insertText", text: "." })).toEqual({
    state: initial,
  });

  const selected = {
    doc: editorDoc("Hello Vasa world"),
    selection: { path: [0, 0], offset: 10, anchor: { path: [0, 0], offset: 6 } },
  };

  expect(applyEditorControllerAction(selected, { type: "cut" })).toEqual({
    clipboardContent: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Vasa" }] }],
    },
    clipboardText: "Vasa",
    state: {
      doc: editorDoc("Hello  world"),
      selection: { path: [0, 0], offset: 6 },
    },
  });

  const selectedWithTrailingSpace = {
    doc: editorDoc("Hello Vasa world"),
    selection: { path: [0, 0], offset: 11, anchor: { path: [0, 0], offset: 6 } },
  };

  expect(applyEditorControllerAction(selectedWithTrailingSpace, { type: "cut" })).toEqual({
    clipboardContent: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Vasa" }] }],
    },
    clipboardText: "Vasa",
    state: {
      doc: editorDoc("Hello  world"),
      selection: { path: [0, 0], offset: 6 },
    },
  });

  expect(applyEditorControllerAction(selectedWithTrailingSpace, { type: "delete" })).toEqual({
    state: {
      doc: editorDoc("Hello  world"),
      selection: { path: [0, 0], offset: 6 },
    },
  });

  expect(applyEditorControllerAction(selectedWithTrailingSpace, { type: "backspace" })).toEqual({
    state: {
      doc: editorDoc("Hello  world"),
      selection: { path: [0, 0], offset: 6 },
    },
  });
});

test("splits paragraphs and moves selection within text", () => {
  const split = splitParagraph(editorDoc("Hello Vasa"), { path: [0, 0], offset: 5 });

  expect(split.doc).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: " Vasa" }] },
    ],
  });
  expect(split.selection).toEqual({ path: [1, 0], offset: 0 });
  expect(moveSelection(split.doc, { path: [1, 0], offset: 1 }, "left")).toEqual({
    path: [1, 0],
    offset: 0,
  });
  expect(moveSelection(split.doc, { path: [1, 0], offset: 0 }, "right")).toEqual({
    path: [1, 0],
    offset: 1,
  });
});

test("shift enter inserts a line break inside the current paragraph", () => {
  let session = createEditorSession({
    doc: editorDoc("Hello Vasa"),
    selection: { path: [0, 0], offset: 5 },
  });
  let prevented = false;
  let suppressedInputType = "";
  const event = {
    key: "Enter",
    shiftKey: true,
    preventDefault: () => {
      prevented = true;
    },
  } as Parameters<typeof applyEditorKeymap>[0];

  const handled = applyEditorKeymap(event, {
    editorDocument: session.doc,
    renderDocument: { pages: [] },
    renderLineOptions: { pageHeight: 100 },
    measureText: fixedWidthMeasureText,
    updateEditor: (update) => {
      session = update(session);
    },
    updateSelection: () => {},
    suppressBeforeInput: (inputType) => {
      suppressedInputType = inputType;
    },
    undo: () => {},
    redo: () => {},
    toggleBold: () => {},
    toggleMark: () => {},
    toggleBlockquote: () => {},
    setBlockType: () => {},
    insertLineBreak: () => {
      session = insertTextInEditorSession(session, "\n");
    },
    splitParagraph: () => {},
  } satisfies EditorKeymapOptions);

  expect(handled).toBe(true);
  expect(prevented).toBe(true);
  expect(suppressedInputType).toBe("insertLineBreak");
  expect(session.doc).toEqual(editorDoc("Hello\n Vasa"));
  expect(session.selection).toEqual({ path: [0, 0], offset: 6 });
});

test("enter inserts a paragraph below a table gap cursor selection", () => {
  let session = createEditorSession({
    doc: editorTableDoc(),
    selection: { path: [0], offset: 1 },
  });
  let prevented = false;
  let suppressedInputType = "";
  const event = {
    key: "Enter",
    preventDefault: () => {
      prevented = true;
    },
  } as Parameters<typeof applyEditorKeymap>[0];

  const handled = applyEditorKeymap(event, {
    editorDocument: session.doc,
    renderDocument: { pages: [] },
    renderLineOptions: { pageHeight: 100 },
    measureText: fixedWidthMeasureText,
    updateEditor: (update) => {
      session = update(session);
    },
    updateSelection: () => {},
    suppressBeforeInput: (inputType) => {
      suppressedInputType = inputType;
    },
    undo: () => {},
    redo: () => {},
    toggleBold: () => {},
    toggleMark: () => {},
    toggleBlockquote: () => {},
    setBlockType: () => {},
    insertLineBreak: () => {},
    splitParagraph: () => {
      session = {
        ...session,
        ...splitParagraph(session.doc, session.selection),
      };
    },
  } satisfies EditorKeymapOptions);

  expect(handled).toBe(true);
  expect(prevented).toBe(true);
  expect(suppressedInputType).toBe("insertParagraph");
  expect(session.doc.content?.at(-1)).toEqual({
    type: "paragraph",
    content: [{ type: "text", text: "" }],
  });
  expect(session.selection).toEqual({ path: [1, 0], offset: 0 });
});

test("splitting a styled paragraph preserves sibling text runs and marks", () => {
  const doc = createEditorParityDocument();
  const paragraph = doc.content?.[3];
  const lastRun = paragraph?.content?.[4]?.text ?? "";
  const split = splitParagraph(doc, { path: [3, 4], offset: lastRun.length });

  expect(split.doc.content?.[3]).toEqual({
    type: "paragraph",
    content: [
      { type: "text", text: "Script baselines: H" },
      { type: "text", text: "2", marks: [{ type: "subscript" }] },
      { type: "text", text: "O and E=mc" },
      { type: "text", text: "2", marks: [{ type: "superscript" }] },
      { type: "text", text: " should line up in canvas and PDF." },
    ],
  });
  expect(split.doc.content?.[4]).toEqual({
    type: "paragraph",
    content: [{ type: "text", text: "" }],
  });
  expect(split.selection).toEqual({ path: [4, 0], offset: 0 });
});

test("splits paragraphs inside blockquotes before the end without leaving the quote", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Quoted line" }],
          },
        ],
      },
    ],
  };

  const split = splitParagraph(doc, { path: [0, 0, 0], offset: 6 });

  expect(split.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Quoted" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: " line" }],
          },
        ],
      },
    ],
  });
  expect(split.selection).toEqual({ path: [0, 1, 0], offset: 0 });
});

test("pressing enter at the end of a blockquote creates an empty quote line", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted line" }] }],
      },
    ],
  };

  const split = splitParagraph(doc, { path: [0, 0, 0], offset: "Quoted line".length });

  expect(split.doc).toEqual({
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Quoted line" }] },
          { type: "paragraph", content: [{ type: "text", text: "" }] },
        ],
      },
    ],
  });
  expect(split.selection).toEqual({
    path: [0, 1, 0],
    offset: 0,
  });
});

test("pressing enter in an empty blockquote line exits the quote from the block path", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Quoted line" }] },
          { type: "paragraph", content: [{ type: "text", text: "" }] },
        ],
      },
    ],
  };

  expect(splitParagraph(doc, { path: [0, 1], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted line" }] }],
        },
        { type: "paragraph", content: [{ type: "text", text: "" }] },
      ],
    },
    selection: { path: [1, 0], offset: 0 },
  });
});

test("pressing enter in a single empty blockquote replaces it with a regular line", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
      },
    ],
  };

  expect(splitParagraph(doc, { path: [0, 0], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
    },
    selection: { path: [0, 0], offset: 0 },
  });
});

test("left from a regular line after a blockquote moves to the end of the quote", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted line" }] }],
      },
      { type: "paragraph", content: [{ type: "text", text: "" }] },
    ],
  };

  expect(moveSelection(doc, { path: [1, 0], offset: 0 }, "left")).toEqual({
    path: [0, 0, 0],
    offset: "Quoted line".length,
  });
});

test("moves selection across styled sibling text nodes", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Vasa editor " },
          {
            type: "text",
            text: "demo",
            marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontSize: 28 } }],
          },
          { type: "text", text: " after" },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "Next" }] },
    ],
  };

  expect(moveSelection(doc, { path: [0, 0], offset: 12 }, "right")).toEqual({
    path: [0, 1],
    offset: 1,
  });
  expect(moveSelection(doc, { path: [0, 1], offset: 0 }, "left")).toEqual({
    path: [0, 0],
    offset: 11,
  });
  expect(moveSelection(doc, { path: [0, 1], offset: 4 }, "right")).toEqual({
    path: [0, 2],
    offset: 1,
  });
  expect(moveSelection(doc, { path: [0, 2], offset: 0 }, "left")).toEqual({
    path: [0, 1],
    offset: 3,
  });
  expect(moveSelection(doc, { path: [0, 2], offset: 6 }, "right")).toEqual({
    path: [1, 0],
    offset: 0,
  });
});

test.each([
  { name: "underlined", marks: [{ type: "underline" }] },
  { name: "strikethrough", marks: [{ type: "strike" }] },
  { name: "yellow highlighted", marks: [{ type: "highlight", attrs: { color: "#fef08a" } }] },
  { name: "blue colored", marks: [{ type: "textStyle", attrs: { color: "#2563eb" } }] },
])("moves into a $name word without an extra boundary navigation", ({ marks }) => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "plain " },
          { type: "text", text: "styled", marks },
          { type: "text", text: " done" },
        ],
      },
    ],
  };

  expect(moveSelection(doc, { path: [0, 0], offset: 6 }, "right")).toEqual({
    path: [0, 1],
    offset: 1,
  });
  expect(moveSelection(doc, { path: [0, 1], offset: 0 }, "left")).toEqual({
    path: [0, 0],
    offset: 5,
  });
});

test("moves vertically between visual rows around styled render blocks", () => {
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "background",
            children: [
              {
                kind: "text",
                text: "plain styledtarget row",
                lines: [
                  { ...renderLine("plain ", 0, 0, 0), sourceId: "0.0", sourceText: "plain " },
                  { ...renderLine("styled", 60, 0, 0), sourceId: "0.1", sourceText: "styled" },
                  {
                    ...renderLine("target row", 0, 22, 0),
                    sourceId: "1.0",
                    sourceText: "target row",
                  },
                ],
                visualLines: [
                  {
                    x: 0,
                    y: 0,
                    width: 120,
                    height: 18,
                    fragments: [
                      { ...renderLine("plain ", 0, 0, 0), sourceId: "0.0", sourceText: "plain " },
                      { ...renderLine("styled", 60, 0, 0), sourceId: "0.1", sourceText: "styled" },
                    ],
                  },
                  {
                    x: 0,
                    y: 22,
                    width: 100,
                    height: 18,
                    fragments: [
                      {
                        ...renderLine("target row", 0, 22, 0),
                        sourceId: "1.0",
                        sourceText: "target row",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  expect(
    moveSelectionVertically(
      renderDocument,
      { path: [0, 0], offset: 6 },
      "down",
      fixedWidthMeasureText,
      cursorRenderLineOptions,
    ),
  ).toEqual({ path: [1, 0], offset: 6 });
  expect(
    moveSelectionVertically(
      renderDocument,
      { path: [1, 0], offset: 6 },
      "up",
      fixedWidthMeasureText,
      cursorRenderLineOptions,
    ),
  ).toEqual({ path: [0, 1], offset: 0 });
});

test("moves down from subscript fragments using the owning visual line", () => {
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "text",
            text: "H2Otarget",
            lines: [
              { ...renderLine("H", 0, 0, 0), sourceId: "0.0", sourceText: "H" },
              { ...renderLine("2", 10, 8, 0), sourceId: "0.1", sourceText: "2" },
              { ...renderLine("O", 20, 0, 0), sourceId: "0.2", sourceText: "O" },
              { ...renderLine("target", 0, 24, 0), sourceId: "1.0", sourceText: "target" },
            ],
            visualLines: [
              {
                x: 0,
                y: 0,
                width: 30,
                height: 18,
                fragments: [
                  { ...renderLine("H", 0, 0, 0), sourceId: "0.0", sourceText: "H" },
                  { ...renderLine("2", 10, 8, 0), sourceId: "0.1", sourceText: "2" },
                  { ...renderLine("O", 20, 0, 0), sourceId: "0.2", sourceText: "O" },
                ],
              },
              {
                x: 0,
                y: 24,
                width: 60,
                height: 18,
                fragments: [
                  { ...renderLine("target", 0, 24, 0), sourceId: "1.0", sourceText: "target" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  expect(
    moveSelectionVertically(
      renderDocument,
      { path: [0, 1], offset: 1 },
      "down",
      fixedWidthMeasureText,
      cursorRenderLineOptions,
    ),
  ).toEqual({ path: [1, 0], offset: 2 });
});

test("moves down from a strikethrough continuation without sticking at a boundary", () => {
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "text",
            text: "plain strikethroughtarget",
            lines: [
              { ...renderLine("plain ", 0, 0, 0), sourceId: "0.0", sourceText: "plain " },
              {
                ...renderLine("strike", 60, 0, 0),
                sourceId: "0.1",
                sourceText: "strikethrough",
              },
              {
                ...renderLine("through", 0, 22, 6),
                sourceId: "0.1",
                sourceText: "strikethrough",
              },
              { ...renderLine("target", 0, 44, 0), sourceId: "1.0", sourceText: "target" },
            ],
            visualLines: [
              {
                x: 0,
                y: 0,
                width: 120,
                height: 18,
                fragments: [
                  { ...renderLine("plain ", 0, 0, 0), sourceId: "0.0", sourceText: "plain " },
                  {
                    ...renderLine("strike", 60, 0, 0),
                    sourceId: "0.1",
                    sourceText: "strikethrough",
                  },
                ],
              },
              {
                x: 0,
                y: 22,
                width: 70,
                height: 18,
                fragments: [
                  {
                    ...renderLine("through", 0, 22, 6),
                    sourceId: "0.1",
                    sourceText: "strikethrough",
                  },
                ],
              },
              {
                x: 0,
                y: 44,
                width: 60,
                height: 18,
                fragments: [
                  { ...renderLine("target", 0, 44, 0), sourceId: "1.0", sourceText: "target" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const atContinuationEnd = moveSelectionVertically(
    renderDocument,
    { path: [0, 1], offset: 0 },
    "down",
    fixedWidthMeasureText,
    cursorRenderLineOptions,
  );
  const fromContinuationStart = moveSelectionVertically(
    renderDocument,
    { path: [0, 1], offset: 6 },
    "down",
    fixedWidthMeasureText,
    cursorRenderLineOptions,
  );
  const afterContinuationEnd = moveSelectionVertically(
    renderDocument,
    atContinuationEnd,
    "down",
    fixedWidthMeasureText,
    cursorRenderLineOptions,
  );

  expect(atContinuationEnd).toEqual({ path: [0, 1], offset: 12 });
  expect(fromContinuationStart).toEqual({ path: [1, 0], offset: 0 });
  expect(afterContinuationEnd).toEqual({ path: [1, 0], offset: 6 });
});

test("simulates arrow cursor movements across text runs and paragraphs", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "AB" },
          { type: "text", text: "C", marks: [{ type: "highlight", attrs: { color: "#fef08a" } }] },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "D" }] },
    ],
  };
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "background",
            children: [
              { kind: "text", sourceId: "0.0", text: "AB", lines: [renderLine("AB", 0, 0)] },
              { kind: "text", sourceId: "0.1", text: "C", lines: [renderLine("C", 20, 0)] },
              { kind: "text", sourceId: "1.0", text: "D", lines: [renderLine("D", 0, 20)] },
            ],
          },
        ],
      },
    ],
  };
  const pressArrow = (selection: { path: number[]; offset: number }, direction: "left" | "right") =>
    moveSelectionHorizontally(doc, renderDocument, selection, {
      direction,
      granularity: "character",
      renderLines: cursorRenderLineOptions,
    });

  const afterRight = ["right", "right", "right", "right"].reduce(
    (selection, direction) => pressArrow(selection, direction as "right"),
    { path: [0, 0], offset: 0 },
  );
  const afterLeft = pressArrow(afterRight, "left");

  expect(afterRight).toEqual({ path: [1, 0], offset: 0 });
  expect(afterLeft).toEqual({ path: [0, 1], offset: 1 });
});

test("moves horizontally by rendered grapheme caret stops", () => {
  const text = "a🇸🇪b";
  const doc = editorDoc(text);
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "text",
            sourceId: "0.0",
            text,
            lines: [renderLine(text, 0, 0, 0)],
          },
        ],
      },
    ],
  };

  expect(
    moveSelectionHorizontally(
      doc,
      renderDocument,
      { path: [0, 0], offset: 1 },
      {
        direction: "right",
        granularity: "character",
        renderLines: cursorRenderLineOptions,
      },
    ),
  ).toEqual({ path: [0, 0], offset: 5 });
  expect(
    moveSelectionHorizontally(
      doc,
      renderDocument,
      { path: [0, 0], offset: 5 },
      {
        direction: "left",
        granularity: "character",
        renderLines: cursorRenderLineOptions,
      },
    ),
  ).toEqual({ path: [0, 0], offset: 1 });
});

test("moves horizontally through horizontal rule boundaries", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before" }] },
      { type: "horizontalRule" },
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ],
  };
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          { kind: "text", sourceId: "0.0", text: "Before", lines: [renderLine("Before", 0, 0)] },
          {
            kind: "custom",
            sourceId: "1",
            rect: { x: 0, y: 24, width: 120, height: 8 },
            children: [],
          },
          { kind: "text", sourceId: "2.0", text: "After", lines: [renderLine("After", 0, 48)] },
        ],
      },
    ],
  };
  const move = (selection: EditorSelection, direction: "left" | "right") =>
    moveSelectionHorizontally(doc, renderDocument, selection, {
      direction,
      granularity: "character",
      renderLines: cursorRenderLineOptions,
    });

  expect(move({ path: [2, 0], offset: 0 }, "left")).toEqual({ path: [1], offset: 1 });
  expect(move({ path: [1], offset: 1 }, "left")).toEqual({ path: [1], offset: 0 });
  expect(move({ path: [1], offset: 0 }, "left")).toEqual({ path: [0, 0], offset: 6 });
  expect(move({ path: [0, 0], offset: 6 }, "right")).toEqual({ path: [1], offset: 0 });
  expect(move({ path: [1], offset: 0 }, "right")).toEqual({ path: [1], offset: 1 });
  expect(move({ path: [1], offset: 1 }, "right")).toEqual({ path: [2, 0], offset: 0 });
});

test("keeps wrapped line cursor placement right-affined inside render wrappers", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "wrapnext" }] }],
  };
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "background",
            children: [
              {
                kind: "text",
                sourceId: "0.0",
                text: "wrapnext",
                lines: [renderLine("wrap", 24, 12, 0), renderLine("next", 24, 32, 4)],
              },
            ],
          },
        ],
      },
    ],
  };

  expect(
    findCaretRect(
      renderDocument,
      { path: [0, 0], offset: 4 },
      fixedWidthMeasureText,
      cursorRenderLineOptions,
    ),
  ).toEqual({
    x: 24,
    y: 32,
    width: 2,
    height: 18,
  });
  expect(
    moveSelectionHorizontally(
      doc,
      renderDocument,
      { path: [0, 0], offset: 4 },
      {
        direction: "right",
        granularity: "line",
        renderLines: cursorRenderLineOptions,
      },
    ),
  ).toEqual({ path: [0, 0], offset: 8 });
  expect(
    moveSelectionHorizontally(
      doc,
      renderDocument,
      { path: [0, 0], offset: 4 },
      {
        direction: "left",
        granularity: "line",
        renderLines: cursorRenderLineOptions,
      },
    ),
  ).toEqual({ path: [0, 0], offset: 0 });
});

test("places real carets before and after large rendered blocks", () => {
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "custom",
            sourceId: "1",
            rect: { x: 24, y: 40, width: 320, height: 12 },
            children: [],
          },
        ],
      },
    ],
  };

  expect(
    findCaretRect(
      renderDocument,
      { path: [1], offset: 0 },
      fixedWidthMeasureText,
      cursorRenderLineOptions,
    ),
  ).toEqual({
    x: 24,
    y: 38,
    width: 20,
    height: 1,
  });
  expect(
    findCaretRect(
      renderDocument,
      { path: [1], offset: 1 },
      fixedWidthMeasureText,
      cursorRenderLineOptions,
    ),
  ).toEqual({
    x: 24,
    y: 54,
    width: 20,
    height: 1,
  });
  expect(
    pointToEditorSelection(
      renderDocument,
      { x: 28, y: 58 },
      fixedWidthMeasureText,
      cursorRenderLineOptions,
    ),
  ).toEqual({ path: [1], offset: 1 });
});

test("moves and extends horizontally to rendered line edges", () => {
  const doc = editorDoc("Hello Vasa world");
  const renderDocument: EditorRenderLineDocument = {
    pages: [
      {
        index: 0,
        nodes: [
          {
            kind: "background",
            children: [
              {
                kind: "text",
                sourceId: "0.0",
                text: "Hello Vasa world",
                lines: [renderLine("Hello", 24, 12, 0), renderLine("Vasa world", 24, 32, 6)],
              },
            ],
          },
        ],
      },
    ],
  };

  const selection = { path: [0, 0], offset: 8 };
  const rightEdge = moveSelectionHorizontally(doc, renderDocument, selection, {
    direction: "right",
    granularity: "line",
    renderLines: cursorRenderLineOptions,
  });
  const leftEdge = moveSelectionHorizontally(doc, renderDocument, selection, {
    direction: "left",
    granularity: "line",
    renderLines: cursorRenderLineOptions,
  });

  expect(rightEdge).toEqual({ path: [0, 0], offset: 16 });
  expect(leftEdge).toEqual({ path: [0, 0], offset: 6 });
  expect(
    moveSelectionHorizontallyByKeyboard(
      doc,
      renderDocument,
      selection,
      { key: "ArrowRight", ctrlKey: true, shiftKey: true },
      { direction: "right", renderLines: cursorRenderLineOptions },
    ),
  ).toEqual({
    path: [0, 0],
    offset: 16,
    anchor: { path: [0, 0], offset: 8 },
  });
});

test("replaces and deletes expanded selections", () => {
  const replaced = insertText(
    editorDoc("Hello Vasa"),
    { path: [0, 0], offset: 10, anchor: { path: [0, 0], offset: 6 } },
    "world",
  );

  expect(replaced.doc).toEqual(editorDoc("Hello world"));
  expect(replaced.selection).toEqual({ path: [0, 0], offset: 11 });

  const deleted = deleteBackward(replaced.doc, {
    path: [0, 0],
    offset: 5,
    anchor: { path: [0, 0], offset: 11 },
  });

  expect(deleted.doc).toEqual(editorDoc("Hello"));
  expect(deleted.selection).toEqual({ path: [0, 0], offset: 5 });

  const forwardDeleted = deleteForward(editorDoc("Hello world"), {
    path: [0, 0],
    offset: 11,
    anchor: { path: [0, 0], offset: 5 },
  });

  expect(forwardDeleted.doc).toEqual(editorDoc("Hello"));
  expect(forwardDeleted.selection).toEqual({ path: [0, 0], offset: 5 });
});

test("preserves inline styles while partially deleting a styled word", () => {
  const styledWords = [
    { name: "bold", marks: [{ type: "bold" }] },
    { name: "italic", marks: [{ type: "italic" }] },
    { name: "underline", marks: [{ type: "underline" }] },
    { name: "strike", marks: [{ type: "strike" }] },
    { name: "subscript", marks: [{ type: "subscript" }] },
    { name: "superscript", marks: [{ type: "superscript" }] },
    { name: "highlight", marks: [{ type: "highlight", attrs: { color: "#fef08a" } }] },
    {
      name: "textStyle",
      marks: [
        {
          type: "textStyle",
          attrs: { color: "#2563eb", backgroundColor: "#fde68a", fontSize: 18 },
        },
      ],
    },
    {
      name: "combined",
      marks: [
        { type: "bold" },
        { type: "italic" },
        { type: "underline" },
        { type: "strike" },
        { type: "subscript" },
        { type: "textStyle", attrs: { backgroundColor: "#fde68a" } },
      ],
    },
  ] satisfies Array<{ name: string; marks: NonNullable<EditorJson["marks"]> }>;

  for (const { name, marks } of styledWords) {
    const doc: EditorJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Styled", marks }],
        },
      ],
    };

    expect(deleteBackward(doc, { path: [0, 0], offset: 3 }).doc, name).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Stled", marks }],
        },
      ],
    });
    expect(deleteForward(doc, { path: [0, 0], offset: 3 }).doc, name).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Styed", marks }],
        },
      ],
    });
    expect(
      deleteBackward(doc, {
        path: [0, 0],
        offset: 4,
        anchor: { path: [0, 0], offset: 1 },
      }).doc,
      name,
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Sed", marks }],
        },
      ],
    });
  }
});

test("drops inline styles once the entire styled word is deleted", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Styled",
            marks: [
              { type: "bold" },
              { type: "italic" },
              { type: "underline" },
              { type: "strike" },
              { type: "subscript" },
              { type: "textStyle", attrs: { backgroundColor: "#fde68a" } },
            ],
          },
        ],
      },
    ],
  };

  expect(
    deleteBackward(doc, {
      path: [0, 0],
      offset: 6,
      anchor: { path: [0, 0], offset: 0 },
    }),
  ).toEqual({
    doc: editorDoc(""),
    selection: { path: [0, 0], offset: 0 },
  });
});

test("deletes selections across paragraphs", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello Vasa" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second line" }] },
    ],
  };

  const deleted = deleteBackward(doc, {
    path: [1, 0],
    offset: 6,
    anchor: { path: [0, 0], offset: 5 },
  });

  expect(deleted.doc).toEqual(editorDoc("Hello line"));
  expect(deleted.selection).toEqual({ path: [0, 0], offset: 5 });
});

test("backspace deletes empty rows and joins paragraphs", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "" }] },
      { type: "paragraph", content: [{ type: "text", text: "Vasa" }] },
    ],
  };

  const removedEmptyRow = deleteBackward(doc, { path: [1, 0], offset: 0 });

  expect(removedEmptyRow.doc).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "Vasa" }] },
    ],
  });
  expect(removedEmptyRow.selection).toEqual({ path: [0, 0], offset: 5 });

  const joined = deleteBackward(removedEmptyRow.doc, { path: [1, 0], offset: 0 });

  expect(joined.doc).toEqual(editorDoc("HelloVasa"));
  expect(joined.selection).toEqual({ path: [0, 0], offset: 5 });
});

test("backspace joins blockquote children without removing preceding blocks", () => {
  const doc = createEditorParityDocument();

  const withEmptyQuoteLine: EditorJson = {
    ...doc,
    content: [
      ...(doc.content?.slice(0, 6) ?? []),
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "" }] },
          { type: "paragraph", content: [{ type: "text", text: "After quote split" }] },
        ],
      },
    ],
  };

  const removedEmptyQuoteLine = deleteBackward(withEmptyQuoteLine, {
    path: [6, 1, 0],
    offset: 0,
  });

  expect(removedEmptyQuoteLine.doc.content?.[4]).toEqual({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: "Renderer parity heading" }],
  });
  expect(removedEmptyQuoteLine.doc.content?.[5]).toEqual({
    type: "blockquote",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Blockquote content keeps renderer geometry shared." }],
      },
    ],
  });
  expect(removedEmptyQuoteLine.doc.content?.[6]).toEqual({
    type: "blockquote",
    content: [{ type: "paragraph", content: [{ type: "text", text: "After quote split" }] }],
  });
  expect(removedEmptyQuoteLine.selection).toEqual({ path: [6, 0, 0], offset: 0 });
});

test("delete removes empty rows and joins paragraphs forward", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "" }] },
      { type: "paragraph", content: [{ type: "text", text: "Vasa" }] },
    ],
  };

  const removedEmptyRow = deleteForward(doc, { path: [0, 0], offset: 5 });

  expect(removedEmptyRow.doc).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "Vasa" }] },
    ],
  });
  expect(removedEmptyRow.selection).toEqual({ path: [0, 0], offset: 5 });

  const joined = deleteForward(removedEmptyRow.doc, { path: [0, 0], offset: 5 });

  expect(joined.doc).toEqual(editorDoc("HelloVasa"));
  expect(joined.selection).toEqual({ path: [0, 0], offset: 5 });
});

test("backspace pauses before deleting larger block components", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "horizontalRule" },
      { type: "paragraph", content: [{ type: "text", text: "" }] },
      ...(editorTableDoc().content ?? []),
      { type: "paragraph", content: [{ type: "text", text: "" }] },
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
      },
      { type: "paragraph", content: [{ type: "text", text: "" }] },
    ],
  };

  const hrLanding = deleteBackward(doc, { path: [1, 0], offset: 0 });
  expect(hrLanding.doc.content?.[0]).toEqual({ type: "horizontalRule" });
  expect(hrLanding.doc.content?.[1]).toEqual({
    type: "paragraph",
    content: [{ type: "text", text: "" }],
  });
  expect(hrLanding.selection).toEqual({ path: [0], offset: 1 });

  const deletedHr = deleteBackward(hrLanding.doc, hrLanding.selection);
  expect(deletedHr.doc.content?.[0]).toEqual({
    type: "paragraph",
    content: [{ type: "text", text: "" }],
  });
  expect(deletedHr.selection).toEqual({ path: [0, 0], offset: 0 });

  const tableLanding = deleteBackward(doc, { path: [3, 0], offset: 0 });
  expect(tableLanding.doc.content?.[2]?.type).toBe("table");
  expect(tableLanding.selection).toEqual({ path: [2], offset: 1 });
});

test("backspace after a blockquote merges editable text into the quote", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
      },
      { type: "paragraph", content: [{ type: "text", text: " after" }] },
    ],
  };

  expect(deleteBackward(doc, { path: [1, 0], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Quote after" }] }],
        },
      ],
    },
    selection: { path: [0, 0, 0], offset: "Quote".length },
  });
});

test("delete before a blockquote merges editable text into the quote", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before " }] },
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "quote" }] }],
      },
    ],
  };

  expect(deleteForward(doc, { path: [0, 0], offset: "Before ".length })).toEqual({
    doc: {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Before quote" }] }],
        },
      ],
    },
    selection: { path: [0, 0, 0], offset: "Before ".length },
  });
});

test("backspace at the start of a blockquote lifts the quote line", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
      },
    ],
  };

  expect(deleteBackward(doc, { path: [0, 0, 0], offset: 0 })).toEqual({
    doc: editorDoc("Quote"),
    selection: { path: [0, 0], offset: 0 },
  });
});

test("backspace at the first line of a multi-line blockquote keeps remaining quote lines", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "First" }] },
          { type: "paragraph", content: [{ type: "text", text: "Second" }] },
        ],
      },
    ],
  };

  expect(deleteBackward(doc, { path: [0, 0, 0], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }] },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }],
        },
      ],
    },
    selection: { path: [0, 0], offset: 0 },
  });
});

test("delete at the end of a blockquote lifts the quote line", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }],
      },
    ],
  };

  expect(deleteForward(doc, { path: [0, 0, 0], offset: "Quote".length })).toEqual({
    doc: editorDoc("Quote"),
    selection: { path: [0, 0], offset: "Quote".length },
  });
});

test("backspace after a heading preserves the heading boundary", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      { type: "paragraph", content: [{ type: "text", text: "" }] },
    ],
  };

  expect(deleteBackward(doc, { path: [1, 0], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      ],
    },
    selection: { path: [0, 0], offset: "Title".length },
  });
});

test("delete before a heading preserves the heading boundary", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
    ],
  };

  expect(deleteForward(doc, { path: [0, 0], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      ],
    },
    selection: { path: [0, 0], offset: 0 },
  });
});

test("delete pauses before deleting larger block components forward", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "" }] },
      { type: "horizontalRule" },
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ],
  };

  const landing = deleteForward(doc, { path: [0, 0], offset: 0 });
  expect(landing.doc.content?.[0]).toEqual({
    type: "paragraph",
    content: [{ type: "text", text: "" }],
  });
  expect(landing.doc.content?.[1]).toEqual({ type: "horizontalRule" });
  expect(landing.selection).toEqual({ path: [1], offset: 0 });

  const deleted = deleteForward(landing.doc, landing.selection);
  expect(deleted.doc).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "" }] },
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ],
  });
  expect(deleted.selection).toEqual({ path: [1, 0], offset: 0 });
});

test("deletes horizontal rules from either gap cursor side", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before" }] },
      { type: "horizontalRule" },
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ],
  };

  expect(deleteBackward(doc, { path: [1], offset: 0 })).toEqual({
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    },
    selection: { path: [1, 0], offset: 0 },
  });
  expect(deleteForward(doc, { path: [1], offset: 1 })).toEqual({
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    },
    selection: { path: [1, 0], offset: 0 },
  });
});

test("reads selected text for clipboard operations", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello Vasa" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second line" }] },
      { type: "paragraph", content: [{ type: "text", text: "Third paragraph" }] },
    ],
  };

  expect(
    getSelectedText(doc, { path: [0, 0], offset: 10, anchor: { path: [0, 0], offset: 6 } }),
  ).toBe("Vasa");
  expect(
    getSelectedText(doc, { path: [2, 0], offset: 5, anchor: { path: [0, 0], offset: 6 } }),
  ).toBe("Vasa\n\nSecond line\n\nThird");
  expect(getSelectedText(doc, { path: [0, 0], offset: 6 })).toBe("");
});

test("selects words and rendered lines through editor actions", () => {
  const doc = editorDoc("Hello Vasa world");

  expect(selectWordAtPoint(doc, { path: [0, 0], offset: 8 })).toEqual({
    path: [0, 0],
    offset: 10,
    anchor: { path: [0, 0], offset: 6 },
  });
  expect(
    selectLineAtPoint({ path: [0, 0], offset: 8 }, { path: [0, 0], start: 6, text: "Vasa world" }),
  ).toEqual({
    path: [0, 0],
    offset: 16,
    anchor: { path: [0, 0], offset: 6 },
  });
});

test("treats punctuation and symbols as word separators", () => {
  const doc = editorDoc("Hello,Vasa+world!");
  const renderDocument = { pages: [{ index: 0, nodes: [] }] };
  const renderLines = { pageHeight: 800 };

  expect(selectWordAtPoint(doc, { path: [0, 0], offset: 8 })).toEqual({
    path: [0, 0],
    offset: 10,
    anchor: { path: [0, 0], offset: 6 },
  });
  expect(
    deleteByGranularity(
      doc,
      { path: [0, 0], offset: 6 },
      { direction: "forward", granularity: "word" },
    ),
  ).toEqual({
    doc: editorDoc("Hello,+world!"),
    selection: { path: [0, 0], offset: 6 },
  });
  expect(
    deleteByGranularity(
      doc,
      { path: [0, 0], offset: 10 },
      { direction: "backward", granularity: "word" },
    ),
  ).toEqual({
    doc: editorDoc("Hello,+world!"),
    selection: { path: [0, 0], offset: 6 },
  });
  expect(
    moveSelectionHorizontally(
      doc,
      renderDocument,
      { path: [0, 0], offset: 0 },
      {
        direction: "right",
        granularity: "word",
        renderLines,
      },
    ),
  ).toEqual({ path: [0, 0], offset: 5 });
  expect(
    moveSelectionHorizontally(
      doc,
      renderDocument,
      { path: [0, 0], offset: 5 },
      {
        direction: "right",
        granularity: "word",
        renderLines,
      },
    ),
  ).toEqual({ path: [0, 0], offset: 10 });
  expect(
    moveSelectionHorizontally(
      doc,
      renderDocument,
      { path: [0, 0], offset: 17 },
      {
        direction: "left",
        granularity: "word",
        renderLines,
      },
    ),
  ).toEqual({ path: [0, 0], offset: 11 });
});

test("keeps symbols with the previous word when measuring editor line wraps", () => {
  const measurer = createEditorCanvasTextMeasurer((text) => text.length * 10);

  expect(
    measurer.measureText({
      text: "alpha,beta",
      font: "16px sans-serif",
      lineHeight: 12,
      maxWidth: 50,
    }).lines,
  ).toEqual([
    { text: "alpha,", start: 0, width: 60 },
    { text: "beta", start: 6, width: 40 },
  ]);
});

test("selects all document text across paragraphs and text runs", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "Vasa", marks: [{ type: "bold" }] },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Second " },
          { type: "text", text: "line" },
        ],
      },
    ],
  };

  const selection = selectAllDocument(doc);

  expect(selection).toEqual({
    path: [1, 1],
    offset: 4,
    anchor: { path: [0, 0], offset: 0 },
  });
  expect(getSelectedText(doc, selection)).toBe("Hello Vasa\n\nSecond line");
});

test("selects all document text across headings and blockquotes", () => {
  const doc = createEditorParityDocument();
  const selection = selectAllDocument(doc);

  expect(selection).toEqual({
    path: [7, 1, 1, 0, 0],
    offset: "PDF".length,
    anchor: { path: [0, 0], offset: 0 },
  });
  expect(getSelectedText(doc, selection)).toContain("Renderer parity heading");
  expect(getSelectedText(doc, selection)).toContain(
    "Blockquote content keeps renderer geometry shared.",
  );
});

test("copies and pastes selected content with block formatting", () => {
  const doc = createEditorParityDocument();
  const selection = selectAllDocument(doc);
  const content = getSelectedContent(doc, selection);

  expect(content).toEqual({
    type: "doc",
    content: [...(doc.content?.slice(0, 6) ?? []), doc.content?.[7]].filter(
      (node): node is EditorJson => node !== undefined,
    ),
  });

  expect(
    applyEditorControllerAction(
      { doc: editorDoc(""), selection: { path: [0, 0], offset: 0 } },
      { type: "paste", text: getSelectedText(doc, selection), content },
    ).state.doc,
  ).toEqual(content);

  expect(
    insertEditorContent(editorDoc("Before"), { path: [0, 0], offset: 6 }, content!).doc,
  ).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before" }] },
      ...(content?.content ?? []),
    ],
  });
});

test("pastes single-block formatted content inline", () => {
  const content: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "styled", marks: [{ type: "bold" }] }],
      },
    ],
  };

  expect(
    insertEditorContent(editorDoc("Before after"), { path: [0, 0], offset: 7 }, content),
  ).toEqual({
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before " },
            { type: "text", text: "styled", marks: [{ type: "bold" }] },
            { type: "text", text: "after" },
          ],
        },
      ],
    },
    selection: { path: [0, 1], offset: "styled".length },
  });
});

test("pastes single-block content inline at the start of a heading", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Heading" }] },
    ],
  };
  const content: EditorJson = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Pasted " }] }],
  };

  expect(insertEditorContent(doc, { path: [0, 0], offset: 0 }, content)).toEqual({
    doc: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Pasted Heading" }],
        },
      ],
    },
    selection: { path: [0, 0], offset: "Pasted ".length },
  });
});

test("pastes single-block content inline before a following heading", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before " }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Heading" }] },
    ],
  };
  const content: EditorJson = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Pasted" }] }],
  };

  expect(insertEditorContent(doc, { path: [0, 0], offset: "Before ".length }, content)).toEqual({
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Before Pasted" }],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Heading" }] },
      ],
    },
    selection: { path: [0, 0], offset: "Before Pasted".length },
  });
});

test("pastes single-block content at the end of a styled multi-run paragraph", () => {
  const doc = createEditorParityDocument();
  const paragraph = doc.content?.[3];
  const lastRun = paragraph?.content?.at(-1);
  const lastRunText = lastRun?.text ?? "";
  const content: EditorJson = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Script " }] }],
  };

  const inserted = insertEditorContent(
    doc,
    { path: [3, (paragraph?.content?.length ?? 1) - 1], offset: lastRunText.length },
    content,
  );

  expect(inserted.doc.content?.[3]).toEqual({
    type: "paragraph",
    content: [
      { type: "text", text: "Script baselines: H" },
      { type: "text", text: "2", marks: [{ type: "subscript" }] },
      { type: "text", text: "O and E=mc" },
      { type: "text", text: "2", marks: [{ type: "superscript" }] },
      { type: "text", text: `${lastRunText}Script ` },
    ],
  });
  expect(inserted.selection).toEqual({
    path: [3, 4],
    offset: lastRunText.length + "Script ".length,
  });
});

test("pastes single-block content using aggregate paragraph offsets", () => {
  const doc = createEditorParityDocument();
  const paragraphText = getSelectedText(doc, {
    path: [3, 4],
    offset: doc.content?.[3]?.content?.[4]?.text?.length ?? 0,
    anchor: { path: [3, 0], offset: 0 },
  });
  const content: EditorJson = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Script " }] }],
  };

  const inserted = insertEditorContent(doc, { path: [3], offset: paragraphText.length }, content);

  expect(inserted.selection).toEqual({
    path: [3, 4],
    offset: (doc.content?.[3]?.content?.[4]?.text?.length ?? 0) + "Script ".length,
  });
  expect(getSelectedText(inserted.doc, selectAllDocument(inserted.doc))).toContain(
    `${paragraphText}Script `,
  );
});

test("pastes leading-newline rich content as a new block", () => {
  const content: EditorJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "\nstyled", marks: [{ type: "bold" }] }],
      },
    ],
  };

  expect(
    insertEditorContent(editorDoc("Before"), { path: [0, 0], offset: 6 }, content).doc,
  ).toEqual({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before" }] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "\nstyled", marks: [{ type: "bold" }] }],
      },
    ],
  });
});

test("serializes and parses clipboard html with document formatting", () => {
  const doc = createEditorParityDocument();
  const selection = selectAllDocument(doc);
  const html = getSelectedHtml(doc, selection);

  expect(html).toContain("<h2>Renderer parity heading</h2>");
  expect(html).toContain(
    "<blockquote><p>Blockquote content keeps renderer geometry shared.</p></blockquote>",
  );
  expect(html).toContain("<table><tbody><tr><th><p>Surface</p></th><th><p>Mapping</p></th></tr>");

  const parsed = parseEditorHtml(html);
  expect(parsed).toEqual({
    type: "doc",
    content: [...(doc.content?.slice(0, 6) ?? []), doc.content?.[7]].filter(
      (node): node is EditorJson => node !== undefined,
    ),
  });
});

test("parses google-docs-style clipboard html into editor formatting", () => {
  const parsed = parseEditorHtml(`
    <meta charset="utf-8">
    <h2><span>Renderer parity heading</span></h2>
    <p><span style="font-weight: 700; font-style: italic; text-decoration: underline; color: rgb(37, 99, 235);">Styled text</span></p>
    <blockquote><p>Quoted <span style="text-decoration: line-through;">content</span></p></blockquote>
  `);

  expect(parsed).toEqual({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Renderer parity heading" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Styled text",
            marks: [
              { type: "bold" },
              { type: "italic" },
              { type: "underline" },
              { type: "textStyle", attrs: { color: "rgb(37, 99, 235)" } },
            ],
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Quoted " },
              { type: "text", text: "content", marks: [{ type: "strike" }] },
            ],
          },
        ],
      },
    ],
  });
});

test("deletes by editor action granularity", () => {
  const characterDeleted = deleteByGranularity(
    editorDoc("content."),
    {
      path: [0, 0],
      offset: 8,
    },
    {
      direction: "backward",
      granularity: "character",
    },
  );

  expect(characterDeleted.doc).toEqual(editorDoc("content"));
  expect(characterDeleted.selection).toEqual({ path: [0, 0], offset: 7 });
  expect(insertText(characterDeleted.doc, characterDeleted.selection, ".")).toEqual({
    doc: editorDoc("content."),
    selection: { path: [0, 0], offset: 8 },
  });

  const wordDeleted = deleteByGranularity(
    editorDoc("Hello Vasa world"),
    {
      path: [0, 0],
      offset: 7,
    },
    {
      direction: "forward",
      granularity: "word",
    },
  );

  expect(wordDeleted.doc).toEqual(editorDoc("Hello  world"));
  expect(wordDeleted.selection).toEqual({ path: [0, 0], offset: 6 });

  const currentWordDeleted = deleteByGranularity(
    editorDoc("Hello Vasa world"),
    {
      path: [0, 0],
      offset: 6,
    },
    {
      direction: "backward",
      granularity: "word",
    },
  );

  expect(currentWordDeleted.doc).toEqual(editorDoc("Hello  world"));
  expect(currentWordDeleted.selection).toEqual({ path: [0, 0], offset: 6 });

  const lineDeleted = deleteByGranularity(
    editorDoc("Hello Vasa world"),
    {
      path: [0, 0],
      offset: 8,
    },
    {
      direction: "forward",
      granularity: "line",
      line: { path: [0, 0], start: 6, text: "Vasa world" },
    },
  );

  expect(lineDeleted.doc).toEqual(editorDoc("Hello "));
  expect(lineDeleted.selection).toEqual({ path: [0, 0], offset: 6 });
});

test("trims accidental trailing spaces from cut selections", () => {
  const doc = editorDoc("Hello Vasa world");

  expect(
    trimTrailingInlineWhitespaceSelection(doc, {
      path: [0, 0],
      offset: 11,
      anchor: { path: [0, 0], offset: 6 },
    }),
  ).toEqual({
    path: [0, 0],
    offset: 10,
    anchor: { path: [0, 0], offset: 6 },
  });
});

test("createBarebonesEditorExtensions returns doc, paragraph, and text extensions", () => {
  expect(createBarebonesEditorExtensions().map((extension) => extension.name)).toEqual([
    "doc",
    "paragraph",
    "text",
  ]);
});

test("createBarebonesEditorExtensions can render paragraph nodes to DOM", () => {
  const schema = getSchema(createBarebonesEditorExtensions());

  expect(schema.nodes.paragraph.spec.toDOM).toBeTypeOf("function");
});

test("preferredSelectableFonts keeps one regular font per family", () => {
  const interBold = testFont({ id: "inter-700", family: "Inter", weight: "700" });
  const interRegular = testFont({ id: "inter-400", family: "Inter", weight: "400" });
  const interItalic = testFont({
    id: "inter-italic-400",
    family: "Inter",
    style: "italic",
    weight: "400",
  });

  expect(
    preferredSelectableFonts([interBold, interItalic, interRegular]).map((font) => font.id),
  ).toEqual(["inter-400"]);
});

test("isSelectionInsideEditorNodeType detects ancestor nodes", () => {
  const doc: EditorJson = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Cell" }] }],
              },
            ],
          },
        ],
      },
    ],
  };

  expect(isSelectionInsideEditorNodeType(doc, [0, 0, 0, 0, 0], "table")).toBe(true);
  expect(isSelectionInsideEditorNodeType(doc, [0, 0, 0, 0, 0], "blockquote")).toBe(false);
});

test("selectedRenderPageIndex resolves the page containing a source path", () => {
  const document = {
    pages: [
      {
        index: 3,
        nodes: [{ sourceId: "0", children: [], rect: { x: 0, y: 0, width: 10, height: 10 } }],
      },
      {
        index: 4,
        nodes: [{ sourceId: "1", children: [], rect: { x: 0, y: 0, width: 10, height: 10 } }],
      },
    ],
  } as unknown as Parameters<typeof selectedRenderPageIndex>[0];

  expect(selectedRenderPageIndex(document, [1, 0])).toBe(4);
  expect(selectedRenderPageIndex(document, [2])).toBe(3);
});

function editorDoc(text: string): EditorJson {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function editorLayoutPageIndexForPath(doc: EditorJson, path: number[]) {
  const layout = layoutDocument(
    createEditorLayoutTree(doc, {
      rootStyle: { gap: 14 },
      paragraphStyle: { flexDirection: "column" },
      textStyle: { lineHeight: 16 },
    }),
    {
      page: { width: 612, height: 246, margin: 0 },
      measurer: {
        measureText: (input) => ({
          width: input.text.length * 8,
          height: input.lineHeight,
          lineCount: 1,
          lines: [{ text: input.text, width: input.text.length * 8, start: 0 }],
        }),
      },
      textGrid: false,
    },
  );
  const sourceId = path.join(".");
  const page = layout.pages.find((candidate) => layoutPageContainsSourceId(candidate, sourceId));

  return page?.index ?? -1;
}

function layoutPageContainsSourceId(page: LayoutResult["pages"][number], sourceId: string) {
  const stack = [...page.boxes];

  while (stack.length > 0) {
    const box = stack.shift();
    if (box === undefined) continue;
    if (box.id === sourceId || sourceId.startsWith(`${box.id}.`)) return true;
    stack.push(...box.children);
  }

  return false;
}

function editorTableDoc(): EditorJson {
  return {
    type: "doc",
    content: [
      {
        type: "table",
        content: [tableRow(["A1", "B1"], "tableHeader"), tableRow(["A2", "B2"])],
      },
    ],
  };
}

function tableRow(
  texts: string[],
  cellType: "tableCell" | "tableHeader" = "tableCell",
): EditorJson {
  return {
    type: "tableRow",
    content: texts.map((text) => ({
      type: cellType,
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    })),
  };
}
