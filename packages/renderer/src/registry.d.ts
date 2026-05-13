import type { RenderComponent, RendererExtension, RenderRegistry } from "./types.js";
export declare function createRenderRegistry(components?: RenderComponent[]): RenderRegistry;
export declare function extensionToRenderComponent(extension: RendererExtension): RenderComponent;
export declare function createDocumentRegistry({
  extensions,
  registry,
}: {
  extensions?: RendererExtension[];
  registry?: RenderRegistry;
}): RenderRegistry;
