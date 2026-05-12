import {
  layoutWithLines as layoutPretextWithLines,
  prepareWithSegments,
  type PrepareOptions,
} from "@chenglou/pretext";
import type {
  AnyLayoutExtension,
  InlineTextNode,
  LayoutBox,
  LayoutTextGrid,
  LayoutTextGridBreak,
  LayoutTextGridConnection,
  LayoutTextGridSpace,
  LayoutExtension,
  LayoutPage,
  MeasureTextResult,
  Rect,
  TextLine,
  TextVisualLine,
  TextMeasurer,
  TextNode,
  TextRun,
  TextStyle,
} from "./types.ts";

export const DEFAULT_FONT = "16px sans-serif";
export const DEFAULT_LINE_HEIGHT = 20;
const PAGE_OVERFLOW_TOLERANCE = 0.5;

export function measureTextNode(node: TextNode, measurer: TextMeasurer, maxWidth: number) {
  return measurer.measureText({
    text: node.text,
    font: node.style?.font ?? DEFAULT_FONT,
    lineHeight: node.style?.lineHeight ?? DEFAULT_LINE_HEIGHT,
    maxWidth,
    whiteSpace: node.style?.whiteSpace,
    wordBreak: node.style?.wordBreak,
    letterSpacing: node.style?.letterSpacing,
  });
}

export const textLayoutExtension: LayoutExtension<TextNode> = {
  name: "text",
  match: (node): node is TextNode => node.type === "text",
  measure({ node, measurer, maxWidth }) {
    const measurement = measureTextNode(node, measurer, maxWidth);
    return {
      width: measurement.lineCount > 1 ? maxWidth : measurement.width,
      height: measurement.height,
    };
  },
  materialize({ node, rect, measurer, textGrid }) {
    return materializeTextLayoutBox(node, rect, measurer, { textGrid });
  },
  split({ node, trial, content }) {
    return splitTextForPage(node, trial, content);
  },
};

export const inlineTextLayoutExtension: LayoutExtension<InlineTextNode> = {
  name: "inlineText",
  match: (node): node is InlineTextNode => node.type === "inlineText",
  measure({ node, measurer, maxWidth }) {
    const measurement = measureInlineTextNode(node, measurer, maxWidth);
    return {
      width: measurement.lineCount > 1 ? maxWidth : measurement.width,
      height: measurement.height,
    };
  },
  materialize({ node, rect, measurer, textGrid }) {
    const measurement = measureInlineTextNode(node, measurer, rect.width);

    return {
      id: node.id,
      type: "text",
      rect,
      text: node.runs.map((run) => run.text).join(""),
      lines: inlineMeasuredLinesToTextLines(measurement, { x: rect.x, y: rect.y }),
      visualLines: inlineMeasuredLinesToVisualLines(measurement, { x: rect.x, y: rect.y }),
      ...(textGrid === false
        ? {}
        : {
            textGrid: inlineMeasuredLinesToTextGrid(
              measurement,
              { x: rect.x, y: rect.y },
              measurer,
            ),
          }),
      children: [],
    };
  },
  split({ node, trial, content }) {
    return splitInlineTextForPage(node, trial, content);
  },
};

export const defaultLayoutExtensions: AnyLayoutExtension[] = [
  inlineTextLayoutExtension,
  textLayoutExtension,
];

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

