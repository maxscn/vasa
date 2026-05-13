export {
  defaultRenderComponents,
  renderBoxComponent,
  renderTextComponent,
  unsupportedRenderComponent,
} from "./components.js";
export { createRenderDocument } from "./document.js";
export {
  createDocumentRegistry,
  createRenderRegistry,
  extensionToRenderComponent,
} from "./registry.js";
export {
  collectCustomRenderNodeNames,
  collectMissingCustomRenderNodeCoverage,
  type MissingCustomRenderNodeCoverage,
} from "./coverage.js";
import type { Renderer } from "./types.js";
export type {
  CreateRenderDocumentInput,
  CreateRenderDocumentOptions,
  RenderBoxNode,
  RenderComponent,
  RenderCustomNode,
  RenderDocument,
  Renderer,
  RendererExtension,
  RenderNode,
  RenderNodeContext,
  RenderPage,
  RenderRegistry,
  RenderTextNode,
} from "./types.js";
export {
  createTextLineOutline,
  parseTextOutlineFont,
  textOutlinePathBounds,
  type TextOutlineFont,
  type TextOutlineFontOptions,
  type TextOutlineOptions,
  type TextOutlinePath,
  type TextOutlinePathCommand,
} from "./text-outline.js";
export {
  parseSvgPathData,
  parseSvgViewBox,
  transformSvgPath,
  type SvgPath,
  type SvgPathCommand,
  type SvgViewBox,
} from "./svg-path.js";
export declare function createRenderer<TResult, TOptions = undefined>(
  renderer: Renderer<TResult, TOptions>,
): Renderer<TResult, TOptions>;
