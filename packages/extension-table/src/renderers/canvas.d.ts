export declare const tableCanvasRenderer: {
  name: string;
  toCanvasNodes({
    node,
    yOffset,
    renderNode,
  }: import("@skriva/canvas").CanvasRenderNodeContext):
    | import("@skriva/canvas").CanvasSerializableNode[]
    | undefined;
};