export function measureInlineTextNode(
  node: InlineTextNode,
  measurer: TextMeasurer,
  maxWidth: number,
): InlineMeasureResult {
  const lines: InlineMeasuredLine[] = [];
  let current: InlineMeasuredLine = createInlineMeasuredLine();

  const finishLine = () => {
    trimTrailingInlineWhitespace(current, measurer);
    lines.push(current);
    current = createInlineMeasuredLine();
  };

  for (const run of node.runs) {
    const tokens = tokenizeInlineRun(run);

    for (const token of tokens) {
      if (token.text === "\n") {
        finishLine();
        continue;
      }

      const segments = measureInlineToken(token, run, node.style, measurer, maxWidth);

      for (const segment of segments) {
        if (current.segments.length === 0 && segment.text.trim().length === 0) continue;

        if (
          current.segments.length > 0 &&
          current.width + segment.width > maxWidth &&
          segment.text.trim().length > 0
        ) {
          trimTrailingInlineWhitespace(current, measurer);
          finishLine();
        }

        if (current.segments.length === 0 && segment.text.trim().length === 0) continue;

        appendInlineSegment(current, segment);
        current.height = Math.max(current.height, lineHeightForStyle(segment.style));
      }
    }
  }

  trimTrailingInlineWhitespace(current, measurer);
  if (current.segments.length > 0 || lines.length === 0) lines.push(current);

  return {
    width: lines.reduce((max, line) => Math.max(max, line.width), 0),
    height: lines.reduce((total, line) => total + line.height, 0),
    lineCount: lines.length,
    lines,
  };
}

export function inlineMeasuredLinesToTextLines(
  measurement: InlineMeasureResult,
  origin: { x: number; y: number },
): TextLine[] {
  return inlineMeasuredLinesToVisualLines(measurement, origin).flatMap((line) => line.fragments);
}

export function inlineMeasuredLinesToVisualLines(
  measurement: InlineMeasureResult,
  origin: { x: number; y: number },
): TextVisualLine[] {
  const visualLines: TextVisualLine[] = [];
  const textLines: TextLine[] = [];
  let y = origin.y;

  for (const line of measurement.lines) {
    let x = origin.x;
    textLines.length = 0;

    for (const segment of line.segments) {
      x += segment.leadingGap ?? 0;
      textLines.push({
        sourceId: segment.sourceId,
        sourceText: segment.sourceText,
        text: segment.text,
        start: segment.start,
        x,
        y: y + (segment.style?.baselineShift ?? verticalAlignOffset(segment.style)),
        width: segment.width,
        height: line.height,
        ...(segment.style?.font === undefined ? {} : { font: segment.style.font }),
        ...fontMetadata(segment.style?.font),
        ...(segment.style?.color === undefined ? {} : { color: segment.style.color }),
        ...(segment.style?.backgroundColor === undefined
          ? {}
          : { backgroundColor: segment.style.backgroundColor }),
        ...(segment.style?.textDecorationLine === undefined
          ? {}
          : { textDecorationLine: segment.style.textDecorationLine }),
        ...(segment.style?.textDecorationColor === undefined
          ? {}
          : { textDecorationColor: segment.style.textDecorationColor }),
        ...(segment.style?.textDecorationOffset === undefined
          ? {}
          : { textDecorationOffset: segment.style.textDecorationOffset }),
        ...(segment.style?.textDecorationThickness === undefined
          ? {}
          : { textDecorationThickness: segment.style.textDecorationThickness }),
        ...(segment.style?.verticalAlign === undefined
          ? {}
          : { verticalAlign: segment.style.verticalAlign }),
        ...(segment.style?.baselineShift === undefined
          ? {}
          : { baselineShift: segment.style.baselineShift }),
      });
      x += segment.width;
    }

    visualLines.push({
      x: origin.x,
      y,
      width: line.width,
      height: line.height,
      fragments: [...textLines],
    });
    y += line.height;
  }

  return visualLines;
}

export function inlineMeasuredLinesToTextGrid(
  measurement: InlineMeasureResult,
  origin: { x: number; y: number },
  measurer: TextMeasurer,
): LayoutTextGrid {
  return visualLinesToTextGrid(inlineMeasuredLinesToVisualLines(measurement, origin), measurer);
}

export function visualLinesToTextGrid(
  visualLines: TextVisualLine[],
  measurer: TextMeasurer,
): LayoutTextGrid {
  const connections: LayoutTextGridConnection[] = [];
  let previousSpace: LayoutTextGridSpace | undefined;

  const rows = visualLines.map((line, rowIndex) => {
    const spaces: LayoutTextGridSpace[] = [];

    for (const [fragmentIndex, fragment] of line.fragments.entries()) {
      const fragmentSpaces = textLineToGridSpaces(fragment, rowIndex, fragmentIndex, measurer);

      for (const space of fragmentSpaces) {
        if (previousSpace !== undefined) {
          connections.push({
            from: previousSpace.id,
            to: space.id,
            break: textGridBreakBetween(previousSpace, space),
          });
        }

        spaces.push(space);
        previousSpace = space;
      }
    }

    return {
      y: line.y,
      height: line.height,
      spaces,
    };
  });

  return { rows, connections };
}

