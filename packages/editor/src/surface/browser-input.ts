import type { SkrivaDeleteIntent, SkrivaShortcut, SkrivaSurfacePoint } from "./adapter.ts";

export type SurfaceTextIntent =
  | { type: "insertText"; text: string }
  | { type: "insertLineBreak" }
  | { type: "splitBlock" }
  | { type: "deleteBackward"; intent?: SkrivaDeleteIntent }
  | { type: "deleteForward"; intent?: SkrivaDeleteIntent }
  | { type: "runShortcut"; shortcut: SkrivaShortcut };

export type SurfaceSelectionIntent =
  | { type: "placeSelectionAt"; point: SkrivaSurfacePoint; extend?: boolean }
  | { type: "extendSelectionTo"; point: SkrivaSurfacePoint }
  | { type: "selectWordAt"; point: SkrivaSurfacePoint }
  | { type: "selectLineAt"; point: SkrivaSurfacePoint };

export type SurfaceClipboardIntent =
  | { type: "copySelection" }
  | { type: "cutSelection" }
  | { type: "pasteClipboard" };

export type SurfaceIntent = SurfaceTextIntent | SurfaceSelectionIntent | SurfaceClipboardIntent;

export type BrowserInputAdapter = {
  focus(): void;
  blur(): void;
  clear(): void;
  readInputEvent(event: InputEvent): SurfaceTextIntent | undefined;
  readClipboardEvent(event: ClipboardEvent): SurfaceClipboardIntent | undefined;
};

export type CreateTextareaBrowserInputAdapterOptions = {
  input: () => HTMLTextAreaElement | null;
};

export function createTextareaBrowserInputAdapter(
  options: CreateTextareaBrowserInputAdapterOptions,
): BrowserInputAdapter {
  return {
    focus() {
      options.input()?.focus({ preventScroll: true });
    },
    blur() {
      options.input()?.blur();
    },
    clear() {
      const input = options.input();
      if (input !== null) input.value = "";
    },
    readInputEvent(event) {
      if (event.inputType === "insertText" && event.data !== null) {
        return { type: "insertText", text: event.data };
      }

      if (event.inputType === "insertParagraph") return { type: "splitBlock" };
      if (event.inputType === "insertLineBreak") return { type: "insertLineBreak" };
      if (event.inputType === "deleteContentBackward") return { type: "deleteBackward" };
      if (event.inputType === "deleteContentForward") return { type: "deleteForward" };
      if (event.inputType === "historyUndo") {
        return { type: "runShortcut", shortcut: { key: "z", mod: true } };
      }
      if (event.inputType === "historyRedo") {
        return { type: "runShortcut", shortcut: { key: "z", mod: true, shift: true } };
      }

      return undefined;
    },
    readClipboardEvent(event) {
      if (event.type === "copy") return { type: "copySelection" };
      if (event.type === "cut") return { type: "cutSelection" };
      if (event.type === "paste") return { type: "pasteClipboard" };
      return undefined;
    },
  };
}
