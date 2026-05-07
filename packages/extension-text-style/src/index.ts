import { Mark, type MaybeArray, type VasaExtension, type VasaExtensionRenderers } from "@vasa/core";

export type TextStyleAttributes = {
  fontId?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: "italic";
  color?: string;
  backgroundColor?: string;
  textDecorationLine?: "underline" | "line-through";
  textDecorationColor?: string;
  verticalAlign?: "sub" | "super";
  code?: boolean;
};

export type TextStyleMarkSpec = {
  type: string;
  attrs?: Record<string, unknown>;
};

type CommandProps = {
  commands: Record<string, (...args: unknown[]) => boolean>;
};

export type TextStyleExtensionRenderers = {
  textStyle: (context: { mark: TextStyleMarkSpec }) => TextStyleAttributes;
};

export type TextStyleExtensionOptions = {
  renderers?: VasaExtensionRenderers<TextStyleExtensionRenderers>;
};

const defaultTextStyleRenderers = {
  textStyle: ({ mark }) => ({
    ...(typeof mark.attrs?.fontId === "string" ? { fontId: mark.attrs.fontId } : {}),
    ...(typeof mark.attrs?.fontFamily === "string" ? { fontId: mark.attrs.fontFamily } : {}),
    ...(typeof mark.attrs?.fontSize === "number" ? { fontSize: mark.attrs.fontSize } : {}),
    ...(typeof mark.attrs?.fontWeight === "string" ? { fontWeight: mark.attrs.fontWeight } : {}),
    ...(mark.attrs?.fontStyle === "italic" ? { fontStyle: mark.attrs.fontStyle } : {}),
    ...(typeof mark.attrs?.color === "string" ? { color: mark.attrs.color } : {}),
    ...(typeof mark.attrs?.backgroundColor === "string"
      ? { backgroundColor: mark.attrs.backgroundColor }
      : {}),
    ...(mark.attrs?.textDecorationLine === "underline" ||
    mark.attrs?.textDecorationLine === "line-through"
      ? { textDecorationLine: mark.attrs.textDecorationLine }
      : {}),
    ...(typeof mark.attrs?.textDecorationColor === "string"
      ? { textDecorationColor: mark.attrs.textDecorationColor }
      : {}),
    ...(mark.attrs?.verticalAlign === "sub" || mark.attrs?.verticalAlign === "super"
      ? { verticalAlign: mark.attrs.verticalAlign }
      : {}),
    ...(mark.attrs?.code === true ? { code: true } : {}),
  }),
} satisfies TextStyleExtensionRenderers;

export function createTextStyleExtension(
  options: TextStyleExtensionOptions = {},
): VasaExtension<TextStyleExtensionRenderers> {
  return {
    name: "textStyle",
    tiptap: createTextStyleMark(),
    renderers: {
      textStyle: appendRenderer(defaultTextStyleRenderers.textStyle, options.renderers?.textStyle),
    },
  };
}

export const TextStyleMark = createTextStyleExtension();

