import { useRef, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import {
  createSelection,
  editorTextLineAtSelection,
  selectLineAtPoint,
  selectWordAtPoint,
  type JSONContent,
  type EditorRenderLineDocument,
  type EditorRenderLineOptions,
  type EditorSelection,
  type EditorSelectionPoint,
  type SkrivaSurfaceAdapter,
} from "../src/internal.ts";
import { hitTestCanvas } from "../src/browser.ts";

type CanvasClickSequence = {
  button: number;
  clientX: number;
  clientY: number;
  count: number;
  pointerType: string;
  timeStamp: number;
};

export type UseEditorMovementOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  editorDocument: JSONContent;
  renderDocument: EditorRenderLineDocument;
  renderLineOptions: EditorRenderLineOptions;
  measureText: (text: string, font?: string) => number;
  currentSelection: () => EditorSelection;
  updateSelection: (
    nextSelection: EditorSelection | ((currentSelection: EditorSelection) => EditorSelection),
  ) => void;
  surfaceAdapter?: SkrivaSurfaceAdapter;
  focusKeyboardBridge: () => void;
  multiClickIntervalMs?: number;
  multiClickMaxDistancePx?: number;
};

export function useEditorMovement(options: UseEditorMovementOptions) {
  const dragAnchorRef = useRef<EditorSelectionPoint | undefined>(undefined);
  const canvasClickSequenceRef = useRef<CanvasClickSequence | undefined>(undefined);
  const multiClickIntervalMs = options.multiClickIntervalMs ?? 500;
  const multiClickMaxDistancePx = options.multiClickMaxDistancePx ?? 6;

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = options.canvasRef.current;
    if (canvas === null) return;

    event.preventDefault();
    options.focusKeyboardBridge();
    const point = hitTestCanvas(
      canvas,
      event.clientX,
      event.clientY,
      options.renderDocument,
      options.measureText,
      options.renderLineOptions,
    );
    if (point === undefined) return;

    const clickCount = updateCanvasClickSequence(event);

    if (clickCount >= 3) {
      dragAnchorRef.current = undefined;
      canvas.setPointerCapture(event.pointerId);
      const line = editorTextLineAtSelection(
        options.renderDocument,
        point,
        options.renderLineOptions,
      );
      options.surfaceAdapter?.selectLineAt(point, line);
      options.updateSelection(selectLineAtPoint(point, line));
      return;
    }

    if (clickCount === 2) {
      dragAnchorRef.current = undefined;
      canvas.setPointerCapture(event.pointerId);
      options.surfaceAdapter?.selectWordAt(point);
      options.updateSelection(selectWordAtPoint(options.editorDocument, point));
      return;
    }

    const currentSelection = options.currentSelection();
    const anchor = event.shiftKey ? (currentSelection.anchor ?? currentSelection) : point;
    dragAnchorRef.current = anchor;
    canvas.setPointerCapture(event.pointerId);
    if (event.shiftKey) {
      options.surfaceAdapter?.extendSelectionTo(point);
    } else {
      options.surfaceAdapter?.placeSelectionAt(point);
    }
    options.updateSelection(createSelection(point, event.shiftKey ? anchor : undefined));
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = options.canvasRef.current;
    const anchor = dragAnchorRef.current;
    if (canvas === null || anchor === undefined || event.buttons !== 1) return;

    const point = hitTestCanvas(
      canvas,
      event.clientX,
      event.clientY,
      options.renderDocument,
      options.measureText,
      options.renderLineOptions,
    );
    if (point !== undefined) {
      options.surfaceAdapter?.extendSelectionTo(point);
      options.updateSelection(createSelection(point, anchor));
    }
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    dragAnchorRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function updateCanvasClickSequence(event: ReactPointerEvent<HTMLCanvasElement>) {
    const previous = canvasClickSequenceRef.current;
    const isSameSequence =
      previous !== undefined &&
      event.timeStamp - previous.timeStamp <= multiClickIntervalMs &&
      event.button === previous.button &&
      event.pointerType === previous.pointerType &&
      Math.hypot(event.clientX - previous.clientX, event.clientY - previous.clientY) <=
        multiClickMaxDistancePx;
    const count = isSameSequence ? Math.min(previous.count + 1, 3) : 1;

    canvasClickSequenceRef.current = {
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      count,
      pointerType: event.pointerType,
      timeStamp: event.timeStamp,
    };

    return count;
  }

  return {
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  };
}

export type UseEditorMovementReturn = ReturnType<typeof useEditorMovement>;
