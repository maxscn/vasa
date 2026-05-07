import {
  type BoxNode,
  type LayoutOptions,
  type LayoutResult,
  type Rect,
  type TextStyle,
} from "@vasa/layout";
import {
  type RenderDocument,
  type RenderCustomNode,
  type RenderTextNode,
  type SvgPath,
  type TextOutlineFont,
  type TextOutlinePath,
} from "@vasa/renderer";
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
export type PdfRenderOptions = LayoutOptions & {
  metadata?: PdfMetadata;
  outlineText?: PdfOutlineTextOptions | PdfOutlineTextResolver;
  textMode?: "native" | "outline" | "embedded";
  defaultTextFill?: string;
  selectableText?: boolean;
  renderers?: PdfRendererExtension[];
};
export type PdfMetadata = {
  title?: string;
  author?: string;
};
export type PdfOutlineTextOptions = {
  font: TextOutlineFont;
  fontSize?: number;
  fill?: string;
  letterSpacing?: number;
  embolden?: number;
  skewX?: number;
};
export type PdfOutlineTextResolver = (
  node: RenderTextNode,
  lineIndex: number,
) => PdfOutlineTextOptions | undefined;
export type PdfCommand =
  | {
      type: "beginPage";
      index: number;
      rect: Rect;
    }
  | {
      type: "text";
      text: string;
      x: number;
      y: number;
      fontSize: number;
      fontWeight?: string;
      fontStyle?: string;
      fill?: string;
      invisible?: boolean;
      embeddedFont?: PdfEmbeddedFont;
    }
  | {
      type: "textPath";
      path: TextOutlinePath;
      fill: string;
    }
  | {
      type: "rect";
      rect: Rect;
      fill: string;
    }
  | {
      type: "path";
      path: SvgPath;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    };
export type PdfRendererExtension = {
  name: string;
  toPdfCommands?: (context: PdfRenderNodeContext) => PdfCommand[] | undefined;
};
export type PdfRenderNodeContext = {
  node: RenderCustomNode;
};
export type PdfRenderResult = {
  layout: LayoutResult;
  commands: PdfCommand[];
  bytes: Uint8Array;
  compressedBytes: () => Promise<Uint8Array>;
};
export type PdfEmbeddedFont = {
  font: TextOutlineFont;
  fill?: string;
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
export declare function renderDocumentToPdf(
  document: BoxNode,
  options: PdfRenderOptions,
): PdfRenderResult;
export declare function renderReactToPdf(
  element: unknown,
  options: PdfRenderOptions,
): PdfRenderResult;
export declare function renderReactToLayoutTree(element: unknown): BoxNode;
export declare function createPdfCommands(
  document: LayoutResult | RenderDocument,
  page: LayoutOptions["page"],
  options?: Pick<
    PdfRenderOptions,
    "defaultTextFill" | "outlineText" | "renderers" | "selectableText" | "textMode"
  >,
): PdfCommand[];
export declare function writePdf(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  metadata?: PdfMetadata,
): Uint8Array;
export declare function writePdfAsync(
  commands: PdfCommand[],
  page: LayoutOptions["page"],
  metadata?: PdfMetadata,
): Promise<Uint8Array>;
export declare function createPdfRootContainer(): PdfRootContainer;
