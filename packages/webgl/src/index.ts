import type { CanvasNode, CanvasScene, CanvasTextLineNode } from "@vasa/canvas";
import {
  textOutlinePathBounds,
  type TextOutlinePath,
  type TextOutlinePathCommand,
} from "@vasa/renderer";

export type WebGlRendererOptions = {
  pixelRatio?: number;
};

export type WebGlSceneStats = {
  shapeTriangleCount: number;
  textLineCount: number;
  textLineWithOutlineCount: number;
  textTriangleCount: number;
  decorationTriangleCount: number;
  textPrimitives: WebGlTextPrimitive[];
  decorationPrimitives: WebGlDecorationPrimitive[];
};

export type WebGlRenderResult = {
  didRender: true;
  didRenderText: boolean;
} & WebGlSceneStats;

export type WebGlTextPrimitive = {
  text: string;
  fontSize: number;
  bounds: Rect;
};

export type WebGlDecorationPrimitive = {
  text: string;
  line: NonNullable<CanvasTextLineNode["textDecorationLine"]>;
  rect: Rect;
  color: string;
};

type WebGlRendererState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionLocation: number;
  colorLocation: WebGLUniformLocation;
  resolutionLocation: WebGLUniformLocation;
  positionBuffer: WebGLBuffer;
};

type DrawTriangle = {
  kind: "shape" | "text" | "decoration";
  vertices: number[];
  color: Color;
};

type DrawPath = {
  kind: "textPath";
  contours: Point[][];
  bounds: Rect;
  color: Color;
};

type DrawItem = DrawTriangle | DrawPath;

type Color = [number, number, number, number];

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const stateByCanvas = new WeakMap<HTMLCanvasElement, WebGlRendererState>();

export function canUseWebGlRenderer() {
  const canvas = document.createElement("canvas");
  return canvas.getContext("webgl", { alpha: true }) !== null;
}

export function renderWebGlScene(
  canvas: HTMLCanvasElement,
  scene: CanvasScene,
  options: WebGlRendererOptions = {},
): false | WebGlRenderResult {
  const state = webGlRendererState(canvas);
  if (state === undefined) return false;

  const pixelRatio = options.pixelRatio ?? window.devicePixelRatio ?? 1;
  const { gl } = state;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clearStencil(0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(state.program);
  gl.uniform2f(state.resolutionLocation, canvas.width, canvas.height);

  const items = sceneDrawItems(scene, pixelRatio);
  const stats = webGlSceneStats(scene, items);

  for (const item of items) {
    drawItem(state, item);
  }

  return {
    didRender: true,
    didRenderText: stats.textLineCount === 0 || stats.textTriangleCount > 0,
    ...stats,
  };
}

export function analyzeWebGlScene(scene: CanvasScene, options: WebGlRendererOptions = {}) {
  const pixelRatio = options.pixelRatio ?? 1;
  return webGlSceneStats(scene, sceneDrawItems(scene, pixelRatio));
}

function webGlRendererState(canvas: HTMLCanvasElement) {
  const existing = stateByCanvas.get(canvas);
  if (existing !== undefined) return existing;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    stencil: true,
  });
  if (gl === null) return undefined;

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  const positionBuffer = gl.createBuffer();
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const colorLocation = gl.getUniformLocation(program, "u_color");

  if (positionBuffer === null || resolutionLocation === null || colorLocation === null) {
    return undefined;
  }

  const state = {
    gl,
    program,
    positionLocation: gl.getAttribLocation(program, "a_position"),
    colorLocation,
    resolutionLocation,
    positionBuffer,
  };
  stateByCanvas.set(canvas, state);
  return state;
}

function sceneDrawItems(scene: CanvasScene, pixelRatio: number): DrawItem[] {
  return scene.pages.flatMap((page) => nodesDrawItems(page.children, pixelRatio));
}

