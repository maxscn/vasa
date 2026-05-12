import { buildCanvasScene } from "@vasa/canvas";
import type { VasaFont } from "@vasa/font";
import { createRenderDocument } from "@vasa/renderer";
import { expect, test } from "vite-plus/test";
import { layoutDocument, type TextMeasurer } from "../../layout/src/index.ts";
import { renderDocumentToPdf } from "../../pdf/src/index.ts";
import {
  createEditorRenderDocument,
  createEditorLayoutTree,
  createEditorRenderResolveTextStyle,
  createEditorRenderTextStyle,
  createEditorRenderTextMeasurer,
  createEditorSession,
  currentTextBlockType,
  insertTextInEditorSession,
  isToolbarMarkActive,
  type EditorJson,
  type EditorRenderProfileOptions,
  type EditorSession,
} from "../src/index.ts";

const paragraphCount = 12;
const wordsPerParagraph = 130;
const insertIterations = 120;
const renderIterations = 40;
const layoutTreeIterations = 200;
const layoutDocumentIterations = 40;
const renderDocumentIterations = 200;
const canvasIterations = 80;
const pdfIterations = 12;
const toolbarIterations = 400;
const benchmarkSamples = 8;

const page = { width: 612, height: 792, margin: 48 };
const fallbackFont: VasaFont = {
  id: "fallback",
  family: "Bench Sans",
  displayName: "Bench Sans",
  cssFamily: "Bench Sans",
  weight: "400",
  style: "normal",
  fallbackFamilies: [],
  data: { kind: "native" },
};
const renderProfile: EditorRenderProfileOptions = {
  fonts: [fallbackFont],
  defaultFontId: fallbackFont.id,
  fallbackFont,
  fontSize: 16,
  lineHeight: 22,
  textColor: "#111827",
  whiteSpace: "pre-wrap",
  wordBreak: "normal",
};
const textMeasurer = createEditorRenderTextMeasurer(
  renderProfile,
  (text: string, font?: string) => text.length * (font?.startsWith("700 ") ? 8.8 : 8),
);
const pdfMeasurer: TextMeasurer = {
  measureText(input) {
    return textMeasurer.measureText(input);
  },
};

type BenchResult = {
  name: string;
  totalMs: number;
  perRunMs: number;
  perRunBudgetMs: number;
};

test("editor typing hot path stays inside interaction budgets", () => {
  const baseDoc = createBenchmarkDocument();
  const editedDoc = insertTextInEditorSession(baseSessionFromDoc(baseDoc), "x").doc;
  const textStyle = createEditorRenderTextStyle(renderProfile);
  const resolveTextStyle = createEditorRenderResolveTextStyle(renderProfile);
  const layoutTree = createEditorLayoutTree(editedDoc, {
    rootStyle: { gap: 14 },
    paragraphStyle: { flexDirection: "column" },
    textStyle,
    resolveTextStyle,
  });
  const layout = layoutDocumentWithoutTextGrid(layoutTree);
  const baseSession = createEditorSession({
    doc: baseDoc,
    selection: { path: [paragraphCount - 1, 0], offset: paragraphText().length },
  });
  const baseContract = createBenchmarkRenderContract(baseDoc);
  const results: BenchResult[] = [];

  results.push(
    benchmark(
      "session insert with undo history",
      insertIterations,
      0.15,
      () => {
        let session: EditorSession = baseSession;
        for (const char of typingText(insertIterations)) {
          session = insertTextInEditorSession(session, char);
        }
      },
      1,
    ),
  );

  results.push(
    benchmark("render contract after edit", renderIterations, 8, () => {
      createBenchmarkRenderContract(insertTextInEditorSession(baseSession, "x").doc);
    }),
  );

  results.push(
    benchmark("editor json to layout tree", layoutTreeIterations, 0.15, () => {
      createEditorLayoutTree(editedDoc, {
        rootStyle: { gap: 14 },
        paragraphStyle: { flexDirection: "column" },
        textStyle,
        resolveTextStyle,
      });
    }),
  );

  results.push(
    benchmark("layout document measurement", layoutDocumentIterations, 6, () => {
      layoutDocumentWithoutTextGrid(layoutTree);
    }),
  );

  results.push(
    benchmark("render document conversion", renderDocumentIterations, 0.15, () => {
      createRenderDocument(layout);
    }),
  );

  results.push(
    benchmark("canvas scene build", canvasIterations, 0.5, () => {
      buildCanvasScene(baseContract.renderDocument, { pageGap: 18 });
    }),
  );

  results.push(
    benchmark("pdf preview generation", pdfIterations, 20, () => {
      renderDocumentToPdf(
        baseContract.layoutTree as Parameters<typeof renderDocumentToPdf>[0],
        {
          page,
          measurer: pdfMeasurer,
          defaultTextFill: "#111827",
          textGrid: false,
        } as Parameters<typeof renderDocumentToPdf>[1] & { textGrid: boolean },
      );
    }),
  );

  results.push(
    benchmark("toolbar selection state", toolbarIterations, 0.1, () => {
      currentTextBlockType(baseDoc, baseSession.selection);
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "bold");
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "italic");
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "underline");
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "strike");
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "code");
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "highlight");
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "superscript");
      isToolbarMarkActive(baseDoc, baseSession.selection, [], "subscript");
    }),
  );

  const failures = results.filter((result) => result.perRunMs > result.perRunBudgetMs);
  expect(formatBenchResults(results, failures)).toBe("all benchmarks within budget");
});

