export {
  createSkrivaSurfaceAdapter,
  type CreateSkrivaSurfaceAdapterOptions,
  type SkrivaDeleteIntent,
  type SkrivaSelectionIntent,
  type SkrivaShortcut,
  type SkrivaSurfaceAdapter,
  type SkrivaSurfacePoint,
} from "./adapter.ts";
export {
  createTextareaBrowserInputAdapter,
  type CreateTextareaBrowserInputAdapterOptions,
  type BrowserInputAdapter,
  type SurfaceClipboardIntent,
  type SurfaceIntent,
  type SurfaceSelectionIntent,
  type SurfaceTextIntent,
} from "./browser-input.ts";
export {
  createPlainTextClipboardAdapter,
  type ClipboardAdapter,
  type ClipboardSource,
  type ClipboardTarget,
} from "./clipboard.ts";
export {
  createProjectSurfaceSelection,
  createProjectSurfaceLineSelection,
  createProjectSurfaceWordSelection,
  proseMirrorPositionToSurfacePoint,
  proseMirrorSelectionToSurfaceSelection,
  surfacePointToProseMirrorPosition,
  type ProjectSurfaceSelection,
  type SurfaceSelection,
} from "./selection.ts";
