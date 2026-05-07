import type { EditorJson } from "./index.ts";

export function createEditorParityDocument(): EditorJson {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Vasa editor parity sheet" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Combined marks should stay glued together: " },
          { type: "text", text: "bold italic", marks: [{ type: "bold" }, { type: "italic" }] },
          { type: "text", text: ", " },
          { type: "text", text: "underlined", marks: [{ type: "underline" }] },
          { type: "text", text: ", and " },
          { type: "text", text: "struck text", marks: [{ type: "strike" }] },
          { type: "text", text: "." },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Highlight, color, and code: " },
          {
            type: "text",
            text: "yellow note",
            marks: [{ type: "highlight", attrs: { color: "#fef08a" } }],
          },
          { type: "text", text: ", " },
          {
            type: "text",
            text: "blue text",
            marks: [{ type: "textStyle", attrs: { color: "#2563eb" } }],
          },
          { type: "text", text: ", and " },
          { type: "text", text: "inline code", marks: [{ type: "code" }] },
          { type: "text", text: "." },
        ],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Script baselines: H" },
          { type: "text", text: "2", marks: [{ type: "subscript" }] },
          { type: "text", text: "O and E=mc" },
          { type: "text", text: "2", marks: [{ type: "superscript" }] },
          { type: "text", text: " should line up in canvas and PDF." },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Renderer parity heading" }],
      },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Blockquote content keeps renderer geometry shared." }],
          },
        ],
      },
      {
        type: "horizontalRule",
      },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Surface" }] }],
              },
              {
                type: "tableHeader",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Mapping" }] }],
              },
            ],
          },
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Canvas" }] }],
              },
              {
                type: "tableCell",
                content: [{ type: "paragraph", content: [{ type: "text", text: "PDF" }] }],
              },
            ],
          },
        ],
      },
    ],
  };
}
