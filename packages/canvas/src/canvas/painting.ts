import { textOutlinePathBounds, type TextOutlinePath } from "@skriva/renderer";
import {
  CSS_FONT_SIZE_CAPTURE_INDEX,
  LINE_THROUGH_OFFSET_RATIO,
  MIN_PIXEL_SNAP,
  MIN_TEXT_DECORATION_THICKNESS,
  TEXT_DECORATION_THICKNESS_RATIO,
} from "../constants.js";
import {
  ClearRect,
  FillPath,
  FillRect,
  FillText,
  Path,
  StrokeRect,
  type CanvasCommand,
} from "../commands/index.js";
import type {
  CanvasNode,
  CanvasRendererOptions,
  CanvasScene,
  CanvasTextLineNode,
} from "./types.js";
import { Rect, RoundRect, SetRect, applyRectCommands, type RectCommand } from "./rect.js";

export function createCanvasCommands(
  scene: CanvasScene,
  options: CanvasRendererOptions = {},
): CanvasCommand[] {
  const pageBackground = options.pageBackground ?? "#ffffff";
  const commands: CanvasCommand[] = [];

  for (const page of scene.pages) {
    commands.push(ClearRect({ rect: page.rect }));
    commands.push(FillRect({ rect: page.rect, fill: pageBackground }));
    appendNodeCommands(commands, page.children);
  }

  return commands;
}

function appendNodeCommands(commands: CanvasCommand[], nodes: CanvasNode[]) {
  for (const node of nodes) {
    if (node.kind === "box") {
      if (node.fill !== undefined) commands.push(FillRect({ rect: node.rect, fill: node.fill }));
      if (node.stroke !== undefined) {
        commands.push(StrokeRect({ rect: node.rect, stroke: node.stroke }));
      }
      appendNodeCommands(commands, node.children);
      continue;
    }

    if (node.kind === "path") {
      commands.push(
        Path({
          path: node.path,
          fill: node.fill,
          stroke: node.stroke,
          strokeWidth: node.strokeWidth,
        }),
      );
      continue;
    }

    const background = TextBackground(node);
    if (background !== undefined) commands.push(background);

    if (node.outline === undefined) {
      commands.push(
        FillText({
          text: node.text,
          x: snapCanvasTextCoordinate(node.x, node.pixelSnap),
          y: snapCanvasTextCoordinate(node.y, node.pixelSnap),
          font: node.font,
          fill: node.fill,
        }),
      );
    } else {
      commands.push(FillPath({ path: node.outline, fill: node.fill }));
    }

    const decoration = TextDecoration(node);
    if (decoration !== undefined) commands.push(decoration);
  }
}

function snapCanvasTextCoordinate(value: number, pixelSnap: number | undefined) {
  if (pixelSnap === undefined || pixelSnap <= MIN_PIXEL_SNAP) return value;
  return Math.round(value / pixelSnap) * pixelSnap;
}

function TextBackground(node: CanvasTextLineNode): CanvasCommand | undefined {
  if (node.backgroundColor === undefined) return undefined;

  return FillRect({
    rect: applyRectCommands(textLineRect(node), [RoundRect()]),
    fill: node.backgroundColor,
  });
}

function TextDecoration(node: CanvasTextLineNode): CanvasCommand | undefined {
  if (node.textDecorationLine === undefined) return undefined;

  return FillRect({
    rect: applyRectCommands(
      textLineRect(node),
      decorationRectCommands(node, fontSizeFromCanvasTextNode(node), node.outline),
    ),
    fill: node.textDecorationColor ?? node.fill,
  });
}

function decorationRectCommands(
  node: CanvasTextLineNode,
  fontSize: number,
  outline: TextOutlinePath | undefined,
): RectCommand[] {
  const thickness =
    node.textDecorationThickness ??
    Math.max(MIN_TEXT_DECORATION_THICKNESS, Math.round(fontSize * TEXT_DECORATION_THICKNESS_RATIO));
  const bounds = outline === undefined ? undefined : textOutlinePathBounds(outline);
  const fallbackOffset =
    node.textDecorationLine === "line-through"
      ? fontSize * LINE_THROUGH_OFFSET_RATIO
      : Math.min(node.height - thickness, fontSize);
  const hasMetricOffset = node.textDecorationOffset !== undefined;
  const offset = node.textDecorationOffset ?? fallbackOffset;
  const y =
    bounds === undefined || node.textDecorationLine === "line-through" || hasMetricOffset
      ? Math.round(node.y + offset)
      : Math.max(Math.round(node.y + offset), Math.floor(bounds.y + bounds.height));

  return [
    RoundRect({ y: false, height: false }),
    SetRect({
      y,
      height: thickness,
    }),
  ];
}

function textLineRect(node: CanvasTextLineNode) {
  return Rect(node.x, node.y, node.width, node.height);
}

function fontSizeFromCanvasTextNode(node: CanvasTextLineNode) {
  const match = node.font.match(/(\d+(?:\.\d+)?)px/);
  if (match === null) return Math.max(MIN_TEXT_DECORATION_THICKNESS, node.height);
  return Number.parseFloat(match[CSS_FONT_SIZE_CAPTURE_INDEX]!);
}
