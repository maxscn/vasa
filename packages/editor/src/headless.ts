import {
  Canvas,
  Scene,
  type CanvasRenderResult,
  type CanvasRendererExtension,
  type CanvasRendererOptions,
  type CanvasSurface,
} from "@skriva/canvas";
import {
  collectExtensionRenderers,
  collectLayoutExtensions,
  collectRendererExtensions,
  type JSONContent,
  type SkrivaExtension,
} from "@skriva/core";
import type { SkrivaFont } from "@skriva/font";
import {
  type BoxNode,
  type LayoutNode,
  type LayoutOptions,
  type LayoutResult,
  type TextMeasurer,
} from "@skriva/layout";
import {
  renderSceneGraphToPdf,
  type PdfMetadata,
  type PdfRenderOptions,
  type PdfRenderResult,
  type PdfRendererExtension,
} from "@skriva/pdf";
import {
  collectMissingCustomRenderNodeCoverage,
  createRenderDocument,
  type RenderDocument,
} from "@skriva/renderer";
import {
  createEditorRenderTextMeasurer,
  createEditorRenderPipeline,
  type EditorCanvasTextPaint,
  type EditorPdfOutlineText,
  type EditorRenderProfileOptions,
  type EditorRenderTextNodeSource,
  type EditorTextBoxSource,
} from "./render-profile.ts";

export type SkrivaHeadlessEnrichment = SkrivaExtension<{
  canvas: CanvasRendererExtension;
  pdf: PdfRendererExtension;
}>;

export type SkrivaHeadlessRenderProfile = EditorRenderProfileOptions;

export type SkrivaLogicLayer = {
  getJSON(): JSONContent;
};

export type SkrivaDiagnosticPolicy = "off" | "warn" | "error";

export type SkrivaVisualDiagnostic = {
  code: "unsupported-node" | "unsupported-mark" | "missing-pdf-coverage";
  message: string;
  severity: "warning" | "error";
  schemaName?: string;
  sceneNodeName?: string;
  path: string;
};

export type CreateSkrivaHeadlessRenderModelOptions = {
  logicLayer?: SkrivaLogicLayer;
  document?: JSONContent;
  page: LayoutOptions["page"];
  profile: SkrivaHeadlessRenderProfile;
  enrichments?: SkrivaHeadlessEnrichment[];
  measurer?: TextMeasurer;
  rootStyle?: BoxNode["style"];
  paragraphStyle?: BoxNode["style"];
  extraChildren?: LayoutNode[];
  textGrid?: boolean;
  diagnosticPolicy?: SkrivaDiagnosticPolicy;
  onDiagnostic?: (diagnostic: SkrivaVisualDiagnostic) => void;
};

export type SkrivaHeadlessRenderModel = {
  sourceDocument: JSONContent;
  diagnostics: SkrivaVisualDiagnostic[];
  createCanvasScene: (
    options?: Omit<CanvasRendererOptions, "extensions" | "text">,
  ) => ReturnType<typeof Scene>;
  renderCanvas: (
    surface: CanvasSurface,
    options?: Omit<CanvasRendererOptions, "extensions" | "text">,
  ) => CanvasRenderResult;
  renderPdf: (
    options?: Omit<
      PdfRenderOptions,
      "extensions" | "layout" | "measurer" | "outlineText" | "page" | "renderers"
    >,
  ) => PdfRenderResult<undefined>;
  supportsPdfTextMode: (mode: "native" | "outline" | "embedded") => boolean;
};

export type SkrivaHeadlessRenderModelInspection = {
  logicLayer?: SkrivaLogicLayer;
  layoutTree: BoxNode;
  layout: LayoutResult;
  documentSceneGraph: RenderDocument;
  enrichments: SkrivaHeadlessEnrichment[];
  layoutExtensions: ReturnType<typeof collectLayoutExtensions>;
  sceneExtensions: ReturnType<typeof collectRendererExtensions>;
  canvasRenderers: CanvasRendererExtension[];
  pdfRenderers: PdfRendererExtension[];
  canvasTextPaint: (box: EditorTextBoxSource, lineIndex: number) => EditorCanvasTextPaint;
  pdfOutlineText: (
    node: EditorRenderTextNodeSource,
    lineIndex: number,
  ) => EditorPdfOutlineText | undefined;
};

