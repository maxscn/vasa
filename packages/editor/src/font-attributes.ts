import { Bold } from "@vasa/extension-bold";
import { Blockquote } from "@vasa/extension-blockquote";
import { Code } from "@vasa/extension-code";
import { Color } from "@vasa/extension-color";
import { Document } from "@vasa/extension-document";
import { FontFamily } from "@vasa/extension-font-family";
import { FontSize } from "@vasa/extension-font-size";
import { Heading } from "@vasa/extension-heading";
import { Highlight } from "@vasa/extension-highlight";
import { HorizontalRule } from "@vasa/extension-horizontal-rule";
import { Italic } from "@vasa/extension-italic";
import { LineHeight } from "@vasa/extension-line-height";
import { Paragraph } from "@vasa/extension-paragraph";
import { Strike } from "@vasa/extension-strike";
import { Subscript } from "@vasa/extension-subscript";
import { Superscript } from "@vasa/extension-superscript";
import { TableExtension } from "@vasa/extension-table";
import { Text } from "@vasa/extension-text";
import { TextStyleMark } from "@vasa/extension-text-style";
import { Underline } from "@vasa/extension-underline";
import type { VasaExtension } from "@vasa/core";
import type { EditorJson, EditorSelection, EditorSelectionPoint } from "./index.ts";

export type EditorTextStyleAttributes = {
  fontId?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: string;
  fontStyle?: "italic";
  color?: string;
  backgroundColor?: string;
  textDecorationLine?: "underline" | "line-through";
  textDecorationColor?: string;
  verticalAlign?: "sub" | "super";
  code?: boolean;
};

export type EditorMarkAttributes = Record<string, unknown>;

export type EditorMarkSpec = {
  type: string;
  attrs?: EditorMarkAttributes;
};

export type EditorMarkRenderContext = {
  mark: EditorMarkSpec;
};

export type EditorExtensionRenderers = {
  textStyle: (context: EditorMarkRenderContext) => EditorTextStyleAttributes | undefined;
};

export type EditorMarkExtension = VasaExtension<EditorExtensionRenderers> & { type: "mark" };

export type EditorCommandExtension = VasaExtension & {
  type: "extension";
};

export type EditorExtension = EditorMarkExtension | EditorCommandExtension;

export type EditorCommandState = {
  doc: EditorJson;
  selection: EditorSelection;
};

export type EditorCommandResult = {
  state: EditorCommandState;
  success: boolean;
};

type EditorCommandProps = {
  state: EditorCommandState;
  dispatch: (state: EditorCommandState) => void;
  commands: Record<string, (...args: unknown[]) => boolean>;
  chain: () => EditorCommandChain;
};

type EditorCommand = (props: EditorCommandProps) => boolean;
type EditorCommandSpec = (...args: unknown[]) => EditorCommand;
type EditorCommandChain = Record<string, (...args: unknown[]) => EditorCommandChain> & {
  run: () => boolean;
};

export function createEditorMarkExtension(
  extension: Omit<EditorMarkExtension, "type">,
): EditorMarkExtension {
  return { type: "mark", ...extension };
}

export function createEditorExtension(
  extension: Omit<EditorCommandExtension, "type">,
): EditorCommandExtension {
  return { type: "extension", ...extension };
}

export { Bold } from "@vasa/extension-bold";
export { Blockquote } from "@vasa/extension-blockquote";
export { Code } from "@vasa/extension-code";
export { Color } from "@vasa/extension-color";
export { Document } from "@vasa/extension-document";
export { FontFamily } from "@vasa/extension-font-family";
export { FontSize } from "@vasa/extension-font-size";
export { Heading } from "@vasa/extension-heading";
export { Highlight } from "@vasa/extension-highlight";
export { HorizontalRule } from "@vasa/extension-horizontal-rule";
export { Italic } from "@vasa/extension-italic";
export { LineHeight } from "@vasa/extension-line-height";
export { Paragraph } from "@vasa/extension-paragraph";
export { Strike } from "@vasa/extension-strike";
export { Subscript } from "@vasa/extension-subscript";
export { Superscript } from "@vasa/extension-superscript";
export { TableExtension } from "@vasa/extension-table";
export { Text } from "@vasa/extension-text";
export { TextStyleMark } from "@vasa/extension-text-style";
export { Underline } from "@vasa/extension-underline";

