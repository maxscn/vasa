import type { Rect } from "@vasa/layout";
import type { RenderCustomNode, SvgPath } from "@vasa/renderer";
export declare function rectPath(rect: Rect): SvgPath;
export declare function tableBorderColor(node: RenderCustomNode): any;
export declare function tableBorderWidth(node: RenderCustomNode): number;
export declare function tableCellBackground(node: RenderCustomNode): any;
export declare function isTableRenderNode(node: RenderCustomNode): boolean;
export declare function isTableCellNode(node: RenderCustomNode): boolean;
