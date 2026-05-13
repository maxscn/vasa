import { type BoxNode, type TextStyle } from "@skriva/layout";
import { createElement, type ReactElement, type ReactNode } from "react";

export type CanvasPrimitiveType = string;

export type CanvasPrimitiveProps = {
  id?: string;
  style?: BoxNode["style"] | TextStyle;
  children?: ReactNode;
  [key: string]: unknown;
};

export type CanvasTextProps = CanvasPrimitiveProps & {
  text?: string;
};

export type CanvasPrimitiveComponent<TProps extends CanvasPrimitiveProps = CanvasPrimitiveProps> = (
  props: TProps,
) => ReactElement;

export function createCanvasPrimitive<TProps extends CanvasPrimitiveProps = CanvasPrimitiveProps>(
  type: CanvasPrimitiveType,
): CanvasPrimitiveComponent<TProps> {
  return function CanvasPrimitive(props: TProps) {
    return createElement(type, props);
  };
}