function nodesDrawItems(nodes: CanvasNode[], pixelRatio: number): DrawItem[] {
  return nodes.flatMap((node) => {
    if (node.kind === "box") {
      return [
        ...(node.fill === undefined ? [] : rectTriangles(node.rect, node.fill, pixelRatio)),
        ...nodesDrawItems(node.children, pixelRatio),
      ];
    }

    if (node.kind === "textLine") {
      return [
        ...(node.outline === undefined ? [] : textPathItems(node.outline, node.fill, pixelRatio)),
        ...textDecorationTriangles(node, pixelRatio),
      ];
    }

    if (node.kind === "path" && node.fill !== undefined) {
      return svgPathTriangles(node.path.commands, node.fill, pixelRatio);
    }

    return [];
  });
}

function rectTriangles(
  rect: { x: number; y: number; width: number; height: number },
  fill: string,
  pixelRatio: number,
  kind: DrawTriangle["kind"] = "shape",
): DrawTriangle[] {
  const x = rect.x * pixelRatio;
  const y = rect.y * pixelRatio;
  const width = rect.width * pixelRatio;
  const height = rect.height * pixelRatio;
  return [
    {
      kind,
      color: parseColor(fill),
      vertices: [
        x,
        y,
        x + width,
        y,
        x,
        y + height,
        x,
        y + height,
        x + width,
        y,
        x + width,
        y + height,
      ],
    },
  ];
}

function textDecorationTriangles(node: CanvasTextLineNode, pixelRatio: number): DrawTriangle[] {
  if (node.textDecorationLine === undefined) return [];

  return rectTriangles(
    textDecorationRect(node),
    node.textDecorationColor ?? node.fill,
    pixelRatio,
    "decoration",
  );
}

function textDecorationRect(node: CanvasTextLineNode) {
  const horizontal = snappedTextHorizontalRect(node);
  const fontSize = fontSizeFromCanvasTextNode(node);
  const thickness = node.textDecorationThickness ?? Math.max(1, Math.round(fontSize * 0.06));
  const fallbackOffset =
    node.textDecorationLine === "line-through"
      ? fontSize * 0.6
      : Math.min(node.height - thickness, fontSize);
  const offset = node.textDecorationOffset ?? fallbackOffset;

  return {
    x: horizontal.x,
    y: Math.round(node.y + offset),
    width: horizontal.width,
    height: thickness,
  };
}

function snappedTextHorizontalRect(node: CanvasTextLineNode) {
  const bounds = node.outline === undefined ? undefined : textOutlinePathBounds(node.outline);
  if (bounds === undefined) return { x: Math.round(node.x), width: Math.round(node.width) };

  const x = Math.floor(bounds.x);
  return { x, width: Math.max(1, Math.ceil(bounds.x + bounds.width) - x) };
}

function fontSizeFromCanvasTextNode(node: CanvasTextLineNode) {
  const match = node.font.match(/(\d+(?:\.\d+)?)px/);
  if (match === null) return Math.max(1, node.height);
  return Number.parseFloat(match[1]);
}

function scaleRect(rect: Rect, scale: number): Rect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

function scaleContours(contours: Point[][], scale: number) {
  return contours.map((contour) =>
    contour.map((point) => ({
      x: point.x * scale,
      y: point.y * scale,
    })),
  );
}

function textPathItems(path: TextOutlinePath, fill: string, pixelRatio: number): DrawPath[] {
  const bounds = textOutlinePathBounds(path);
  if (bounds === undefined) return [];

  return [
    {
      kind: "textPath",
      contours: scaleContours(outlineContours(path.commands), pixelRatio),
      bounds: scaleRect(bounds, pixelRatio),
      color: parseColor(fill),
    },
  ];
}

function svgPathTriangles(
  commands: Array<{
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }>,
  fill: string,
  pixelRatio: number,
): DrawTriangle[] {
  return contourTriangles(svgContours(commands), fill, pixelRatio, "shape");
}

function contourTriangles(
  contours: Point[][],
  fill: string,
  pixelRatio: number,
  kind: DrawTriangle["kind"],
): DrawTriangle[] {
  const color = parseColor(fill);
  return contours.flatMap((contour) => {
    if (contour.length < 3) return [];
    const [anchor, ...points] = contour;
    const triangles: DrawTriangle[] = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      triangles.push({
        kind,
        color,
        vertices: [
          anchor.x * pixelRatio,
          anchor.y * pixelRatio,
          points[index]!.x * pixelRatio,
          points[index]!.y * pixelRatio,
          points[index + 1]!.x * pixelRatio,
          points[index + 1]!.y * pixelRatio,
        ],
      });
    }
    return triangles;
  });
}

