import type {
  RenderBoxNode,
  RenderComponent,
  RenderCustomNode,
  RenderNodeContext,
  RenderTextNode,
} from "./types.js";

export const defaultRenderComponents: RenderComponent[] = [
  {
    name: "text",
    match: ({ box }) => box.type === "text",
    render: renderTextComponent,
  },
  {
    name: "box",
    match: ({ box }) => box.type === "box",
    render: renderBoxComponent,
  },
];

export const unsupportedRenderComponent: RenderComponent = {
  name: "unsupported",
  match: () => true,
  render: renderUnsupportedComponent,
};

export function renderBoxComponent({ box, key, children }: RenderNodeContext): RenderBoxNode {
  return {
    key,
    kind: "box",
    sourceId: box.id,
    rect: box.rect,
    props: box.props,
    children,
  };
}

export function renderTextComponent({ box, key }: RenderNodeContext): RenderTextNode {
  return {
    key,
    kind: "text",
    sourceId: box.id,
    rect: box.rect,
    text: box.text ?? "",
    lines: box.lines ?? [],
    visualLines: box.visualLines,
    ...(box.textGrid === undefined ? {} : { textGrid: box.textGrid }),
    children: [],
  };
}

function renderUnsupportedComponent({ box, key, children }: RenderNodeContext): RenderCustomNode {
  return {
    key,
    kind: "custom",
    sourceId: box.id,
    name: box.type,
    rect: box.rect,
    props: box.props,
    children,
  };
}