export function materializeTextLayoutBox(
  node: TextNode,
  rect: Rect,
  measurer: TextMeasurer,
  options: { textGrid?: boolean } = {},
): LayoutBox {
  const lineHeight = node.style?.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const font = node.style?.font;
  const fontSize = parseCssFontSize(font);
  const fontWeight = parseCssFontWeight(font);
  const fontStyle = parseCssFontStyle(font);
  const measurement = measureTextNode(node, measurer, rect.width);
  const sourceText = node.sourceText ?? node.text;
  const sourceStart = node.sourceStart ?? 0;
  const sourceLineStart = (line: MeasureTextResult["lines"][number], index: number) =>
    node.sourceLineStarts?.[index] ??
    (line.start === undefined ? undefined : sourceStart + line.start);

  return {
    id: node.id,
    type: "text",
    rect,
    text: node.text,
    lines: measurement.lines.map((line, index) => ({
      text: line.text,
      ...(sourceLineStart(line, index) === undefined
        ? {}
        : { start: sourceLineStart(line, index) }),
      x: rect.x,
      y: rect.y + index * lineHeight + (node.style?.baselineShift ?? 0),
      width: line.width,
      height: lineHeight,
      ...(node.sourceText === undefined ? {} : { sourceText }),
      ...(font === undefined ? {} : { font }),
      ...(fontSize === undefined ? {} : { fontSize }),
      ...(fontWeight === undefined ? {} : { fontWeight }),
      ...(fontStyle === undefined ? {} : { fontStyle }),
      ...(node.style?.color === undefined ? {} : { color: node.style.color }),
      ...(node.style?.backgroundColor === undefined
        ? {}
        : { backgroundColor: node.style.backgroundColor }),
      ...(node.style?.textDecorationLine === undefined
        ? {}
        : { textDecorationLine: node.style.textDecorationLine }),
      ...(node.style?.textDecorationColor === undefined
        ? {}
        : { textDecorationColor: node.style.textDecorationColor }),
      ...(node.style?.textDecorationOffset === undefined
        ? {}
        : { textDecorationOffset: node.style.textDecorationOffset }),
      ...(node.style?.textDecorationThickness === undefined
        ? {}
        : { textDecorationThickness: node.style.textDecorationThickness }),
      ...(node.style?.verticalAlign === undefined
        ? {}
        : { verticalAlign: node.style.verticalAlign }),
      ...(node.style?.baselineShift === undefined
        ? {}
        : { baselineShift: node.style.baselineShift }),
    })),
    visualLines: measurement.lines.map((line, index) => {
      const fragment = {
        text: line.text,
        ...(sourceLineStart(line, index) === undefined
          ? {}
          : { start: sourceLineStart(line, index) }),
        x: rect.x,
        y: rect.y + index * lineHeight + (node.style?.baselineShift ?? 0),
        width: line.width,
        height: lineHeight,
        ...(node.sourceText === undefined ? {} : { sourceText }),
        ...(font === undefined ? {} : { font }),
        ...(fontSize === undefined ? {} : { fontSize }),
        ...(fontWeight === undefined ? {} : { fontWeight }),
        ...(fontStyle === undefined ? {} : { fontStyle }),
        ...(node.style?.color === undefined ? {} : { color: node.style.color }),
        ...(node.style?.backgroundColor === undefined
          ? {}
          : { backgroundColor: node.style.backgroundColor }),
        ...(node.style?.textDecorationLine === undefined
          ? {}
          : { textDecorationLine: node.style.textDecorationLine }),
        ...(node.style?.textDecorationColor === undefined
          ? {}
          : { textDecorationColor: node.style.textDecorationColor }),
        ...(node.style?.textDecorationOffset === undefined
          ? {}
          : { textDecorationOffset: node.style.textDecorationOffset }),
        ...(node.style?.textDecorationThickness === undefined
          ? {}
          : { textDecorationThickness: node.style.textDecorationThickness }),
        ...(node.style?.verticalAlign === undefined
          ? {}
          : { verticalAlign: node.style.verticalAlign }),
        ...(node.style?.baselineShift === undefined
          ? {}
          : { baselineShift: node.style.baselineShift }),
      };

      return {
        x: rect.x,
        y: rect.y + index * lineHeight,
        width: line.width,
        height: lineHeight,
        fragments: [fragment],
      };
    }),
    ...(options.textGrid === false
      ? {}
      : {
          textGrid: visualLinesToTextGrid(
            measurement.lines.map((line, index) => {
              const fragment = {
                sourceId: node.id,
                sourceText,
                text: line.text,
                ...(sourceLineStart(line, index) === undefined
                  ? {}
                  : { start: sourceLineStart(line, index) }),
                x: rect.x,
                y: rect.y + index * lineHeight + (node.style?.baselineShift ?? 0),
                width: line.width,
                height: lineHeight,
                ...(font === undefined ? {} : { font }),
                ...(fontSize === undefined ? {} : { fontSize }),
                ...(fontWeight === undefined ? {} : { fontWeight }),
                ...(fontStyle === undefined ? {} : { fontStyle }),
                ...(node.style?.verticalAlign === undefined
                  ? {}
                  : { verticalAlign: node.style.verticalAlign }),
                ...(node.style?.baselineShift === undefined
                  ? {}
                  : { baselineShift: node.style.baselineShift }),
              };

              return {
                x: rect.x,
                y: rect.y + index * lineHeight,
                width: line.width,
                height: lineHeight,
                fragments: [fragment],
              };
            }),
            measurer,
          ),
        }),
    children: [],
  };
}

