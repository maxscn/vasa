import { defaultRenderComponents, unsupportedRenderComponent } from "./components.js";
import type { RenderComponent, RendererExtension, RenderRegistry } from "./types.js";

export function createRenderRegistry(components: RenderComponent[] = []): RenderRegistry {
  const registered = [...components];

  return {
    register(component) {
      registered.push(component);
    },
    resolve(context) {
      return (
        registered.find((component) => component.match(context)) ??
        defaultRenderComponents.find((component) => component.match(context)) ??
        unsupportedRenderComponent
      );
    },
    components() {
      return [...registered, ...defaultRenderComponents];
    },
  };
}

export function extensionToRenderComponent(extension: RendererExtension): RenderComponent {
  return {
    name: extension.name,
    match: (context) => extension.toRenderNode?.(context) !== undefined,
    render: (context) =>
      extension.toRenderNode?.(context) ?? unsupportedRenderComponent.render(context),
  };
}

export function createDocumentRegistry({
  extensions,
  registry,
}: {
  extensions?: RendererExtension[];
  registry?: RenderRegistry;
}): RenderRegistry {
  const documentRegistry = registry ?? createRenderRegistry();

  for (const extension of extensions ?? []) {
    documentRegistry.register(extensionToRenderComponent(extension));
  }

  return documentRegistry;
}
