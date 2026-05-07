import type { TextLine } from "@vasa/layout";
import type { OpenTypeFont, OpenTypePathCommand } from "opentype.js";
import { parse } from "opentype.js/dist/opentype.mjs";

export type TextOutlineFont = {
  unitsPerEm: number;
  ascender: number;
  descender?: number;
  bytes?: Uint8Array;
  source: OpenTypeFont;
};

export type TextOutlineFontOptions = {
  variations?: Record<string, number>;
};

export type TextOutlinePathCommand =
  | { type: "moveTo"; x: number; y: number }
  | { type: "lineTo"; x: number; y: number }
  | { type: "bezierCurveTo"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "closePath" };

export type TextOutlinePath = {
  commands: TextOutlinePathCommand[];
};

export type TextOutlineOptions = {
  font: TextOutlineFont;
  fontSize: number;
  letterSpacing?: number;
  embolden?: number;
  skewX?: number;
};

export function parseTextOutlineFont(
  bytes: Uint8Array | ArrayBuffer,
  options: TextOutlineFontOptions = {},
): TextOutlineFont {
  const source = parse(toArrayBuffer(bytes));
  applyFontVariations(source, options.variations);

  return {
    unitsPerEm: source.unitsPerEm,
    ascender: source.ascender,
    descender: source.descender,
    bytes: copyBytes(bytes),
    source,
  };
}

function applyFontVariations(source: OpenTypeFont, variations: Record<string, number> | undefined) {
  if (variations === undefined) return;

  const variation = (source as { variation?: { set?: (coords: Record<string, number>) => void } })
    .variation;
  variation?.set?.(variations);
}

function toArrayBuffer(bytes: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function copyBytes(bytes: Uint8Array | ArrayBuffer): Uint8Array {
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes.slice(0));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function createTextLineOutline(
  line: Pick<TextLine, "text" | "x" | "y">,
  options: TextOutlineOptions,
): TextOutlinePath {
  const baseline = line.y + (options.font.ascender / options.font.unitsPerEm) * options.fontSize;
  const commands: TextOutlinePathCommand[] = [];
  let x = line.x;

  for (const character of line.text) {
    const glyph = options.font.source.charToGlyph(character);
    const glyphCommands: TextOutlinePathCommand[] = [];
    appendGlyphCommands(glyphCommands, glyph.getPath(x, baseline, options.fontSize).commands, {
      skewX: options.skewX,
      originY: baseline,
    });
    commands.push(...glyphCommands);

    if (options.embolden !== undefined && options.embolden > 0) {
      appendOffsetCommands(commands, glyphCommands, options.embolden, 0);
    }

    x += (glyph.advanceWidth / options.font.unitsPerEm) * options.fontSize;
    x += options.letterSpacing ?? 0;
  }

  return { commands };
}

export function textOutlinePathBounds(path: TextOutlinePath) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const command of path.commands) {
    const points = commandPoints(command);
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return undefined;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function commandPoints(command: TextOutlinePathCommand): Point[] {
  if (command.type === "moveTo" || command.type === "lineTo")
    return [{ x: command.x, y: command.y }];
  if (command.type === "bezierCurveTo") {
    return [
      { x: command.x1, y: command.y1 },
      { x: command.x2, y: command.y2 },
      { x: command.x, y: command.y },
    ];
  }
  return [];
}

function appendOffsetCommands(
  target: TextOutlinePathCommand[],
  source: TextOutlinePathCommand[],
  dx: number,
  dy: number,
) {
  for (const command of source) {
    if (command.type === "moveTo") {
      target.push({ type: "moveTo", x: round(command.x + dx), y: round(command.y + dy) });
      continue;
    }

    if (command.type === "lineTo") {
      target.push({ type: "lineTo", x: round(command.x + dx), y: round(command.y + dy) });
      continue;
    }

    if (command.type === "bezierCurveTo") {
      target.push({
        type: "bezierCurveTo",
        x1: round(command.x1 + dx),
        y1: round(command.y1 + dy),
        x2: round(command.x2 + dx),
        y2: round(command.y2 + dy),
        x: round(command.x + dx),
        y: round(command.y + dy),
      });
      continue;
    }

    target.push(command);
  }
}

function appendGlyphCommands(
  target: TextOutlinePathCommand[],
  source: OpenTypePathCommand[],
  options: { skewX?: number; originY: number },
) {
  let current: Point = { x: 0, y: 0 };
  let contourStart: Point = current;

  for (const command of source) {
    if (command.type === "M") {
      current = transformPoint(command.x, command.y, options);
      contourStart = current;
      target.push({ type: "moveTo", ...current });
      continue;
    }

    if (command.type === "L") {
      current = transformPoint(command.x, command.y, options);
      target.push({ type: "lineTo", ...current });
      continue;
    }

    if (command.type === "C") {
      const next = transformPoint(command.x, command.y, options);
      target.push({
        type: "bezierCurveTo",
        ...bezierControls(command.x1, command.y1, command.x2, command.y2, options),
        ...next,
      });
      current = next;
      continue;
    }

    if (command.type === "Q") {
      const control = transformPoint(command.x1, command.y1, options);
      const next = transformPoint(command.x, command.y, options);
      target.push({
        type: "bezierCurveTo",
        x1: round(current.x + (2 / 3) * (control.x - current.x)),
        y1: round(current.y + (2 / 3) * (control.y - current.y)),
        x2: round(next.x + (2 / 3) * (control.x - next.x)),
        y2: round(next.y + (2 / 3) * (control.y - next.y)),
        ...next,
      });
      current = next;
      continue;
    }

    target.push({ type: "closePath" });
    current = contourStart;
  }
}

type Point = {
  x: number;
  y: number;
};

function point(x: number, y: number): Point {
  return { x: round(x), y: round(y) };
}

function transformPoint(x: number, y: number, options: { skewX?: number; originY: number }): Point {
  const skewX = options.skewX ?? 0;
  return point(x + (options.originY - y) * skewX, y);
}

function bezierControls(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: { skewX?: number; originY: number },
) {
  const first = transformPoint(x1, y1, options);
  const second = transformPoint(x2, y2, options);

  return {
    x1: first.x,
    y1: first.y,
    x2: second.x,
    y2: second.y,
  };
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