export function splitTextForPage(node: TextNode, trial: LayoutPage, content: Rect) {
  const textBox = trial.boxes.at(-1);
  const lines = textBox?.lines ?? [];
  const pageBottom = content.y + content.height;
  const fittingLineCount = lines.filter((line) => textLineFitsPage(line, pageBottom)).length;

  if (fittingLineCount <= 0 || fittingLineCount >= lines.length) {
    return { fitting: undefined, remaining: node };
  }

  return {
    fitting: createTextFragment(node, lines.slice(0, fittingLineCount)),
    remaining: createTextFragment(node, lines.slice(fittingLineCount)),
  };
}

export function splitInlineTextForPage(node: InlineTextNode, trial: LayoutPage, content: Rect) {
  const textBox = trial.boxes.at(-1);
  const visualLines = textBox?.visualLines ?? [];
  const pageBottom = content.y + content.height;
  const fittingLineCount = visualLines.filter(
    (line) => line.y + line.height <= pageBottom + PAGE_OVERFLOW_TOLERANCE,
  ).length;

  if (fittingLineCount <= 0 || fittingLineCount >= visualLines.length) {
    return { fitting: undefined, remaining: node };
  }

  return {
    fitting: createInlineTextFragment(node, visualLines.slice(0, fittingLineCount)),
    remaining: createInlineTextFragment(node, visualLines.slice(fittingLineCount)),
  };
}

export function createPretextTextMeasurer(): TextMeasurer {
  return {
    measureText(input) {
      const options: PrepareOptions = {
        whiteSpace: input.whiteSpace,
        wordBreak: input.wordBreak,
        letterSpacing: input.letterSpacing,
      };
      const prepared = prepareWithSegments(input.text, input.font, options);
      const result = layoutPretextWithLines(prepared, input.maxWidth, input.lineHeight);

      return {
        width: result.lines.reduce((max, line) => Math.max(max, line.width), 0),
        height: result.height,
        lineCount: result.lineCount,
        lines: result.lines.map((line) => ({
          text: line.text,
          width: line.width,
        })),
      };
    },
  };
}