const renderModelInspections = new WeakMap<
  SkrivaHeadlessRenderModel,
  SkrivaHeadlessRenderModelInspection
>();

export function createSkrivaHeadlessRenderModel(
  options: CreateSkrivaHeadlessRenderModelOptions,
): SkrivaHeadlessRenderModel {
  const document = resolveHeadlessDocument(options);
  const enrichments = options.enrichments ?? [];
  const layoutExtensions = collectLayoutExtensions(enrichments);
  const sceneExtensions = collectRendererExtensions(enrichments);
  const canvasRenderers = collectExtensionRenderers(enrichments, "canvas");
  const pdfRenderers = collectExtensionRenderers(enrichments, "pdf");
  const measurer = options.measurer ?? createEditorRenderTextMeasurer(options.profile);
  const pipeline = createEditorRenderPipeline({
    doc: document as JSONContent,
    page: options.page,
    measurer,
    profile: options.profile,
    rootStyle: options.rootStyle,
    paragraphStyle: options.paragraphStyle,
    extraChildren: options.extraChildren,
    textGrid: options.textGrid,
    layoutExtensions,
    rendererExtensions: sceneExtensions,
    createRenderDocument,
  });
  const diagnostics = shouldCollectVisualDiagnostics(options)
    ? collectVisualDiagnostics(document, pipeline.renderDocument, pdfRenderers, enrichments)
    : [];
  reportVisualDiagnostics(diagnostics, options);

  const inspection: SkrivaHeadlessRenderModelInspection = {
    logicLayer: options.logicLayer,
    layoutTree: pipeline.layoutTree,
    layout: pipeline.layout,
    documentSceneGraph: pipeline.renderDocument,
    enrichments,
    layoutExtensions,
    sceneExtensions,
    canvasRenderers,
    pdfRenderers,
    canvasTextPaint: pipeline.canvasTextPaint,
    pdfOutlineText: pipeline.pdfOutlineText,
  };

  return createResolvedHeadlessRenderModel({
    ...options,
    sourceDocument: document,
    diagnostics,
    inspection,
  });
}

export function inspectSkrivaHeadlessRenderModel(
  model: SkrivaHeadlessRenderModel,
): SkrivaHeadlessRenderModelInspection {
  const inspection = renderModelInspections.get(model);
  if (inspection === undefined) {
    throw new Error("Skriva render model inspection is only available for local render models.");
  }
  return inspection;
}

function shouldCollectVisualDiagnostics(options: CreateSkrivaHeadlessRenderModelOptions) {
  return (
    options.diagnosticPolicy === "warn" ||
    options.diagnosticPolicy === "error" ||
    options.onDiagnostic !== undefined
  );
}

function resolveHeadlessDocument(options: CreateSkrivaHeadlessRenderModelOptions): JSONContent {
  const document = options.logicLayer?.getJSON() ?? options.document;
  if (document === undefined) {
    throw new Error("Skriva headless rendering requires either a Tiptap logicLayer or document.");
  }

  return document;
}

function createResolvedHeadlessRenderModel(
  options: CreateSkrivaHeadlessRenderModelOptions & {
    sourceDocument: JSONContent;
    diagnostics: SkrivaVisualDiagnostic[];
    inspection: SkrivaHeadlessRenderModelInspection;
  },
): SkrivaHeadlessRenderModel {
  const model: SkrivaHeadlessRenderModel = {
    sourceDocument: options.sourceDocument,
    diagnostics: options.diagnostics,
    createCanvasScene: (sceneOptions = {}) =>
      Scene(options.inspection.documentSceneGraph, {
        ...sceneOptions,
        extensions: options.inspection.canvasRenderers,
        text: options.inspection.canvasTextPaint,
      }),
    renderCanvas: (surface, canvasOptions = {}) =>
      Canvas(surface, {
        ...canvasOptions,
        extensions: options.inspection.canvasRenderers,
        text: options.inspection.canvasTextPaint,
      }).render(options.inspection.documentSceneGraph),
    renderPdf: (pdfOptions = {}) =>
      renderSceneGraphToPdf(options.inspection.documentSceneGraph, {
        ...pdfOptions,
        page: options.page,
        renderers: options.inspection.pdfRenderers,
        outlineText: options.inspection.pdfOutlineText,
      } as Parameters<typeof renderSceneGraphToPdf>[1] & { metadata?: PdfMetadata }),
    supportsPdfTextMode: (mode) =>
      mode === "native" || options.inspection.pdfOutlineText !== undefined,
  };
  renderModelInspections.set(model, options.inspection);
  return model;
}