export const defaultEditorMarkExtensions: EditorMarkExtension[] = [
  createEditorMarkExtension(TextStyleMark),
  createEditorMarkExtension(Bold),
  createEditorMarkExtension(Italic),
  createEditorMarkExtension(Underline),
  createEditorMarkExtension(Strike),
  createEditorMarkExtension(Code),
  createEditorMarkExtension(Highlight),
  createEditorMarkExtension(Superscript),
  createEditorMarkExtension(Subscript),
];
export const defaultEditorExtensions: EditorExtension[] = [
  createEditorExtension(Document),
  createEditorExtension(Paragraph),
  createEditorExtension(Text),
  createEditorExtension(Heading),
  createEditorExtension(Blockquote),
  createEditorExtension(HorizontalRule),
  createEditorExtension(TableExtension),
  ...defaultEditorMarkExtensions,
  createEditorExtension(Color),
  createEditorExtension(FontFamily),
  createEditorExtension(FontSize),
  createEditorExtension(LineHeight),
];

export function applyTextStyleToSelection(
  doc: EditorJson,
  selection: EditorSelection,
  style: EditorTextStyleAttributes,
): { doc: EditorJson; selection: EditorSelection } {
  return runEditorCommand({ doc, selection }, "setMark", TextStyleMark.name, style).state;
}

export function setFontFamily(
  doc: EditorJson,
  selection: EditorSelection,
  fontId: string,
): { doc: EditorJson; selection: EditorSelection } {
  return runEditorCommand({ doc, selection }, "setFontFamily", fontId).state;
}

export function unsetFontFamily(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  return runEditorCommand({ doc, selection }, "unsetFontFamily").state;
}

export function setFontSize(
  doc: EditorJson,
  selection: EditorSelection,
  fontSize: number,
): { doc: EditorJson; selection: EditorSelection } {
  return runEditorCommand({ doc, selection }, "setFontSize", fontSize).state;
}

export function unsetFontSize(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  return runEditorCommand({ doc, selection }, "unsetFontSize").state;
}

export function setLineHeight(
  doc: EditorJson,
  selection: EditorSelection,
  lineHeight: number,
): { doc: EditorJson; selection: EditorSelection } {
  return runEditorCommand({ doc, selection }, "setLineHeight", lineHeight).state;
}

export function unsetLineHeight(
  doc: EditorJson,
  selection: EditorSelection,
): { doc: EditorJson; selection: EditorSelection } {
  return runEditorCommand({ doc, selection }, "unsetLineHeight").state;
}

export function toggleBold(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "toggleBold").state;
}

export function toggleItalic(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "toggleItalic").state;
}

export function toggleUnderline(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "toggleUnderline").state;
}

export function toggleStrike(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "toggleStrike").state;
}

export function toggleCode(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "toggleCode").state;
}

export function toggleHighlight(
  doc: EditorJson,
  selection: EditorSelection,
  attrs: Record<string, unknown> = {},
) {
  return runEditorCommand({ doc, selection }, "toggleHighlight", attrs).state;
}

export function toggleSuperscript(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "toggleSuperscript").state;
}

export function toggleSubscript(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "toggleSubscript").state;
}

export function setColor(doc: EditorJson, selection: EditorSelection, color: string) {
  return runEditorCommand({ doc, selection }, "setColor", color).state;
}

export function unsetColor(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "unsetColor").state;
}

export function setBold(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "setBold").state;
}

export function unsetBold(doc: EditorJson, selection: EditorSelection) {
  return runEditorCommand({ doc, selection }, "unsetBold").state;
}