export function createMonospaceTextMeasurer(options: { charWidth: number }): TextMeasurer {
  return {
    measureText(input) {
      const maxCharacters = Math.max(1, Math.floor(input.maxWidth / options.charWidth));
      const rawLines =
        input.whiteSpace === "pre-wrap"
          ? input.text.split("\n")
          : [input.text.replaceAll(/\s+/g, " ").trim()];
      const lines = rawLines.flatMap((line, lineIndex) => {
        const baseOffset = rawLines
          .slice(0, lineIndex)
          .reduce((offset, rawLine) => offset + rawLine.length + 1, 0);
        let cursor = 0;

        return wrapMonospaceLine(line, maxCharacters).map((text) => {
          const start = text.length === 0 ? cursor : line.indexOf(text, cursor);
          cursor = consumeTrailingSeparator(line, start + text.length);
          return { text, start: baseOffset + start };
        });
      });

      return {
        width: lines.reduce((max, line) => Math.max(max, line.text.length * options.charWidth), 0),
        height: lines.length * input.lineHeight,
        lineCount: lines.length,
        lines: lines.map((line) => ({
          text: line.text,
          start: line.start,
          width: line.text.length * options.charWidth,
        })),
      };
    },
  };
}

function createInlineMeasuredLine(): InlineMeasuredLine {
  return { width: 0, height: 0, segments: [] };
}

function tokenizeInlineRun(run: TextRun) {
  return [...run.text.matchAll(/\n|[^\S\n]+|\S+/g)].map((match) => ({
    text: match[0],
    start: match.index ?? 0,
  }));
}

function measureInlineToken(
  token: { text: string; start: number },
  run: TextRun,
  baseStyle: TextStyle | undefined,
  measurer: TextMeasurer,
  maxWidth: number,
): InlineMeasuredSegment[] {
  const style = { ...baseStyle, ...run.style };
  const width = measureInlineText(token.text, style, measurer).width;
  const sourceText = run.sourceText ?? run.text;
  const sourceStart = run.sourceStart ?? 0;

  if (width <= maxWidth || token.text.trim().length === 0) {
    return [
      {
        sourceId: run.id,
        sourceText,
        text: token.text,
        start: sourceStart + token.start,
        width,
        trailingWhitespaceWidth: token.text.trim().length === 0 ? width : 0,
        style,
      },
    ];
  }

  const segments: InlineMeasuredSegment[] = [];
  let current = "";
  let currentStart = sourceStart + token.start;
  let cursor = sourceStart + token.start;

  for (const character of token.text) {
    const candidate = current + character;
    if (current.length > 0 && measureInlineText(candidate, style, measurer).width > maxWidth) {
      if (shouldKeepWithPreviousLineCharacter(character)) {
        current = candidate;
        cursor += character.length;
        continue;
      }

      segments.push({
        sourceId: run.id,
        sourceText,
        text: current,
        start: currentStart,
        width: measureInlineText(current, style, measurer).width,
        trailingWhitespaceWidth: 0,
        style,
      });
      current = character;
      currentStart = cursor;
    } else {
      current = candidate;
    }
    cursor += character.length;
  }

  if (current.length > 0) {
    segments.push({
      sourceId: run.id,
      sourceText,
      text: current,
      start: currentStart,
      width: measureInlineText(current, style, measurer).width,
      trailingWhitespaceWidth: 0,
      style,
    });
  }

  return segments;
}

function trimTrailingInlineWhitespace(line: InlineMeasuredLine, measurer: TextMeasurer) {
  while (line.segments.length > 0) {
    const segment = line.segments.at(-1);
    if (segment === undefined) return;

    const trimmedText = segment.text.replace(/[^\S\n]+$/g, "");
    if (trimmedText === segment.text) return;

    if (trimmedText.length === 0) {
      line.width -= segment.width;
      line.segments.pop();
      continue;
    }

    const trimmedWidth = measureInlineText(trimmedText, segment.style ?? {}, measurer).width;
    line.width -= segment.width - trimmedWidth;
    segment.text = trimmedText;
    segment.width = trimmedWidth;
    segment.trailingWhitespaceWidth = 0;
    return;
  }
}

