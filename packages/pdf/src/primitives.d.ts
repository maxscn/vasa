import type { BoxNode, TextStyle } from "@skriva/layout";
import { type ReactElement, type ReactNode } from "react";
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
export declare function createPdfPrimitive<TProps extends PdfPrimitiveProps = PdfPrimitiveProps>(
  type: PdfPrimitiveType,
): PdfPrimitiveComponent<TProps>;
export declare const Document: PdfPrimitiveComponent<PdfPrimitiveProps>;
export declare const View: PdfPrimitiveComponent<PdfPrimitiveProps>;
export declare const Box: PdfPrimitiveComponent<PdfPrimitiveProps>;
export declare const Text: PdfPrimitiveComponent<PdfTextProps>;