export function currentEditorTextStyleAttrs(
  doc: EditorJson,
  selection: EditorSelection,
  storedMarks: EditorMarkSpec[] = [],
): EditorTextStyleAttributes {
  const selectedAttrs = isExpandedSelection(selection)
    ? commonSelectedTextStyleAttrs(doc, selection)
    : undefined;
  const nodeAttrs =
    selectedAttrs ??
    editorTextStyleAttrsFromMarks(
      getEditorNodeAtPath(doc, selection.path)?.marks,
      defaultEditorMarkExtensions,
    );
  const storedAttrs = editorTextStyleAttrsFromMarks(storedMarks, defaultEditorMarkExtensions);

  return { ...nodeAttrs, ...storedAttrs };
}

function commonSelectedTextStyleAttrs(
  doc: EditorJson,
  selection: EditorSelection,
): EditorTextStyleAttributes | undefined {
  const range = normalizeSelectionRange(doc, selection);
  const selectedAttrs = collectSelectedTextStyleAttrs(doc, [], range);
  if (selectedAttrs.length === 0) return undefined;

  const common: EditorTextStyleAttributes = {};
  const keys = new Set(selectedAttrs.flatMap((attrs) => Object.keys(attrs)));

  for (const key of keys) {
    const values = selectedAttrs.map((attrs) => attrs[key as keyof EditorTextStyleAttributes]);
    const firstValue = values[0];
    if (firstValue !== undefined && values.every((value) => value === firstValue)) {
      (common as Record<string, unknown>)[key] = firstValue;
    }
  }

  return common;
}

function isExpandedSelection(selection: EditorSelection) {
  return selection.anchor !== undefined && comparePoints(selection.anchor, selection) !== 0;
}

function collectSelectedTextStyleAttrs(
  node: EditorJson,
  path: number[],
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
): EditorTextStyleAttributes[] {
  if (node.type === "text") {
    const text = node.text ?? "";
    const nodeStart = { path, offset: 0 };
    const nodeEnd = { path, offset: text.length };
    if (comparePoints(nodeEnd, range.start) <= 0 || comparePoints(nodeStart, range.end) >= 0) {
      return [];
    }

    const start = comparePaths(path, range.start.path) === 0 ? range.start.offset : 0;
    const end = comparePaths(path, range.end.path) === 0 ? range.end.offset : text.length;
    if (clampOffset(start, text) >= clampOffset(end, text)) return [];

    return [editorTextStyleAttrsFromMarks(node.marks, defaultEditorMarkExtensions)];
  }

  return (node.content ?? []).flatMap((child, index) =>
    collectSelectedTextStyleAttrs(child, [...path, index], range),
  );
}

export function editorTextStyleAttrsFromMarks(
  marks: EditorMarkSpec[] | undefined,
  markExtensions: EditorMarkExtension[] = defaultEditorMarkExtensions,
): EditorTextStyleAttributes {
  return (marks ?? []).reduce<EditorTextStyleAttributes>((attrs, mark) => {
    const extension = markExtensions.find((candidate) => candidate.name === mark.type);
    const renderer = extension?.renderers?.textStyle;
    const renderers = renderer === undefined ? [] : Array.isArray(renderer) ? renderer : [renderer];

    return renderers.reduce<EditorTextStyleAttributes>(
      (nextAttrs, renderTextStyle) => ({
        ...nextAttrs,
        ...renderTextStyle({ mark }),
      }),
      attrs,
    );
  }, {});
}

export function runEditorCommand(
  state: EditorCommandState,
  commandName: string,
  ...args: unknown[]
): EditorCommandResult {
  return runEditorCommandWithExtensions(state, defaultEditorExtensions, commandName, ...args);
}