function appendInlineSegment(line: InlineMeasuredLine, segment: InlineMeasuredSegment) {
  const previous = line.segments.at(-1);
  const leadingGap = inlineStyleBoundaryGap(previous, segment);

  if (
    previous !== undefined &&
    previous.sourceId === segment.sourceId &&
    previous.sourceText === segment.sourceText &&
    previous.start + previous.text.length === segment.start &&
    sameInlineStyle(previous.style, segment.style)
  ) {
    previous.text += segment.text;
    previous.width += segment.width;
    previous.trailingWhitespaceWidth =
      segment.text.trim().length === 0
        ? (previous.trailingWhitespaceWidth ?? 0) + segment.width
        : (segment.trailingWhitespaceWidth ?? 0);
  } else {
    line.segments.push(leadingGap === 0 ? segment : { ...segment, leadingGap });
  }

  line.width += leadingGap + segment.width;
}

function sameInlineStyle(left: TextStyle | undefined, right: TextStyle | undefined) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

function isEmphasizedInlineStyle(style: TextStyle | undefined) {
  const weight = parseCssFontWeight(style?.font);
  const numericWeight = Number.parseInt(weight ?? "", 10);
  return (
    parseCssFontStyle(style?.font) === "italic" ||
    parseCssFontStyle(style?.font) === "oblique" ||
    (Number.isFinite(numericWeight) && numericWeight >= 600) ||
    weight === "bold" ||
    weight === "bolder"
  );
}

function inlineStyleBoundaryGap(
  previous: InlineMeasuredSegment | undefined,
  segment: InlineMeasuredSegment,
) {
  if (previous === undefined) return 0;
  if (!/\s$/u.test(previous.text) || segment.text.trim().length === 0) return 0;
  if (sameInlineStyle(previous.style, segment.style)) return 0;
  if (!isEmphasizedInlineStyle(segment.style)) return 0;
  const desiredGap = Math.max(
    3,
    Math.min(4, (parseCssFontSize(segment.style?.font) ?? DEFAULT_LINE_HEIGHT) * 0.25),
  );
  const actualGap = previous.trailingWhitespaceWidth ?? 0;
  return Math.max(0, desiredGap - actualGap);
}

function createTextFragment(node: TextNode, lines: TextLine[]): TextNode {
  const sourceText = node.sourceText ?? node.text;
  const sourceStart = lines[0]?.start ?? node.sourceStart ?? 0;

  return {
    ...node,
    text: lines.map((line) => line.text).join("\n"),
    sourceText,
    sourceStart,
    sourceLineStarts: lines.map((line) => line.start ?? sourceStart),
    style: {
      ...node.style,
      lineHeight: node.style?.lineHeight ?? DEFAULT_LINE_HEIGHT,
      whiteSpace: "pre-wrap",
    },
  };
}

function textLineFitsPage(line: TextLine, pageBottom: number) {
  const lineBottom = line.text.length === 0 ? line.y : line.y + line.height;
  return lineBottom <= pageBottom + PAGE_OVERFLOW_TOLERANCE;
}

function createInlineTextFragment(node: InlineTextNode, lines: TextVisualLine[]): InlineTextNode {
  return {
    ...node,
    runs: lines.flatMap((line) =>
      line.fragments.map((fragment) => ({
        id: fragment.sourceId,
        text: fragment.text,
        sourceText: fragment.sourceText,
        sourceStart: fragment.start,
        style: inlineFragmentStyle(node, fragment),
      })),
    ),
  };
}

function inlineFragmentStyle(node: InlineTextNode, fragment: TextLine): TextStyle | undefined {
  const sourceRun =
    fragment.sourceId === undefined
      ? undefined
      : node.runs.find((run) => run.id === fragment.sourceId);

  if (sourceRun?.style !== undefined) return sourceRun.style;
  if (fragment.font === undefined && fragment.color === undefined) return undefined;

  return {
    ...(fragment.font === undefined ? {} : { font: fragment.font }),
    lineHeight: fragment.height,
    ...(fragment.color === undefined ? {} : { color: fragment.color }),
    ...(fragment.backgroundColor === undefined
      ? {}
      : { backgroundColor: fragment.backgroundColor }),
    ...(fragment.textDecorationLine === undefined
      ? {}
      : { textDecorationLine: fragment.textDecorationLine }),
    ...(fragment.textDecorationColor === undefined
      ? {}
      : { textDecorationColor: fragment.textDecorationColor }),
    ...(fragment.textDecorationOffset === undefined
      ? {}
      : { textDecorationOffset: fragment.textDecorationOffset }),
    ...(fragment.textDecorationThickness === undefined
      ? {}
      : { textDecorationThickness: fragment.textDecorationThickness }),
    ...(fragment.verticalAlign === undefined ? {} : { verticalAlign: fragment.verticalAlign }),
    ...(fragment.baselineShift === undefined ? {} : { baselineShift: fragment.baselineShift }),
  };
}

