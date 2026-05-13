export type CanvasCommand = {
  apply(surface: CanvasSurface): void;
};

export type CanvasSurface = {
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  font?: string;
  textBaseline?: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
};

type Command<TType extends string, TProps extends object = {}> = TProps & {
  type: TType;
  apply(surface: CanvasSurface): void;
};

export function createCanvasCommand<TType extends string, TProps extends object>(
  command: { type: TType } & TProps,
  apply: (surface: CanvasSurface) => void,
): CanvasCommand & Command<TType, TProps> {
  return Object.defineProperty(command, "apply", {
    value: apply,
    enumerable: false,
  }) as unknown as CanvasCommand & Command<TType, TProps>;
}