export function runEditorCommandWithExtensions(
  state: EditorCommandState,
  extensions: EditorExtension[],
  commandName: string,
  ...args: unknown[]
): EditorCommandResult {
  let currentState = state;
  const specs = collectEditorCommandSpecs(extensions);
  let commands: Record<string, (...commandArgs: unknown[]) => boolean>;
  let chain: () => EditorCommandChain;

  const dispatch = (nextState: EditorCommandState) => {
    currentState = nextState;
  };

  const runCommand = (name: string, commandArgs: unknown[]) => {
    const spec = specs[name];
    if (spec === undefined) return false;

    return spec(...commandArgs)({
      state: currentState,
      dispatch,
      commands,
      chain,
    });
  };

  commands = new Proxy<Record<string, (...commandArgs: unknown[]) => boolean>>(
    {},
    {
      get: (_target, property) => {
        if (typeof property !== "string") return undefined;
        return (...commandArgs: unknown[]) => runCommand(property, commandArgs);
      },
    },
  );

  chain = () => {
    const queue: Array<() => boolean> = [];
    const chained = new Proxy<EditorCommandChain>(
      {
        run: () => queue.every((command) => command()),
      } as EditorCommandChain,
      {
        get: (target, property) => {
          if (property in target) return target[property as string];
          if (typeof property !== "string") return undefined;
          return (...commandArgs: unknown[]) => {
            queue.push(() => runCommand(property, commandArgs));
            return chained;
          };
        },
      },
    );

    return chained;
  };

  const success = runCommand(commandName, args);
  return { state: currentState, success };
}

function collectEditorCommandSpecs(extensions: EditorExtension[]) {
  const specs: Record<string, EditorCommandSpec> = {
    setMark:
      (type, attrs = {}) =>
      ({ state, dispatch }) => {
        if (typeof type !== "string") return false;
        dispatch({
          ...state,
          ...setMark(state.doc, state.selection, type, attrs as EditorMarkAttributes),
        });
        return true;
      },
    unsetMark:
      (type) =>
      ({ state, dispatch }) => {
        if (typeof type !== "string") return false;
        dispatch({
          ...state,
          ...unsetMark(state.doc, state.selection, type),
        });
        return true;
      },
    toggleMark:
      (type, attrs = {}) =>
      ({ state, dispatch }) => {
        if (typeof type !== "string") return false;
        dispatch({
          ...state,
          ...toggleMark(state.doc, state.selection, type, attrs as EditorMarkAttributes),
        });
        return true;
      },
  };

  for (const extension of extensions) {
    const addCommands = extension.tiptap?.config.addCommands as
      | ((this: unknown) => Record<string, EditorCommandSpec>)
      | undefined;
    const extensionSpecs = addCommands?.call({
      name: extension.name,
      options: {},
      storage: {},
      editor: {},
      type: null,
      parent: undefined,
    });

    Object.assign(specs, extensionSpecs);
  }

  return specs;
}

export function toggleMark(
  doc: EditorJson,
  selection: EditorSelection,
  type: string,
  attrs: EditorMarkAttributes = {},
): { doc: EditorJson; selection: EditorSelection } {
  return isMarkActive(doc, selection, type, attrs)
    ? unsetMark(doc, selection, type)
    : setMark(doc, selection, type, attrs);
}

export function setMark(
  doc: EditorJson,
  selection: EditorSelection,
  type: string,
  attrs: EditorMarkAttributes = {},
): { doc: EditorJson; selection: EditorSelection } {
  return applyMarkToSelection(doc, selection, { type, attrs });
}

export function unsetMark(
  doc: EditorJson,
  selection: EditorSelection,
  type: string,
): { doc: EditorJson; selection: EditorSelection } {
  return applyMarkToSelection(doc, selection, { type }, { remove: true });
}

export function isMarkActive(
  doc: EditorJson,
  selection: EditorSelection,
  type: string,
  attrs: EditorMarkAttributes = {},
) {
  const range = selectionRangeInSingleParent(doc, selection);
  if (range === undefined) return false;

  const { parent, startIndex, endIndex, startAbsoluteOffset, endAbsoluteOffset } = range;
  let selectionLength = 0;
  let markedLength = 0;
  let cursor = pointToParagraphOffset(parent, {
    path: [...range.parentPath, startIndex],
    offset: 0,
  });

  for (let index = startIndex; index <= endIndex; index += 1) {
    const node = parent.content?.[index];
    if (node?.type !== "text") continue;

    const text = node.text ?? "";
    const nodeStart = cursor;
    const nodeEnd = nodeStart + text.length;
    cursor = nodeEnd;

    const from = Math.max(startAbsoluteOffset, nodeStart);
    const to = Math.min(endAbsoluteOffset, nodeEnd);
    if (from >= to) continue;

    const length = to - from;
    selectionLength += length;
    if (findMark(node, type, attrs) !== undefined) markedLength += length;
  }

  return selectionLength > 0 && markedLength >= selectionLength;
}

