import type { PdfCommand } from "@skriva/pdf";
export declare const tablePdfRenderer: {
  name: string;
  toPdfCommands({
    node,
    renderNode,
  }: import("@skriva/pdf").PdfRenderNodeContext): PdfCommand[] | undefined;
};