function measureInlineText(
  text: string,
  style: TextStyle,
  measurer: TextMeasurer,
  maxWidth = Number.MAX_SAFE_INTEGER,
): MeasureTextResult {
  return measurer.measureText({
    text,
    font: style.font ?? DEFAULT_FONT,
    lineHeight: style.lineHeight ?? DEFAULT_LINE_HEIGHT,
    maxWidth,
    whiteSpace: "pre-wrap",
    wordBreak: style.wordBreak,
    letterSpacing: style.letterSpacing,
  });
}

function textLineToGridSpaces(
  fragment: TextLine,
  rowIndex: number,
  fragmentIndex: number,
  measurer: TextMeasurer,
): LayoutTextGridSpace[] {
  const graphemes = segmentGraphemes(fragment.text);
  if (graphemes.length === 0) {
    return [
      {
        id: textGridSpaceId(fragment, rowIndex, fragmentIndex, 0),
        sourceId: fragment.sourceId,
        sourceText: fragment.sourceText,
        text: "",
        startOffset: fragment.start ?? 0,
        endOffset: fragment.start ?? 0,
        x: fragment.x,
        width: 0,
      },
    ];
  }

  const spaces: LayoutTextGridSpace[] = [];
  let x = fragment.x;
  let consumedWidth = 0;

  for (const [spaceIndex, grapheme] of graphemes.entries()) {
    const isLast = spaceIndex === graphemes.length - 1;
    const measuredWidth = isLast
      ? Math.max(0, fragment.width - consumedWidth)
      : measureTextGridCharacter(grapheme.text, fragment, measurer);
    const startOffset = (fragment.start ?? 0) + grapheme.index;
    const endOffset = startOffset + grapheme.text.length;

    spaces.push({
      id: textGridSpaceId(fragment, rowIndex, fragmentIndex, spaceIndex),
      sourceId: fragment.sourceId,
      sourceText: fragment.sourceText,
      text: grapheme.text,
      startOffset,
      endOffset,
      x,
      width: measuredWidth,
    });

    x += measuredWidth;
    consumedWidth += measuredWidth;
  }

  return spaces;
}

function segmentGraphemes(text: string) {
  const Segmenter = Intl.Segmenter;
  if (Segmenter === undefined) {
    return Array.from(text).map((segment, index) => ({ text: segment, index }));
  }

  const segmenter = new Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (segment) => ({
    text: segment.segment,
    index: segment.index,
  }));
}

function measureTextGridCharacter(character: string, fragment: TextLine, measurer: TextMeasurer) {
  return measurer.measureText({
    text: character,
    font: fragment.font ?? DEFAULT_FONT,
    lineHeight: fragment.height,
    maxWidth: Number.MAX_SAFE_INTEGER,
    whiteSpace: "pre-wrap",
  }).width;
}

function textGridSpaceId(
  fragment: TextLine,
  rowIndex: number,
  fragmentIndex: number,
  spaceIndex: number,
) {
  const source = fragment.sourceId ?? "anonymous";
  const start = fragment.start ?? 0;
  return `${source}:${rowIndex}:${fragmentIndex}:${start}:${spaceIndex}`;
}

