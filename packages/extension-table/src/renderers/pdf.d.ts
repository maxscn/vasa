import type { PdfCommand } from "@vasa/pdf";
export declare const tablePdfRenderer: {
  name: string;
  toPdfCommands({ node }: import("@vasa/pdf").PdfRenderNodeContext): PdfCommand[] | undefined;
};