function pathTriangleCount(contours: Point[][]) {
  return contours.reduce((count, contour) => count + Math.max(0, contour.length), 0);
}

function webGlSceneStats(scene: CanvasScene, items: DrawItem[]): WebGlSceneStats {
  return {
    shapeTriangleCount: items.filter((item) => item.kind === "shape").length,
    textLineCount: scene.pages.reduce((count, page) => count + countTextLines(page.children), 0),
    textLineWithOutlineCount: scene.pages.reduce(
      (count, page) => count + countTextLinesWithOutlines(page.children),
      0,
    ),
    textTriangleCount: items.reduce(
      (count, item) => count + (item.kind === "textPath" ? pathTriangleCount(item.contours) : 0),
      0,
    ),
    decorationTriangleCount: items.filter((item) => item.kind === "decoration").length,
    textPrimitives: scene.pages.flatMap((page) => textPrimitives(page.children)),
    decorationPrimitives: scene.pages.flatMap((page) => decorationPrimitives(page.children)),
  };
}

function textPrimitives(nodes: CanvasNode[]): WebGlTextPrimitive[] {
  return nodes.flatMap((node) => {
    if (node.kind === "textLine" && node.text.length > 0 && node.outline !== undefined) {
      const bounds = textOutlinePathBounds(node.outline);
      if (bounds === undefined) return [];

      return [
        {
          text: node.text,
          fontSize: fontSizeFromCanvasTextNode(node),
          bounds,
        },
      ];
    }
    if (node.kind === "box") return textPrimitives(node.children);
    return [];
  });
}

function decorationPrimitives(nodes: CanvasNode[]): WebGlDecorationPrimitive[] {
  return nodes.flatMap((node) => {
    if (node.kind === "textLine" && node.text.length > 0 && node.textDecorationLine !== undefined) {
      return [
        {
          text: node.text,
          line: node.textDecorationLine,
          rect: textDecorationRect(node),
          color: node.textDecorationColor ?? node.fill,
        },
      ];
    }
    if (node.kind === "box") return decorationPrimitives(node.children);
    return [];
  });
}

function countTextLines(nodes: CanvasNode[]): number {
  return nodes.reduce((count, node) => {
    if (node.kind === "textLine") return count + (node.text.length > 0 ? 1 : 0);
    if (node.kind === "box") return count + countTextLines(node.children);
    return count;
  }, 0);
}

function countTextLinesWithOutlines(nodes: CanvasNode[]): number {
  return nodes.reduce((count, node) => {
    if (node.kind === "textLine") {
      return count + (node.text.length > 0 && node.outline !== undefined ? 1 : 0);
    }
    if (node.kind === "box") return count + countTextLinesWithOutlines(node.children);
    return count;
  }, 0);
}

function outlineContours(commands: TextOutlinePathCommand[]): Point[][] {
  const contours: Point[][] = [];
  let current: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };

  for (const command of commands) {
    if (command.type === "moveTo") {
      if (current.length > 0) contours.push(current);
      cursor = { x: command.x, y: command.y };
      current = [cursor];
      continue;
    }

    if (command.type === "lineTo") {
      cursor = { x: command.x, y: command.y };
      current.push(cursor);
      continue;
    }

    if (command.type === "bezierCurveTo") {
      const start = cursor;
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        current.push(cubicPoint(start, command, t));
      }
      cursor = { x: command.x, y: command.y };
      continue;
    }

    if (current.length > 0) contours.push(current);
    current = [];
  }

  if (current.length > 0) contours.push(current);
  return contours;
}

