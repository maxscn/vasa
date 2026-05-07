import type { CanvasSurface } from "@vasa/canvas";
import {
  clientPointToEditorSelection,
  type EditorRenderLineDocument,
  type EditorRenderLineOptions,
  type EditorSelection,
} from "./index.ts";

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function domCanvasSurface(
  context: CanvasRenderingContext2D,
  defaultFont: string,
): CanvasSurface {
  return {
    clearRect: (x, y, width, height) => context.clearRect(x, y, width, height),
    fillRect: (x, y, width, height) => context.fillRect(x, y, width, height),
    strokeRect: (x, y, width, height) => context.strokeRect(x, y, width, height),
    fillText: (text, x, y) => context.fillText(text, x, y),
    beginPath: () => context.beginPath(),
    moveTo: (x, y) => context.moveTo(x, y),
    lineTo: (x, y) => context.lineTo(x, y),
    bezierCurveTo: (x1, y1, x2, y2, x, y) => context.bezierCurveTo(x1, y1, x2, y2, x, y),
    closePath: () => context.closePath(),
    fill: () => context.fill(),
    stroke: () => context.stroke(),
    set fillStyle(value: string | undefined) {
      context.fillStyle = value ?? "#000000";
    },
    set strokeStyle(value: string | undefined) {
      context.strokeStyle = value ?? "#000000";
    },
    get lineWidth() {
      return context.lineWidth;
    },
    set lineWidth(value) {
      context.lineWidth = value ?? 1;
    },
    get font() {
      return context.font;
    },
    set font(value) {
      context.font = value ?? defaultFont;
    },
    get textBaseline() {
      return context.textBaseline;
    },
    set textBaseline(value) {
      context.textBaseline = value ?? "top";
    },
  };
}

export async function rasterizePdfPreview(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  bytes: Uint8Array,
  pdfWorkerUrl: string,
  pageGap: number,
  isCancelled: () => boolean = () => false,
) {
  const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
  });
  const pdf = await loadingTask.promise;

  try {
    if (isCancelled()) return;

    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const pdfPage = await pdf.getPage(index + 1);
        return {
          page: pdfPage,
          viewport: pdfPage.getViewport({ scale: 1 }),
        };
      }),
    );
    if (isCancelled()) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(...pages.map(({ viewport }) => viewport.width));
    const height = pages.reduce(
      (total, { viewport }, index) => total + viewport.height + (index === 0 ? 0 : pageGap),
      0,
    );

    if (isCancelled()) return;

    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    let offsetY = 0;
    for (const { page: pdfPage, viewport } of pages) {
      if (isCancelled()) return;

      const pageCanvas = document.createElement("canvas");
      const pageContext = pageCanvas.getContext("2d");
      if (pageContext === null) continue;

      pageCanvas.width = Math.ceil(viewport.width * pixelRatio);
      pageCanvas.height = Math.ceil(viewport.height * pixelRatio);

      await pdfPage.render({
        canvas: pageCanvas,
        canvasContext: pageContext,
        viewport,
        background: "#fffdfa",
        transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
      }).promise;

      if (isCancelled()) return;

      context.drawImage(pageCanvas, 0, Math.round(offsetY * pixelRatio));
      offsetY += viewport.height + pageGap;
    }
  } finally {
    await pdf.destroy();
  }
}

export function hitTestCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  document: EditorRenderLineDocument,
  measureText: (text: string, font?: string) => number,
  renderLineOptions: EditorRenderLineOptions,
): EditorSelection | undefined {
  const canvasRect = canvas.getBoundingClientRect();
  return clientPointToEditorSelection(
    document,
    {
      clientLeft: canvasRect.left,
      clientTop: canvasRect.top,
      clientWidth: canvasRect.width,
      clientHeight: canvasRect.height,
      surfaceWidth: Number.parseFloat(canvas.style.width),
      surfaceHeight: Number.parseFloat(canvas.style.height),
    },
    { x: clientX, y: clientY },
    measureText,
    renderLineOptions,
  );
}