function createTextStyleMark() {
  return Mark.create({
    name: "textStyle",
    parseHTML() {
      return [
        {
          tag: "span",
          getAttrs: (node) => (hasTextStyleAttributes(node) ? null : false),
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return ["span", HTMLAttributes, 0];
    },
    addAttributes() {
      return {
        fontId: {
          default: null,
          parseHTML: (element) =>
            element.getAttribute("data-font-id") || element.style.fontFamily || null,
          renderHTML: (attributes) => ({
            ...(attributes.fontId === null ? {} : { "data-font-id": String(attributes.fontId) }),
            ...(attributes.fontId === null
              ? {}
              : { style: `font-family: ${String(attributes.fontId)}` }),
          }),
        },
        fontFamily: {
          default: null,
          parseHTML: (element) => element.style.fontFamily || null,
          renderHTML: (attributes) =>
            attributes.fontFamily === null
              ? {}
              : { style: `font-family: ${String(attributes.fontFamily)}` },
        },
        fontSize: {
          default: null,
          parseHTML: (element) => parseCssFontSize(element.style.fontSize),
          renderHTML: (attributes) =>
            attributes.fontSize === null ? {} : { style: `font-size: ${attributes.fontSize}px` },
        },
        fontWeight: {
          default: null,
          parseHTML: (element) => element.style.fontWeight || null,
          renderHTML: (attributes) =>
            attributes.fontWeight === null
              ? {}
              : { style: `font-weight: ${String(attributes.fontWeight)}` },
        },
        fontStyle: {
          default: null,
          parseHTML: (element) => (element.style.fontStyle === "italic" ? "italic" : null),
          renderHTML: (attributes) =>
            attributes.fontStyle === null
              ? {}
              : { style: `font-style: ${String(attributes.fontStyle)}` },
        },
        color: {
          default: null,
          parseHTML: (element) => element.style.color || null,
          renderHTML: (attributes) =>
            attributes.color === null ? {} : { style: `color: ${String(attributes.color)}` },
        },
        backgroundColor: {
          default: null,
          parseHTML: (element) => element.style.backgroundColor || null,
          renderHTML: (attributes) =>
            attributes.backgroundColor === null
              ? {}
              : { style: `background-color: ${String(attributes.backgroundColor)}` },
        },
        textDecorationLine: {
          default: null,
          parseHTML: (element) => textDecorationLine(element),
          renderHTML: (attributes) =>
            attributes.textDecorationLine === null
              ? {}
              : { style: `text-decoration-line: ${String(attributes.textDecorationLine)}` },
        },
        textDecorationColor: {
          default: null,
          parseHTML: (element) => element.style.textDecorationColor || null,
          renderHTML: (attributes) =>
            attributes.textDecorationColor === null
              ? {}
              : { style: `text-decoration-color: ${String(attributes.textDecorationColor)}` },
        },
        verticalAlign: {
          default: null,
          parseHTML: (element) => verticalAlign(element.style.verticalAlign),
          renderHTML: (attributes) =>
            attributes.verticalAlign === null
              ? {}
              : { style: `vertical-align: ${String(attributes.verticalAlign)}` },
        },
        code: {
          default: null,
          parseHTML: (element) => (element.dataset.code === "true" ? true : null),
          renderHTML: (attributes) => (attributes.code === true ? { "data-code": "true" } : {}),
        },
      };
    },
    addCommands() {
      return {
        toggleTextStyle:
          (attrs: Record<string, unknown>) =>
          ({ commands }: CommandProps) =>
            commands.toggleMark(this.name, attrs),
      };
    },
  } as Parameters<typeof Mark.create>[0]);
}

type HtmlElementLike = {
  dataset: Record<string, string | undefined>;
  hasAttribute(name: string): boolean;
  style: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    fontStyle: string;
    color: string;
    backgroundColor: string;
    textDecorationLine: string;
    textDecoration: string;
    textDecorationColor: string;
    verticalAlign: string;
  };
};

function hasTextStyleAttributes(node: unknown) {
  if (!isHtmlElementLike(node)) return false;
  return (
    node.hasAttribute("data-font-id") ||
    node.dataset.code === "true" ||
    node.style.fontFamily !== "" ||
    node.style.fontSize !== "" ||
    node.style.fontWeight !== "" ||
    node.style.fontStyle !== "" ||
    node.style.color !== "" ||
    node.style.backgroundColor !== "" ||
    node.style.textDecorationLine !== "" ||
    node.style.textDecoration !== "" ||
    node.style.textDecorationColor !== "" ||
    node.style.verticalAlign !== ""
  );
}

function isHtmlElementLike(node: unknown): node is HtmlElementLike {
  if (typeof node !== "object" || node === null) return false;
  const candidate = node as Partial<HtmlElementLike>;
  return (
    typeof candidate.hasAttribute === "function" &&
    typeof candidate.dataset === "object" &&
    candidate.dataset !== null &&
    typeof candidate.style === "object" &&
    candidate.style !== null
  );
}

function parseCssFontSize(fontSize: string) {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(fontSize.trim());
  if (match === null) return null;
  return Number(match[1]);
}

function textDecorationLine(element: HtmlElementLike) {
  const values = `${element.style.textDecorationLine} ${element.style.textDecoration}`.split(" ");
  if (values.includes("underline")) return "underline";
  if (values.includes("line-through")) return "line-through";
  return null;
}

function verticalAlign(value: string) {
  if (value === "sub" || value === "super") return value;
  return null;
}

function appendRenderer<T>(defaultRenderer: T, renderer: MaybeArray<T> | undefined): MaybeArray<T> {
  if (renderer === undefined) return defaultRenderer;
  return [defaultRenderer, ...(Array.isArray(renderer) ? renderer : [renderer])];
}
