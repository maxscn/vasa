import { defaultLayoutExtensions } from "./text.ts";
import type {
  AnyLayoutExtension,
  BoxNode,
  LayoutBox,
  LayoutNode,
  LayoutPage,
  Rect,
  SplitLayoutResult,
} from "./types.ts";

type LayoutPageForPagination = (root: BoxNode, pageIndex: number) => LayoutPage;
type PrimitiveSplit = SplitLayoutResult<LayoutNode>;

const PAGE_OVERFLOW_TOLERANCE = 0.5;

export type PaginationPrimitive = LayoutNode;

export type PaginationPagePlan = {
  index: number;
  primitives: PaginationPrimitive[];
};

export type PaginationPlan = {
  pages: PaginationPagePlan[];
};

export type PaginatePrimitivesOptions = {
  root: BoxNode;
  content: Rect;
  extensions?: AnyLayoutExtension[];
  layoutPage: LayoutPageForPagination;
};

export function paginatePrimitives(options: PaginatePrimitivesOptions): PaginationPlan {
  const pending = [...(options.root.children ?? [])];
  const pages: PaginationPagePlan[] = [];
  const extensions = [...(options.extensions ?? []), ...defaultLayoutExtensions];

  while (pending.length > 0) {
    const primitives: LayoutNode[] = [];

    while (pending.length > 0) {
      const candidate = pending[0];
      const trial = options.layoutPage(
        { ...options.root, children: [...primitives, candidate] },
        pages.length,
      );
      const overflows = isPastPageBottom(maxBlockBottom(trial), options.content);

      if (!overflows) {
        primitives.push(candidate);
        pending.shift();
        continue;
      }

      if (candidate !== undefined) {
        const split = splitPrimitive(candidate, trial, options.content, extensions);

        if (split?.fitting !== undefined) {
          primitives.push(split.fitting);
          pending[0] = split.remaining;
          break;
        }
      }

      if (primitives.length === 0) {
        primitives.push(candidate);
        pending.shift();
      }

      break;
    }

    pages.push({ index: pages.length, primitives });
  }

  if (pages.length === 0) {
    pages.push({ index: 0, primitives: options.root.children ?? [] });
  }

  return { pages };
}

function splitPrimitive(
  node: LayoutNode,
  trial: LayoutPage,
  content: Rect,
  extensions: AnyLayoutExtension[],
): PrimitiveSplit | undefined {
  if (node.type === "box") {
    const split = splitBoxPrimitive(node, trial, content, extensions);
    if (split !== undefined) return split;
  }

  for (const extension of extensions) {
    if (!extension.match(node)) continue;
    const split = extension.split?.({ node, trial, content });
    if (split !== undefined) return split;
  }

  return undefined;
}

function splitBoxPrimitive(
  node: BoxNode,
  trial: LayoutPage,
  content: Rect,
  extensions: AnyLayoutExtension[],
): PrimitiveSplit | undefined {
  const children = node.children ?? [];
  if (children.length === 0) return undefined;

  const box = findLayoutBoxForNode(trial.boxes, node);
  if (box === undefined) return undefined;

  const fittingChildren: LayoutNode[] = [];

  for (const [index, child] of children.entries()) {
    const childBox = box.children[index];
    if (childBox === undefined) return undefined;

    if (!isPastPageBottom(effectivePaginationBottom(childBox), content)) {
      fittingChildren.push(child);
      continue;
    }

    const split = splitPrimitive(child, { ...trial, boxes: [childBox] }, content, extensions);
    if (split?.fitting !== undefined) {
      fittingChildren.push(split.fitting);
      return {
        fitting: { ...node, children: fittingChildren },
        remaining: { ...node, children: [split.remaining, ...children.slice(index + 1)] },
      };
    }

    if (fittingChildren.length > 0) {
      return {
        fitting: { ...node, children: fittingChildren },
        remaining: { ...node, children: children.slice(index) },
      };
    }

    return undefined;
  }

  return undefined;
}

function findLayoutBoxForNode(boxes: LayoutBox[], node: BoxNode) {
  if (node.id !== undefined) {
    const matched = findLayoutBoxById(boxes, node.id);
    if (matched !== undefined) return matched;
  }

  return boxes.at(-1);
}

function findLayoutBoxById(boxes: LayoutBox[], id: string): LayoutBox | undefined {
  for (const box of boxes) {
    if (box.id === id) return box;
    const child = findLayoutBoxById(box.children, id);
    if (child !== undefined) return child;
  }

  return undefined;
}

function maxBlockBottom(page: LayoutPage) {
  return page.boxes.reduce((bottom, box) => Math.max(bottom, effectivePaginationBottom(box)), 0);
}

function isPastPageBottom(bottom: number, content: Rect) {
  return bottom > content.y + content.height + PAGE_OVERFLOW_TOLERANCE;
}

function findLastVisibleBoxIndex(boxes: LayoutBox[]) {
  for (let index = boxes.length - 1; index >= 0; index -= 1) {
    if (hasVisibleContent(boxes[index])) return index;
  }

  return -1;
}

function hasVisibleContent(box: LayoutBox): boolean {
  if (shouldPreserveEmptyHeight(box)) return true;

  if (box.type === "text") {
    return (box.lines ?? []).some((line) => line.text.length > 0);
  }

  if (box.children.length > 0) {
    return box.children.some((child) => hasVisibleContent(child));
  }

  return true;
}

function effectivePaginationBottom(box: LayoutBox): number {
  if (shouldPreserveEmptyHeight(box)) return box.rect.y + box.rect.height;

  return effectiveBoxBottom(box);
}

function effectiveBoxBottom(box: LayoutBox): number {
  if (shouldPreserveEmptyHeight(box)) return box.rect.y + box.rect.height;

  if (box.type === "text") {
    const lines = box.lines ?? [];
    const lastVisibleLineIndex = findLastVisibleLineIndex(lines);

    if (lastVisibleLineIndex >= 0 && lastVisibleLineIndex < lines.length - 1) {
      const lastVisibleLine = lines[lastVisibleLineIndex];
      const lastLine = lines.at(-1);

      return Math.max(
        lastVisibleLine.y + lastVisibleLine.height,
        lastLine === undefined ? box.rect.y : lastLine.y,
      );
    }

    return box.rect.y + box.rect.height;
  }

  if (box.type !== "box") return box.rect.y + box.rect.height;

  if (box.children.length > 0) {
    const lastVisibleChildIndex = findLastVisibleBoxIndex(box.children);
    const children =
      lastVisibleChildIndex < 0 ? box.children : box.children.slice(0, lastVisibleChildIndex + 1);

    return children.reduce(
      (bottom, child) => Math.max(bottom, effectiveBoxBottom(child)),
      box.rect.y,
    );
  }

  return box.rect.y + box.rect.height;
}

function shouldPreserveEmptyHeight(box: LayoutBox) {
  return (
    typeof box.props?.pagination === "object" &&
    box.props.pagination !== null &&
    "preserveEmptyHeight" in box.props.pagination &&
    box.props.pagination.preserveEmptyHeight === true
  );
}

function findLastVisibleLineIndex(lines: NonNullable<LayoutBox["lines"]>) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].text.length > 0) return index;
  }

  return -1;
}
