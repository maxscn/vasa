import type { BoxNode } from "@skriva/layout";
import type { PdfPrimitiveProps } from "../primitives.js";
type PdfElementHostNode = {
  type: string;
  props: PdfPrimitiveProps;
  children: PdfHostNode[];
};
type PdfTextInstanceHostNode = {
  type: "textInstance";
  text: string;
  children: [];
};
export type PdfHostNode = PdfElementHostNode | PdfTextInstanceHostNode;
export type PdfRootContainer = {
  children: PdfHostNode[];
};
export declare function renderReactToLayoutTree(element: unknown): BoxNode;
export declare function createPdfRootContainer(): PdfRootContainer;
