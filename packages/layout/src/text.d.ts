import type {
  AnyLayoutExtension,
  InlineTextNode,
  LayoutBox,
  LayoutTextGrid,
  LayoutExtension,
  LayoutPage,
  MeasureTextResult,
  Rect,
  TextLine,
  TextVisualLine,
  TextMeasurer,
  TextNode,
  TextStyle,
} from "./types.ts";
export declare const DEFAULT_FONT = "16px sans-serif";
export declare const DEFAULT_LINE_HEIGHT = 20;
export declare function measureTextNode(
  node: TextNode,
  measurer: TextMeasurer,
  maxWidth: number,
): MeasureTextResult;
export declare const textLayoutExtension: LayoutExtension<TextNode>;
export declare const inlineTextLayoutExtension: LayoutExtension<InlineTextNode>;
export declare const defaultLayoutExtensions: AnyLayoutExtension[];
type InlineMeasuredLine = {
  width: number;
  height: number;
  segments: InlineMeasuredSegment[];
};
type InlineMeasuredSegment = {
  sourceId?: string;
  sourceText: string;
  text: string;
  start: number;
  width: number;
  leadingGap?: number;
  trailingWhitespaceWidth?: number;
  style?: TextStyle;
};
type InlineMeasureResult = {
  width: number;
  height: number;
  lineCount: number;
  lines: InlineMeasuredLine[];
};
export declare function measureInlineTextNode(
  node: InlineTextNode,
  measurer: TextMeasurer,
  maxWidth: number,
): InlineMeasureResult;
export declare function inlineMeasuredLinesToTextLines(
  measurement: InlineMeasureResult,
  origin: {
    x: number;
    y: number;
  },
): TextLine[];
export declare function inlineMeasuredLinesToVisualLines(
  measurement: InlineMeasureResult,
  origin: {
    x: number;
    y: number;
  },
): TextVisualLine[];
export declare function inlineMeasuredLinesToTextGrid(
  measurement: InlineMeasureResult,
  origin: {
    x: number;
    y: number;
  },
  measurer: TextMeasurer,
): LayoutTextGrid;
export declare function visualLinesToTextGrid(
  visualLines: TextVisualLine[],
  measurer: TextMeasurer,
): LayoutTextGrid;
export declare function materializeTextLayoutBox(
  node: TextNode,
  rect: Rect,
  measurer: TextMeasurer,
  options?: {
    textGrid?: boolean;
  },
): LayoutBox;
export declare function splitTextForPage(
  node: TextNode,
  trial: LayoutPage,
  content: Rect,
):
  | {
      fitting: undefined;
      remaining: TextNode;
    }
  | {
      fitting: TextNode;
      remaining: TextNode;
    };
export declare function splitInlineTextForPage(
  node: InlineTextNode,
  trial: LayoutPage,
  content: Rect,
):
  | {
      fitting: undefined;
      remaining: InlineTextNode;
    }
  | {
      fitting: InlineTextNode;
      remaining: InlineTextNode;
    };
export declare function createPretextTextMeasurer(): TextMeasurer;
export declare function createMonospaceTextMeasurer(options: { charWidth: number }): TextMeasurer;
