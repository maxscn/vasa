import type { RenderBoxNode, RenderComponent, RenderNodeContext, RenderTextNode } from "./types.js";
export declare const defaultRenderComponents: RenderComponent[];
export declare const unsupportedRenderComponent: RenderComponent;
export declare function renderBoxComponent({
  box,
  key,
  children,
}: RenderNodeContext): RenderBoxNode;
export declare function renderTextComponent({ box, key }: RenderNodeContext): RenderTextNode;
