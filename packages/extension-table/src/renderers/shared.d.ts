import type { Rect } from "@skriva/layout";
import type { RenderCustomNode, SvgPath } from "@skriva/renderer";
export declare function rectPath(rect: Rect): SvgPath;
export declare function tableBorderColor(node: RenderCustomNode): string;
export declare function tableBorderWidth(node: RenderCustomNode): number;
export declare function tableCellBackground(node: RenderCustomNode): string | undefined;
export declare function isTableRenderNode(node: RenderCustomNode): boolean;
export declare function isTableCellNode(node: RenderCustomNode): boolean;