function textGridBreakBetween(
  previous: LayoutTextGridSpace,
  next: LayoutTextGridSpace,
): LayoutTextGridBreak {
  if (previous.sourceId === next.sourceId && previous.sourceText !== undefined) {
    const skipped = previous.sourceText.slice(previous.endOffset, next.startOffset);
    if (skipped.includes("\n")) return "required";
    if (skipped.length > 0 && /\s/u.test(skipped)) return "allowed";
  }

  if (previous.text.length === 0 || next.text.length === 0) return "allowed";
  if (/\s/u.test(previous.text) || /\s/u.test(next.text)) return "allowed";
  return "forbidden";
}

function lineHeightForStyle(style: TextStyle | undefined) {
  return style?.lineHeight ?? DEFAULT_LINE_HEIGHT;
}

function verticalAlignOffset(style: TextStyle | undefined) {
  const fontSize = parseCssFontSize(style?.font) ?? lineHeightForStyle(style);
  if (style?.verticalAlign === "super") return -fontSize * 0.6;
  if (style?.verticalAlign === "sub") return fontSize;
  return 0;
}

function consumeTrailingSeparator(text: string, cursor: number) {
  return text[cursor] === " " || text[cursor] === "\n" ? cursor + 1 : cursor;
}

function wrapMonospaceLine(line: string, maxCharacters: number): string[] {
  if (line.length === 0) return [""];
  if (line.trim().length === 0) {
    const wrapped: string[] = [];
    for (let start = 0; start < line.length; start += maxCharacters) {
      wrapped.push(line.slice(start, start + maxCharacters));
    }
    return wrapped;
  }

  const words = line.split(" ");
  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxCharacters) {
      if (current.length > 0) {
        wrapped.push(current);
        current = "";
      }

      let start = 0;
      while (start < word.length) {
        let end = Math.min(word.length, start + maxCharacters);
        while (end < word.length && shouldKeepWithPreviousLineCharacter(word[end])) end += 1;
        wrapped.push(word.slice(start, end));
        start = end;
      }

      continue;
    }

    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxCharacters) {
      current = candidate;
    } else {
      wrapped.push(current);
      current = word;
    }
  }

  if (current.length > 0) wrapped.push(current);
  return wrapped;
}

function shouldKeepWithPreviousLineCharacter(character: string | undefined) {
  if (character === undefined || character.length === 0) return false;
  if (/\s/u.test(character)) return false;
  return !/[\p{L}\p{N}\p{M}]/u.test(character);
}

function fontMetadata(font: string | undefined) {
  const fontSize = parseCssFontSize(font);
  const fontWeight = parseCssFontWeight(font);
  const fontStyle = parseCssFontStyle(font);

  return {
    ...(fontSize === undefined ? {} : { fontSize }),
    ...(fontWeight === undefined ? {} : { fontWeight }),
    ...(fontStyle === undefined ? {} : { fontStyle }),
  };
}

function parseCssFontSize(font: string | undefined) {
  const match = /(?:^|\s)(\d+(?:\.\d+)?)px(?:\/|\s|$)/.exec(font ?? "");
  return match === null ? undefined : Number(match[1]);
}

function parseCssFontWeight(font: string | undefined) {
  const source = font ?? "";
  const sizeMatch = /(?:^|\s)(\d+(?:\.\d+)?)px(?:\/|\s|$)/.exec(source);
  const prefix = sizeMatch === null ? source : source.slice(0, sizeMatch.index);
  const weight = prefix
    .trim()
    .split(/\s+/)
    .toReversed()
    .find((token) => /^(?:[1-9]00|bold|normal)$/i.test(token));

  if (weight === undefined) return undefined;
  if (weight.toLowerCase() === "bold") return "700";
  if (weight.toLowerCase() === "normal") return "400";
  return weight;
}

function parseCssFontStyle(font: string | undefined) {
  const source = font ?? "";
  const sizeMatch = /(?:^|\s)(\d+(?:\.\d+)?)px(?:\/|\s|$)/.exec(source);
  const prefix = sizeMatch === null ? source : source.slice(0, sizeMatch.index);
  const style = prefix
    .trim()
    .split(/\s+/)
    .find((token) => /^(?:italic|oblique|normal)$/i.test(token));

  if (style === undefined || style.toLowerCase() === "normal") return undefined;
  return style.toLowerCase();
}
