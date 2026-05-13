import type { Rect as LayoutRect } from "@skriva/layout";

export type RectCommand = {
  apply(rect: LayoutRect): LayoutRect;
};

export function Rect(x: number, y: number, width: number, height: number): LayoutRect {
  return { x, y, width, height };
}

export function applyRectCommands(rect: LayoutRect, commands: RectCommand[]): LayoutRect {
  return commands.reduce((current, command) => command.apply(current), rect);
}

export function SetRect(props: Partial<LayoutRect>): RectCommand {
  return RectCommand((rect) => ({ ...rect, ...props }));
}

export function RoundRect(props: Partial<Record<keyof LayoutRect, boolean>> = allRectProps) {
  return RectCommand((rect) => ({
    x: props.x === false ? rect.x : Math.round(rect.x),
    y: props.y === false ? rect.y : Math.round(rect.y),
    width: props.width === false ? rect.width : Math.round(rect.width),
    height: props.height === false ? rect.height : Math.round(rect.height),
  }));
}

function RectCommand(apply: RectCommand["apply"]): RectCommand {
  return { apply };
}

const allRectProps = {
  x: true,
  y: true,
  width: true,
  height: true,
} satisfies Record<keyof LayoutRect, boolean>;
