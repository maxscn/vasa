import type { Rect } from "@vasa/layout";

export type SvgPathCommand =
  | { type: "moveTo"; x: number; y: number }
  | { type: "lineTo"; x: number; y: number }
  | { type: "bezierCurveTo"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "closePath" };

export type SvgPath = {
  commands: SvgPathCommand[];
};

export type SvgViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function parseSvgPathData(data: string): SvgPath {
  const tokens = data.match(/[MmLlHhVvCcZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const commands: SvgPathCommand[] = [];
  let index = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const read = () => Number(tokens[index++]);
  const isCommand = (token: string | undefined) => /^[A-Za-z]$/.test(token ?? "");

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++] ?? "";
    if (command.length === 0) break;

    const relative = command === command.toLowerCase();
    const type = command.toUpperCase();

    if (type === "M") {
      x = resolveCoordinate(read(), x, relative);
      y = resolveCoordinate(read(), y, relative);
      startX = x;
      startY = y;
      commands.push({ type: "moveTo", x, y });
      command = relative ? "l" : "L";
      continue;
    }

    if (type === "L") {
      x = resolveCoordinate(read(), x, relative);
      y = resolveCoordinate(read(), y, relative);
      commands.push({ type: "lineTo", x, y });
      continue;
    }

    if (type === "H") {
      x = resolveCoordinate(read(), x, relative);
      commands.push({ type: "lineTo", x, y });
      continue;
    }

    if (type === "V") {
      y = resolveCoordinate(read(), y, relative);
      commands.push({ type: "lineTo", x, y });
      continue;
    }

    if (type === "C") {
      const x1 = resolveCoordinate(read(), x, relative);
      const y1 = resolveCoordinate(read(), y, relative);
      const x2 = resolveCoordinate(read(), x, relative);
      const y2 = resolveCoordinate(read(), y, relative);
      x = resolveCoordinate(read(), x, relative);
      y = resolveCoordinate(read(), y, relative);
      commands.push({ type: "bezierCurveTo", x1, y1, x2, y2, x, y });
      continue;
    }

    if (type === "Z") {
      commands.push({ type: "closePath" });
      x = startX;
      y = startY;
      command = "";
      continue;
    }

    break;
  }

  return { commands };
}

export function parseSvgViewBox(viewBox: string | undefined, width: number, height: number) {
  const values = viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map((value) => Number(value));

  if (values?.length === 4 && values.every(Number.isFinite)) {
    return {
      x: values[0] ?? 0,
      y: values[1] ?? 0,
      width: values[2] ?? width,
      height: values[3] ?? height,
    };
  }

  return { x: 0, y: 0, width, height };
}

export function transformSvgPath(path: SvgPath, viewBox: SvgViewBox, rect: Rect): SvgPath {
  const scaleX = rect.width / viewBox.width;
  const scaleY = rect.height / viewBox.height;
  const point = (x: number, y: number) => ({
    x: rect.x + (x - viewBox.x) * scaleX,
    y: rect.y + (y - viewBox.y) * scaleY,
  });

  return {
    commands: path.commands.map((command) => {
      if (command.type === "moveTo" || command.type === "lineTo") {
        return { type: command.type, ...point(command.x, command.y) };
      }

      if (command.type === "bezierCurveTo") {
        return {
          type: "bezierCurveTo",
          ...point(command.x, command.y),
          ...prefixPoint("1", point(command.x1, command.y1)),
          ...prefixPoint("2", point(command.x2, command.y2)),
        };
      }

      return command;
    }),
  };
}

function resolveCoordinate(value: number, current: number, relative: boolean) {
  return relative ? current + value : value;
}

function prefixPoint<TSuffix extends string>(suffix: TSuffix, point: { x: number; y: number }) {
  return {
    [`x${suffix}`]: point.x,
    [`y${suffix}`]: point.y,
  } as Record<`x${TSuffix}` | `y${TSuffix}`, number>;
}
