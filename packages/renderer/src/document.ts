import type { LayoutBox, LayoutPage, Rect } from "@skriva/layout";
import { createDocumentRegistry } from "./registry.js";
import type {
  CreateRenderDocumentInput,
  CreateRenderDocumentOptions,
  RenderDocument,
  RenderNode,
  RenderNodeContext,
  RenderRegistry,
} from "./types.js";

export function createRenderDocument(
  layout: CreateRenderDocumentInput,
  options: CreateRenderDocumentOptions = {},
): RenderDocument {
  const registry = createDocumentRegistry(options);

  return {
    pages: layout.pages.map((page) => ({
      index: page.index,
      rect: pageRect(page),
      content: page.content,
      nodes: page.boxes.map((box, index) => renderLayoutBox(box, page, String(index), registry)),
    })),
  };
}

function renderLayoutBox(
  box: LayoutBox,
  page: LayoutPage,
  path: string,
  registry: RenderRegistry,
): RenderNode {
  const key = nodeKey(box, path);
  const children = box.children.map((child, index) =>
    renderLayoutBox(child, page, `${path}.${index}`, registry),
  );
  const context: RenderNodeContext = { box, page, key, path, children };
  return registry.resolve(context).render(context);
}

function nodeKey(box: LayoutBox, path: string) {
  return `${box.type}:${box.id ?? path}`;
}

function pageRect(page: LayoutPage): Rect {
  return page.bounds;
}
