import type { AnyExtension } from "@tiptap/core";
import type { AnyLayoutExtension } from "@vasa/layout";
import type { RendererExtension } from "@vasa/renderer";

export * from "@tiptap/core";

export type MaybeArray<T> = T | T[];
export type ExtensionRendererPlacement = "before" | "after";

export type VasaExtensionRenderers<
  TRenderers extends Record<string, unknown> = Record<string, unknown>,
> = {
  [TName in keyof TRenderers]?: MaybeArray<TRenderers[TName]>;
};

export type VasaExtension<TRenderers extends Record<string, unknown> = Record<string, unknown>> = {
  name: string;
  tiptap?: AnyExtension;
  layout?: AnyLayoutExtension | AnyLayoutExtension[];
  renderers?: VasaExtensionRenderers<TRenderers>;
  renderer?: RendererExtension | RendererExtension[];
};

export function createVasaExtension<TRenderers extends Record<string, unknown>>(
  extension: VasaExtension<TRenderers>,
): VasaExtension<TRenderers> {
  return extension;
}

export function collectRendererExtensions(extensions: VasaExtension[]): RendererExtension[] {
  return extensions.flatMap((extension) => {
    if (extension.renderer === undefined) return [];
    return Array.isArray(extension.renderer) ? extension.renderer : [extension.renderer];
  });
}

export function collectLayoutExtensions(extensions: VasaExtension[]): AnyLayoutExtension[] {
  return extensions.flatMap((extension) => {
    if (extension.layout === undefined) return [];
    return Array.isArray(extension.layout) ? extension.layout : [extension.layout];
  });
}

export function collectExtensionRenderers<
  TRenderers extends Record<string, unknown>,
  TName extends keyof TRenderers,
>(extensions: Array<VasaExtension<TRenderers>>, name: TName): Array<TRenderers[TName]> {
  return extensions.flatMap((extension) => {
    const renderer = extension.renderers?.[name];
    if (renderer === undefined) return [];
    return Array.isArray(renderer) ? renderer : [renderer];
  });
}

export function mergeExtensionRenderers<T>(
  defaultRenderer: T,
  renderer: MaybeArray<T> | undefined,
  placement: ExtensionRendererPlacement = "after",
): MaybeArray<T> {
  if (renderer === undefined) return defaultRenderer;

  const renderers = Array.isArray(renderer) ? renderer : [renderer];
  return placement === "before" ? [...renderers, defaultRenderer] : [defaultRenderer, ...renderers];
}
