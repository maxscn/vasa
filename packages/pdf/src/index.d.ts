import { type BoxNode, type LayoutOptions, type LayoutResult, type Rect } from "@skriva/layout";
import {
  type RenderDocument,
  type RenderNode,
  type RenderCustomNode,
  type RenderTextNode,
  type SvgPath,
  type TextOutlineFont,
  type TextOutlinePath,
} from "@skriva/renderer";
export {
  Box,
  Document,
  Text,
  View,
  createPdfPrimitive,
  type PdfPrimitiveComponent,
  type PdfPrimitiveProps,
  type PdfPrimitiveType,
  type PdfTextProps,
} from "./primitives.js";
export {
  createPdfRootContainer,
  renderReactToLayoutTree,
  type PdfHostNode,
  type PdfRootContainer,
} from "./reconciler/index.js";
export type PdfRenderOptions = LayoutOptions & {
  metadata?: PdfMetadata;
  outlineText?: PdfOutlineTextOptions | PdfOutlineTextResolver;
  textMode?: "native" | "outline" | "embedded";
  defaultTextFill?: string;
  selectableText?: boolean;
  renderers?: PdfRendererExtension[];
};
export type PdfSceneGraphRenderOptions = {
  page: LayoutOptions["page"];
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
  renderNode: (node: RenderNode) => PdfCommand[];
};
export type PdfRenderResult<TLayout = LayoutResult> = {
  layout: TLayout;
  commands: PdfCommand[];
  bytes: Uint8Array;
  compressedBytes: () => Promise<Uint8Array>;
};
export type PdfEmbeddedFont = {
  font: TextOutlineFont;
  fill?: string;
};
export declare function renderDocumentToPdf(
  document: BoxNode,
  options: PdfRenderOptions,
): PdfRenderResult;
export declare function renderSceneGraphToPdf(
  document: RenderDocument,
  options: PdfSceneGraphRenderOptions,
): PdfRenderResult<undefined>;
export declare function renderReactToPdf(
  element: unknown,
  options: PdfRenderOptions,
): PdfRenderResult;
export declare class MissingPdfCoverageError extends Error {
  readonly sceneNodeName: string;
  readonly code = "missing-pdf-coverage";
  constructor(sceneNodeName: string);
}
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