function benchmark(
  name: string,
  iterations: number,
  perRunBudgetMs: number,
  run: () => void,
  measuredRuns = iterations,
): BenchResult {
  run();
  const sampleTotals: number[] = [];
  for (let sample = 0; sample < benchmarkSamples; sample += 1) {
    const start = performance.now();
    for (let index = 0; index < measuredRuns; index += 1) {
      run();
    }
    sampleTotals.push(performance.now() - start);
  }
  const totalMs = Math.min(...sampleTotals);
  return { name, totalMs, perRunMs: totalMs / iterations, perRunBudgetMs };
}

function baseSessionFromDoc(doc: EditorJson) {
  return createEditorSession({
    doc,
    selection: { path: [paragraphCount - 1, 0], offset: paragraphText().length },
  });
}

function layoutDocumentWithoutTextGrid(layoutTree: ReturnType<typeof createEditorLayoutTree>) {
  return layoutDocument(layoutTree as Parameters<typeof layoutDocument>[0], {
    page,
    measurer: textMeasurer,
    textGrid: false,
  });
}

function createBenchmarkRenderContract(doc: EditorJson) {
  return createEditorRenderDocument({
    doc,
    page,
    measurer: textMeasurer,
    profile: renderProfile,
    rootStyle: { gap: 14 },
    paragraphStyle: { flexDirection: "column" },
    createRenderDocument,
  });
}

function createBenchmarkDocument(): EditorJson {
  return {
    type: "doc",
    content: Array.from({ length: paragraphCount }, () => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: paragraphText(),
        },
      ],
    })),
  };
}

function paragraphText() {
  return Array.from({ length: wordsPerParagraph }, (_, index) => `word${index % 17}`).join(" ");
}

function typingText(length: number) {
  return "abcdefghijklmnopqrstuvwxyz ".repeat(Math.ceil(length / 27)).slice(0, length);
}

function formatBenchResults(results: BenchResult[], failures: BenchResult[]) {
  if (failures.length === 0) return "all benchmarks within budget";

  const rows = results
    .map(
      (result) =>
        `${result.name}: ${result.totalMs.toFixed(2)}ms total, ${result.perRunMs.toFixed(
          3,
        )}ms/run, budget ${result.perRunBudgetMs.toFixed(3)}ms/run`,
    )
    .join("\n");

  return `slow editor benchmarks:\n${rows}`;
}
