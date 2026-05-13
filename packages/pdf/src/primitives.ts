import type { BoxNode, TextStyle } from "@skriva/layout";
import { createElement, type ReactElement, type ReactNode } from "react";

export type PdfPrimitiveType = string;

export type PdfPrimitiveProps = {
  id?: string;
  style?: BoxNode["style"] | TextStyle;
  children?: ReactNode;
  [key: string]: unknown;
};

export type PdfTextProps = PdfPrimitiveProps & {
  text?: string;
};

export type PdfPrimitiveComponent<TProps extends PdfPrimitiveProps = PdfPrimitiveProps> = (
  props: TProps,
) => ReactElement;

export function createPdfPrimitive<TProps extends PdfPrimitiveProps = PdfPrimitiveProps>(
  type: PdfPrimitiveType,
): PdfPrimitiveComponent<TProps> {
  return function PdfPrimitive(props: TProps) {
    return createElement(type, props);
  };
}

export const Document = createPdfPrimitive("document");
export const View = createPdfPrimitive("view");
export const Box = createPdfPrimitive("box");
export const Text = createPdfPrimitive<PdfTextProps>("text");