function applyMarkToSelection(
  doc: EditorJson,
  selection: EditorSelection,
  mark: EditorMarkSpec,
  options: { remove?: boolean } = {},
): { doc: EditorJson; selection: EditorSelection } {
  if (selection.anchor === undefined) return { doc, selection };

  const focus = { path: selection.path, offset: selection.offset };
  const anchor = selection.anchor;
  const range = selectionRangeInSingleParent(doc, selection);
  if (range === undefined) {
    return applyMarkAcrossTextNodes(doc, selection, mark, options);
  }

  const nextDoc = cloneEditorJson(doc);
  const nextRange = selectionRangeInSingleParent(nextDoc, selection);
  if (nextRange === undefined) return { doc, selection };

  const {
    parentPath,
    parent,
    startIndex,
    endIndex,
    startPoint,
    endPoint,
    startAbsoluteOffset,
    endAbsoluteOffset,
  } = nextRange;
  if (startAbsoluteOffset === endAbsoluteOffset) return { doc, selection };

  const parentContent = parent.content;
  if (parentContent === undefined) return { doc, selection };

  for (let index = endIndex; index >= startIndex; index -= 1) {
    const node = parentContent[index];
    if (node?.type !== "text") continue;

    const text = node.text ?? "";
    const start = index === startIndex ? clampOffset(startPoint.offset, text) : 0;
    const end = index === endIndex ? clampOffset(endPoint.offset, text) : text.length;
    if (start === end) continue;

    const fragments = [
      createTextFragment(node, text.slice(0, start)),
      createMarkedTextFragment(node, text.slice(start, end), mark, options),
      createTextFragment(node, text.slice(end)),
    ].filter((fragment) => fragment.text !== "");

    parentContent.splice(index, 1, ...fragments);
  }

  const mergedDoc = mergeAdjacentTextNodes(nextDoc);
  const mergedParent = getNodeAtPath(mergedDoc, parentPath);
  if (mergedParent?.content === undefined) return { doc, selection };

  const focusIsStart = comparePoints(focus, anchor) <= 0;
  const nextFocus = paragraphOffsetToPoint(
    parentPath,
    mergedParent,
    focusIsStart ? startAbsoluteOffset : endAbsoluteOffset,
  );
  const nextAnchor = paragraphOffsetToPoint(
    parentPath,
    mergedParent,
    focusIsStart ? endAbsoluteOffset : startAbsoluteOffset,
  );

  return {
    doc: mergedDoc,
    selection: { ...nextFocus, anchor: nextAnchor },
  };
}

function applyMarkAcrossTextNodes(
  doc: EditorJson,
  selection: EditorSelection,
  mark: EditorMarkSpec,
  options: { remove?: boolean },
): { doc: EditorJson; selection: EditorSelection } {
  const range = normalizeSelectionRange(doc, selection);
  if (comparePoints(range.start, range.end) === 0) return { doc, selection };

  const nextDoc = cloneEditorJson(doc);
  rewriteSelectedTextNodes(nextDoc, [], range, mark, options);

  return { doc: mergeAdjacentTextNodes(nextDoc), selection };
}

function rewriteSelectedTextNodes(
  node: EditorJson,
  path: number[],
  range: { start: EditorSelectionPoint; end: EditorSelectionPoint },
  mark: EditorMarkSpec,
  options: { remove?: boolean },
) {
  if (node.content === undefined) return;

  for (let index = node.content.length - 1; index >= 0; index -= 1) {
    const child = node.content[index];
    if (child === undefined) continue;
    const childPath = [...path, index];

    if (child.type !== "text") {
      rewriteSelectedTextNodes(child, childPath, range, mark, options);
      continue;
    }

    const text = child.text ?? "";
    const nodeStart = { path: childPath, offset: 0 };
    const nodeEnd = { path: childPath, offset: text.length };
    if (comparePoints(nodeEnd, range.start) <= 0 || comparePoints(nodeStart, range.end) >= 0) {
      continue;
    }

    const start = comparePaths(childPath, range.start.path) === 0 ? range.start.offset : 0;
    const end = comparePaths(childPath, range.end.path) === 0 ? range.end.offset : text.length;
    const from = clampOffset(start, text);
    const to = clampOffset(end, text);
    if (from >= to) continue;

    const fragments = [
      createTextFragment(child, text.slice(0, from)),
      createMarkedTextFragment(child, text.slice(from, to), mark, options),
      createTextFragment(child, text.slice(to)),
    ].filter((fragment) => fragment.text !== "");

    node.content.splice(index, 1, ...fragments);
  }
}

