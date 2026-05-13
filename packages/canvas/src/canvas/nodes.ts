import type {
  CanvasBoxNode,
  CanvasPathNode,
  CanvasSerializableBoxNode,
  CanvasSerializablePathNode,
  CanvasSerializableTextLineNode,
  CanvasTextLineNode,
  SceneNodeSnapshot,
} from "./types.js";

export function BoxNode(props: CanvasBoxNode): CanvasSerializableBoxNode {
  return withSerializer(props, () => ({
    kind: "box",
    props: {
      rect: props.rect,
      fill: props.fill,
      stroke: props.stroke,
    },
  }));
}

export function TextLineNode(props: CanvasTextLineNode): CanvasSerializableTextLineNode {
  return withSerializer(props, () => ({
    kind: "textLine",
    props: {
      text: props.text,
      x: props.x,
      y: props.y,
      width: props.width,
      height: props.height,
      font: props.font,
      fill: props.fill,
      ...(props.outline === undefined ? {} : { outline: props.outline }),
    },
  }));
}

export function PathNode(props: CanvasPathNode): CanvasSerializablePathNode {
  return withSerializer(props, () => ({
    kind: "path",
    props: {
      path: props.path,
      fill: props.fill,
      stroke: props.stroke,
      strokeWidth: props.strokeWidth,
    },
  }));
}

function withSerializer<TNode extends object>(
  node: TNode,
  serialize: () => SceneNodeSnapshot,
): TNode & { serialize(): SceneNodeSnapshot } {
  return Object.defineProperty(node, "serialize", {
    value: serialize,
    enumerable: false,
  }) as TNode & { serialize(): SceneNodeSnapshot };
}
