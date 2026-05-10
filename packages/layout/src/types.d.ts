export type Length = number | `${number}%` | "auto";
export type DefiniteLength = number | `${number}%`;
export interface LayoutNodeByType {
  box: BoxNode;
  inlineText: InlineTextNode;
  text: TextNode;
}
export type LayoutNode = LayoutNodeByType[keyof LayoutNodeByType] & LayoutNodeBase;
export type LayoutNodeBase<TType extends string = string> = {
  type: TType;
  id?: string;
  style?: MeasurableStyle;
  pagination?: LayoutNodePagination;
};
export type LayoutNodePagination = {
  preserveEmptyHeight?: boolean;
};
export type BoxNode = {
  type: "box";
  id?: string;
  pagination?: LayoutNodePagination;
  style?: LayoutStyle;
  children?: LayoutNode[];
};
export type TextNode = {
  type: "text";
  id?: string;
  text: string;
  sourceText?: string;
  sourceStart?: number;
  sourceLineStarts?: number[];
  style?: TextStyle;
};
export type InlineTextNode = {
  type: "inlineText";
  id?: string;
  runs: TextRun[];
  style?: TextStyle;
};
export type TextRun = {
  id?: string;
  text: string;
  sourceText?: string;
  sourceStart?: number;
  style?: TextStyle;
};
export type LayoutStyle = {
  width?: Length;
  height?: Length;
  minWidth?: DefiniteLength;
  minHeight?: DefiniteLength;
  maxWidth?: DefiniteLength;
  maxHeight?: DefiniteLength;
  padding?: BoxEdges;
  margin?: BoxEdges;
  flexDirection?: "row" | "column";
  flexGrow?: number;
  flexShrink?: number;
  gap?: number;
};
export type TextStyle = {
  font?: string;
  lineHeight?: number;
  whiteSpace?: "normal" | "pre-wrap";
  wordBreak?: "normal" | "keep-all";
  letterSpacing?: number;
  color?: string;
  backgroundColor?: string;
  textDecorationLine?: "underline" | "line-through";
  textDecorationColor?: string;
  textDecorationOffset?: number;
  textDecorationThickness?: number;
  verticalAlign?: "sub" | "super";
  baselineShift?: number;
  width?: Length;
  height?: Length;
  margin?: BoxEdges;
};
export type MeasurableStyle = {
  width?: Length;
  height?: Length;
  margin?: BoxEdges;
};
export type BoxEdges =
  | number
  | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
      horizontal?: number;
      vertical?: number;
    };
export type ResolvedBoxEdges = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type PageSpec = {
  width: number;
  height: number;
  margin?: BoxEdges;
};
export type PageMarginGuide = "top" | "right" | "bottom" | "left";
export type PageMarginGuides = Record<PageMarginGuide, number>;
export type PageGeometry = {
  bounds: Rect;
  content: Rect;
  margin: ResolvedBoxEdges;
  guides: PageMarginGuides;
};
export type UpdatePageMarginGuideOptions = {
  minContentWidth?: number;
  minContentHeight?: number;
};
export type LayoutOptions = {
  page: PageSpec;
  measurer?: TextMeasurer;
  extensions?: AnyLayoutExtension[];
  textGrid?: boolean;
};
export type LayoutPage = {
  index: number;
  bounds: Rect;
  content: Rect;
  margin: ResolvedBoxEdges;
  boxes: LayoutBox[];
};
export type LayoutResult = {
  pages: LayoutPage[];
};
export type LayoutBox = {
  id?: string;
  type: string;
  rect: Rect;
  props?: Record<string, unknown>;
  text?: string;
  lines?: TextLine[];
  visualLines?: TextVisualLine[];
  textGrid?: LayoutTextGrid;
  children: LayoutBox[];
};
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type TextLine = {
  sourceId?: string;
  sourceText?: string;
  text: string;
  start?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  font?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  backgroundColor?: string;
  textDecorationLine?: "underline" | "line-through";
  textDecorationColor?: string;
  textDecorationOffset?: number;
  textDecorationThickness?: number;
  verticalAlign?: "sub" | "super";
  baselineShift?: number;
};
export type TextVisualLine = {
  x: number;
  y: number;
  width: number;
  height: number;
  fragments: TextLine[];
};
export type LayoutTextGrid = {
  rows: LayoutTextGridRow[];
  connections: LayoutTextGridConnection[];
};
export type LayoutTextGridRow = {
  y: number;
  height: number;
  spaces: LayoutTextGridSpace[];
};
export type LayoutTextGridSpace = {
  id: string;
  sourceId?: string;
  sourceText?: string;
  text: string;
  startOffset: number;
  endOffset: number;
  x: number;
  width: number;
};
export type LayoutTextGridBreak = "required" | "allowed" | "forbidden";
export type LayoutTextGridConnection = {
  from: string;
  to: string;
  break: LayoutTextGridBreak;
};
export type MeasureTextInput = {
  text: string;
  font: string;
  lineHeight: number;
  maxWidth: number;
  whiteSpace?: "normal" | "pre-wrap";
  wordBreak?: "normal" | "keep-all";
  letterSpacing?: number;
};
export type MeasureTextResult = {
  width: number;
  height: number;
  lineCount: number;
  lines: Array<{
    text: string;
    width: number;
    start?: number;
  }>;
};
export type TextMeasurer = {
  measureText(input: MeasureTextInput): MeasureTextResult;
};
export type MeasureMode = "exactly" | "at-most" | "undefined";
export type MeasureLayoutInput<TNode extends LayoutNode = LayoutNode> = {
  node: TNode;
  width: number;
  widthMode: MeasureMode;
  maxWidth: number;
  measurer: TextMeasurer;
};
export type MeasureLayoutResult = {
  width: number;
  height: number;
};
export type MaterializeLayoutInput<TNode extends LayoutNode = LayoutNode> = {
  node: TNode;
  rect: Rect;
  measurer: TextMeasurer;
  textGrid?: boolean;
};
export type SplitLayoutInput<TNode extends LayoutNode = LayoutNode> = {
  node: TNode;
  trial: LayoutPage;
  content: Rect;
};
export type SplitLayoutResult<TNode extends LayoutNode = LayoutNode> = {
  fitting?: TNode;
  remaining: TNode;
};
export type LayoutExtension<TNode extends LayoutNode = LayoutNode> = {
  name: string;
  match: (node: LayoutNode) => node is TNode;
  measure?: (input: MeasureLayoutInput<TNode>) => MeasureLayoutResult | undefined;
  materialize?: (input: MaterializeLayoutInput<TNode>) => LayoutBox | undefined;
  split?: (input: SplitLayoutInput<TNode>) => SplitLayoutResult<TNode> | undefined;
};
export type AnyLayoutExtension = LayoutExtension<any>;