function normalizeSelectionRange(selectionDoc: EditorJson, selection: EditorSelection) {
  const focus = normalizeSelectionPoint(selectionDoc, selection);
  const anchor = normalizeSelectionPoint(selectionDoc, selection.anchor ?? selection);

  return comparePoints(anchor, focus) <= 0
    ? { start: anchor, end: focus }
    : { start: focus, end: anchor };
}

function normalizeSelectionPoint(
  doc: EditorJson,
  point: EditorSelectionPoint,
): EditorSelectionPoint {
  const path = normalizeTextPath(doc, point.path);
  const text = getTextAtPath(doc, path);

  return { path, offset: clampOffset(point.offset, text) };
}

function selectionRangeInSingleParent(doc: EditorJson, selection: EditorSelection) {
  if (selection.anchor === undefined) return undefined;

  const focus = { path: selection.path, offset: selection.offset };
  const anchor = selection.anchor;
  const startPoint = comparePoints(focus, anchor) <= 0 ? focus : anchor;
  const endPoint = startPoint === focus ? anchor : focus;
  const parentPath = startPoint.path.slice(0, -1);
  if (!samePath(parentPath, endPoint.path.slice(0, -1))) return undefined;

  const parent = getNodeAtPath(doc, parentPath);
  if (parent?.content === undefined) return undefined;

  return {
    parentPath,
    parent,
    startPoint,
    endPoint,
    startIndex: startPoint.path.at(-1) ?? 0,
    endIndex: endPoint.path.at(-1) ?? 0,
    startAbsoluteOffset: pointToParagraphOffset(parent, startPoint),
    endAbsoluteOffset: pointToParagraphOffset(parent, endPoint),
  };
}

function createTextFragment(node: EditorJson, text: string): EditorJson {
  return {
    ...node,
    text,
  };
}

function createMarkedTextFragment(
  node: EditorJson,
  text: string,
  mark: EditorMarkSpec,
  options: { remove?: boolean },
): EditorJson {
  const marks = options.remove
    ? removeMark(node.marks, mark.type)
    : upsertMark(node.marks, mark.type, mark.attrs);
  const { marks: _marks, ...rest } = node;

  return {
    ...rest,
    text,
    ...(marks === undefined ? {} : { marks }),
  };
}

function upsertMark(
  marks: EditorJson["marks"] = [],
  type: string,
  attrs: EditorMarkAttributes = {},
): EditorJson["marks"] {
  const existing = marks.find((mark) => mark.type === type);
  const mergedAttrs = removeEmptyAttrs({ ...existing?.attrs, ...attrs });
  const next = marks.filter((mark) => mark.type !== type);
  if (Object.keys(mergedAttrs).length === 0 && type === TextStyleMark.name) {
    return next.length === 0 ? undefined : next;
  }

  next.push(Object.keys(mergedAttrs).length === 0 ? { type } : { type, attrs: mergedAttrs });
  return next;
}

function removeEmptyAttrs(attrs: EditorMarkAttributes) {
  return Object.fromEntries(
    Object.entries(attrs).filter(([, value]) => value !== undefined && value !== null),
  );
}

function getEditorNodeAtPath(doc: EditorJson, path: number[]): EditorJson | undefined {
  let current: EditorJson | undefined = doc;

  for (const index of path) {
    current = current?.content?.[index];
  }

  return current;
}

function removeMark(marks: EditorJson["marks"] = [], type: string): EditorJson["marks"] {
  const next = marks.filter((mark) => mark.type !== type);
  return next.length === 0 ? undefined : next;
}