function collectVisualDiagnostics(
  document: JSONContent,
  sceneGraph: RenderDocument,
  pdfRenderers: PdfRendererExtension[],
  enrichments: SkrivaHeadlessEnrichment[],
): SkrivaVisualDiagnostic[] {
  const supported = supportedSchemaNames(enrichments);
  const diagnostics: SkrivaVisualDiagnostic[] = [];

  visitJsonContent(document, "", (node, path) => {
    const type = node.type;
    if (type !== undefined && !supported.nodes.has(type)) {
      diagnostics.push({
        code: "unsupported-node",
        message: `No Skriva visual coverage is registered for node "${type}".`,
        severity: "warning",
        schemaName: type,
        path,
      });
    }

    for (const [markIndex, mark] of (node.marks ?? []).entries()) {
      const markType = mark.type;
      if (markType !== undefined && !supported.marks.has(markType)) {
        diagnostics.push({
          code: "unsupported-mark",
          message: `No Skriva visual coverage is registered for mark "${markType}".`,
          severity: "warning",
          schemaName: markType,
          path: `${path}.marks.${markIndex}`,
        });
      }
    }
  });

  for (const missing of collectMissingCustomRenderNodeCoverage(
    sceneGraph,
    pdfRenderers.map((renderer) => renderer.name),
  )) {
    diagnostics.push({
      code: "missing-pdf-coverage",
      message: `No native PDF coverage is registered for scene node "${missing.name}".`,
      severity: "warning",
      sceneNodeName: missing.name,
      path: missing.path,
    });
  }

  return diagnostics;
}

function supportedSchemaNames(enrichments: SkrivaHeadlessEnrichment[]) {
  const enrichmentNames = enrichments.map((enrichment) => enrichment.name);
  return {
    nodes: new Set([
      "doc",
      "paragraph",
      "text",
      "heading",
      "blockquote",
      "horizontalRule",
      "table",
      "tableRow",
      "tableCell",
      "tableHeader",
      "svg",
      ...enrichmentNames,
    ]),
    marks: new Set([
      "bold",
      "code",
      "color",
      "fontFamily",
      "fontSize",
      "highlight",
      "italic",
      "lineHeight",
      "strike",
      "subscript",
      "superscript",
      "textStyle",
      "underline",
      ...enrichmentNames,
    ]),
  };
}

function visitJsonContent(
  node: JSONContent,
  path: string,
  visit: (node: JSONContent, path: string) => void,
) {
  visit(node, path);
  for (const [index, child] of (node.content ?? []).entries()) {
    visitJsonContent(child, path.length === 0 ? String(index) : `${path}.${index}`, visit);
  }
}

function reportVisualDiagnostics(
  diagnostics: SkrivaVisualDiagnostic[],
  options: Pick<CreateSkrivaHeadlessRenderModelOptions, "diagnosticPolicy" | "onDiagnostic">,
) {
  const policy = options.diagnosticPolicy ?? "warn";
  if (policy === "off") return;

  for (const diagnostic of diagnostics) {
    const reported =
      policy === "error" ? { ...diagnostic, severity: "error" as const } : diagnostic;
    options.onDiagnostic?.(reported);
    if (policy === "error") throw new Error(reported.message);
  }
}

export function createSkrivaRenderProfile(options: {
  fonts: SkrivaFont[];
  defaultFontId: string;
  fallbackFont: SkrivaFont;
  fontSize: number;
  lineHeight: number;
  textColor?: string;
  whiteSpace?: SkrivaHeadlessRenderProfile["whiteSpace"];
  wordBreak?: SkrivaHeadlessRenderProfile["wordBreak"];
  outlinePixelSnap?: number;
}): SkrivaHeadlessRenderProfile {
  return options;
}