function svgContours(
  commands: Array<{
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }>,
) {
  const contours: Point[][] = [];
  let current: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };

  for (const command of commands) {
    if (command.type === "moveTo") {
      if (current.length > 0) contours.push(current);
      cursor = { x: command.x ?? 0, y: command.y ?? 0 };
      current = [cursor];
      continue;
    }

    if (command.type === "lineTo") {
      cursor = { x: command.x ?? cursor.x, y: command.y ?? cursor.y };
      current.push(cursor);
      continue;
    }

    if (command.type === "bezierCurveTo") {
      const start = cursor;
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        current.push(
          cubicPoint(
            start,
            {
              x1: command.x1 ?? start.x,
              y1: command.y1 ?? start.y,
              x2: command.x2 ?? command.x ?? start.x,
              y2: command.y2 ?? command.y ?? start.y,
              x: command.x ?? start.x,
              y: command.y ?? start.y,
            },
            t,
          ),
        );
      }
      cursor = { x: command.x ?? cursor.x, y: command.y ?? cursor.y };
      continue;
    }

    if (command.type === "closePath") {
      if (current.length > 0) contours.push(current);
      current = [];
    }
  }

  if (current.length > 0) contours.push(current);
  return contours;
}

function cubicPoint(
  start: Point,
  command: { x1: number; y1: number; x2: number; y2: number; x: number; y: number },
  t: number,
): Point {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * start.x +
      3 * mt * mt * t * command.x1 +
      3 * mt * t * t * command.x2 +
      t * t * t * command.x,
    y:
      mt * mt * mt * start.y +
      3 * mt * mt * t * command.y1 +
      3 * mt * t * t * command.y2 +
      t * t * t * command.y,
  };
}

function drawItem(state: WebGlRendererState, item: DrawItem) {
  if (item.kind === "textPath") {
    drawTextPath(state, item);
    return;
  }

  drawTriangle(state, item);
}

function drawTextPath(state: WebGlRendererState, path: DrawPath) {
  const { gl } = state;
  gl.enable(gl.STENCIL_TEST);
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0xff);
  gl.stencilFunc(gl.ALWAYS, 1, 0xff);
  gl.stencilOp(gl.INVERT, gl.INVERT, gl.INVERT);

  const fillAnchor = { x: path.bounds.x - 1, y: path.bounds.y - 1 };
  for (const contour of path.contours) {
    if (contour.length < 2) continue;
    for (let index = 0; index < contour.length; index += 1) {
      const start = contour[index]!;
      const end = contour[(index + 1) % contour.length]!;
      drawTriangle(state, {
        kind: "text",
        color: path.color,
        vertices: [fillAnchor.x, fillAnchor.y, start.x, start.y, end.x, end.y],
      });
    }
  }

  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  drawTriangle(state, {
    kind: "text",
    color: path.color,
    vertices: rectVertices(path.bounds),
  });
  gl.disable(gl.STENCIL_TEST);
}

function rectVertices(rect: Rect) {
  return [
    rect.x,
    rect.y,
    rect.x + rect.width,
    rect.y,
    rect.x,
    rect.y + rect.height,
    rect.x,
    rect.y + rect.height,
    rect.x + rect.width,
    rect.y,
    rect.x + rect.width,
    rect.y + rect.height,
  ];
}

function drawTriangle(state: WebGlRendererState, triangle: DrawTriangle) {
  const { gl } = state;
  gl.uniform4fv(state.colorLocation, triangle.color);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle.vertices), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(state.positionLocation);
  gl.vertexAttribPointer(state.positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, triangle.vertices.length / 2);
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (program === null) throw new Error("Could not create WebGL program.");

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Could not link WebGL program.");
  }

  return program;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (shader === null) throw new Error("Could not create WebGL shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Could not compile WebGL shader.");
  }

  return shader;
}

function parseColor(color: string): Color {
  const hex = /^#?([0-9a-f]{6})$/i.exec(color);
  if (hex !== null) {
    const value = Number.parseInt(hex[1]!, 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1];
  }

  return [17 / 255, 17 / 255, 17 / 255, 1];
}

type Point = {
  x: number;
  y: number;
};

const vertexShaderSource = `
attribute vec2 a_position;
uniform vec2 u_resolution;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;
uniform vec4 u_color;

void main() {
  gl_FragColor = u_color;
}
`;