function findMark(node: EditorJson, type: string, attrs: EditorMarkAttributes) {
  return node.marks
    ?.filter((mark) => mark.type === type)
    .find((mark) => objectIncludes(mark.attrs ?? {}, attrs));
}

function objectIncludes(object: EditorMarkAttributes, subset: EditorMarkAttributes) {
  return Object.entries(subset).every(([key, value]) => object[key] === value);
}

function mergeAdjacentTextNodes(doc: EditorJson): EditorJson {
  if (doc.content === undefined) return doc;

  doc.content = doc.content.map((child) => mergeAdjacentTextNodes(child));

  const merged: EditorJson[] = [];
  for (const child of doc.content) {
    const previous = merged.at(-1);
    if (previous?.type === "text" && child.type === "text" && sameAttrs(previous, child)) {
      previous.text = `${previous.text ?? ""}${child.text ?? ""}`;
    } else {
      merged.push(child);
    }
  }

  doc.content = merged;
  return doc;
}

function sameAttrs(left: EditorJson, right: EditorJson) {
  return (
    JSON.stringify(left.attrs ?? {}) === JSON.stringify(right.attrs ?? {}) &&
    JSON.stringify(left.marks ?? []) === JSON.stringify(right.marks ?? [])
  );
}

function getNodeAtPath(doc: EditorJson, path: number[]): EditorJson | undefined {
  let current: EditorJson | undefined = doc;

  for (const index of path) {
    current = current?.content?.[index];
  }

  return current;
}

function getTextAtPath(doc: EditorJson, path: number[]) {
  const node = getNodeAtPath(doc, path);
  return node?.type === "text" ? (node.text ?? "") : "";
}

function normalizeTextPath(doc: EditorJson, path: number[]): number[] {
  const node = getNodeAtPath(doc, path);
  if (node?.type === "text") return path;

  return firstTextPathInNode(node, path) ?? firstTextPathInNode(doc, []) ?? path;
}

function firstTextPathInNode(node: EditorJson | undefined, path: number[]): number[] | undefined {
  if (node?.type === "text") return path;

  for (const [index, child] of (node?.content ?? []).entries()) {
    const found = firstTextPathInNode(child, [...path, index]);
    if (found !== undefined) return found;
  }

  return undefined;
}

function samePath(left: number[], right: number[]) {
  return comparePaths(left, right) === 0;
}

function comparePoints(
  left: Pick<EditorSelection, "path" | "offset">,
  right: Pick<EditorSelection, "path" | "offset">,
) {
  const pathComparison = comparePaths(left.path, right.path);
  return pathComparison === 0 ? left.offset - right.offset : pathComparison;
}

function comparePaths(left: number[], right: number[]) {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? -1;
    const rightPart = right[index] ?? -1;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }

  return 0;
}

function cloneEditorJson(doc: EditorJson): EditorJson {
  return JSON.parse(JSON.stringify(doc)) as EditorJson;
}

function clampOffset(offset: number, text: string) {
  return Math.max(0, Math.min(offset, text.length));
}

function pointToParagraphOffset(
  parent: EditorJson,
  point: Pick<EditorSelection, "path" | "offset">,
) {
  const textIndex = point.path.at(-1) ?? 0;
  let offset = 0;

  for (let index = 0; index < textIndex; index += 1) {
    const child = parent.content?.[index];
    if (child?.type === "text") offset += (child.text ?? "").length;
  }

  const text = parent.content?.[textIndex]?.text ?? "";
  return offset + clampOffset(point.offset, text);
}

function paragraphOffsetToPoint(parentPath: number[], parent: EditorJson, targetOffset: number) {
  let offset = Math.max(0, targetOffset);
  const children = parent.content ?? [];
  let lastTextIndex = 0;

  for (const [index, child] of children.entries()) {
    if (child.type !== "text") continue;

    lastTextIndex = index;
    const length = (child.text ?? "").length;
    if (offset <= length) return { path: [...parentPath, index], offset };
    offset -= length;
  }

  return { path: [...parentPath, lastTextIndex], offset: 0 };
}
