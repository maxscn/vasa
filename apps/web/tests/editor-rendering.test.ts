import {
  buildCanvasScene,
  createCanvasCommands,
  type CanvasCommand,
  type CanvasNode,
  type CanvasRendererExtension,
  type CanvasScene,
} from "@vasa/canvas";
import {
  collectExtensionRenderers,
  collectLayoutExtensions,
  collectRendererExtensions,
} from "@vasa/core";
import {
  createEditorParityDocument,
  createEditorRenderDocument,
  createEditorRenderTextMeasurer,
  type EditorJson,
  type EditorRenderProfileOptions,
} from "@vasa/editor";
import {
  createFontRegistry,
  createFontStrikeoutStyle,
  type FontDescriptor,
  type VasaFont,
} from "@vasa/font";
import { createRenderDocument, textOutlinePathBounds } from "@vasa/renderer";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { webEditorConfig } from "../src/editor-config.ts";

let originalFetch: typeof globalThis.fetch;

const googleFontFixtures = [
  fontFixture("Arimo", "arimo", "Arimo-Regular.ttf", "Arimo-700.ttf"),
  fontFixture("Geist", "geist", "Geist-Regular.ttf", "Geist-700.ttf"),
  fontFixture("Inter", "inter", "Inter-Regular.ttf", "Inter-700.ttf"),
  fontFixture("Lora", "lora", "Lora-Regular.ttf", "Lora-700.ttf"),
  fontFixture("Merriweather", "merriweather", "Merriweather-Regular.ttf", "Merriweather-700.ttf"),
  fontFixture("Montserrat", "montserrat", "Montserrat-Regular.ttf", "Montserrat-700.ttf"),
  fontFixture("Nunito", "nunito", "Nunito-Regular.ttf", "Nunito-700.ttf"),
  fontFixture("Oswald", "oswald", "Oswald-Regular.ttf", "Oswald-700.ttf"),
  fontFixture(
    "Playfair Display",
    "playfairdisplay",
    "PlayfairDisplay-Regular.ttf",
    "PlayfairDisplay-700.ttf",
  ),
  fontFixture("Roboto", "roboto", "Roboto-Regular.ttf", "Roboto-700.ttf"),
  fontFixture("Source Serif 4", "sourceserif4", "SourceSerif4-Regular.ttf", "SourceSerif4-700.ttf"),
  fontFixture("Space Grotesk", "spacegrotesk", "SpaceGrotesk-Regular.ttf", "SpaceGrotesk-700.ttf"),
] as const;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("renders the web editor parity sheet with loaded outline font geometry", async () => {
  await stubGoogleFontFetch({
    arimo: {
      "400": await fixtureFontBytes("arimo", "Arimo-Regular.ttf"),
    },
  });

  const registry = createFontRegistry();
  const arimo = await registry.register({
    ...webEditorConfig.bundledFont,
    source: webEditorConfig.bundledFontSource,
  });
  const profile: EditorRenderProfileOptions = {
    fonts: [arimo],
    defaultFontId: arimo.id,
    fallbackFont: arimo,
    fontSize: webEditorConfig.textFontSize,
    lineHeight: webEditorConfig.textLineHeight,
    textColor: webEditorConfig.textColor,
    whiteSpace: "pre-wrap",
    wordBreak: "normal",
  };
  const contract = createEditorRenderDocument({
    doc: createEditorParityDocument(),
    page: webEditorConfig.page,
    measurer: createEditorRenderTextMeasurer(profile),
    profile,
    rootStyle: { gap: 14 },
    paragraphStyle: { flexDirection: "column" },
    extraChildren: webEditorConfig.extraChildren,
    layoutExtensions: collectLayoutExtensions(webEditorConfig.extensions),
    rendererExtensions: collectRendererExtensions(webEditorConfig.extensions),
    createRenderDocument,
  });
  const scene = buildCanvasScene(contract.renderDocument, {
    pageGap: webEditorConfig.pageGap,
    extensions: collectExtensionRenderers(
      webEditorConfig.extensions,
      "canvas",
    ) as CanvasRendererExtension[],
    text: contract.canvasTextPaint,
  });
  const lines = canvasTextLines(scene);
  const underlined = lineByText(lines, "underlined");
  const struck = lineByText(lines, "struck text");

  expect(arimo.data.kind).toBe("outline");
  expect(underlined.outline).toBeDefined();
  expect(struck.outline).toBeDefined();
  expect(struck.textDecorationLine).toBe("line-through");
  expect(struck.textDecorationOffset).toBeCloseTo(
    createFontStrikeoutStyle(arimo, { fontSize: webEditorConfig.textFontSize }).offset,
  );
  expectCanvasStrikeCommandInterop(scene, struck);
  expectLineRunsDoNotOverlap(lines);
});

for (const fixture of googleFontFixtures) {
  test(`renders the web editor parity sheet with ${fixture.family} outline faces`, async () => {
    await stubGoogleFontFetch({
      [fixture.slug]: {
        "400": await fixtureFontBytes(fixture.slug, fixture.files["400"]),
        "700": await fixtureFontBytes(fixture.slug, fixture.files["700"]),
      },
    });

    const descriptors = fontDescriptorsForFamily(fixture.family);
    const registry = createFontRegistry();
    const fonts = await Promise.all(descriptors.map((descriptor) => registry.register(descriptor)));
    const regularFont = fontByWeight(fonts, "400");
    const profile: EditorRenderProfileOptions = {
      fonts,
      defaultFontId: regularFont.id,
      fallbackFont: regularFont,
      fontSize: webEditorConfig.textFontSize,
      lineHeight: webEditorConfig.textLineHeight,
      textColor: webEditorConfig.textColor,
      whiteSpace: "pre-wrap",
      wordBreak: "normal",
    };
    const scene = renderWebParityScene(
      profile,
      withFontId(createEditorParityDocument(), regularFont.id),
    );
    const lines = canvasTextLines(scene);
    const boldItalic = lineByText(lines, "bold italic");
    const struck = lines.find((line) => line.text === "struck text") ?? lineByText(lines, "struck");

    expect(fonts.every((font) => font.data.kind === "outline")).toBe(true);
    expect(fontByWeight(fonts, "700").outlineFont).toBeDefined();
    expect(boldItalic.outline).toBeDefined();
    expect(boldItalic.font).toContain("700");
    expect(struck.outline).toBeDefined();
    expect(struck.textDecorationOffset).toBeCloseTo(
      createFontStrikeoutStyle(regularFont, { fontSize: webEditorConfig.textFontSize }).offset,
    );
    expectCanvasStrikeCommandInterop(scene, struck);
    expectLineRunsDoNotOverlap(lines);
  });
}

test("covers every Google font family in the web editor catalog", () => {
  const fixtureFamilies = new Set(googleFontFixtures.map((fixture) => fixture.family));
  const catalogFamilies = new Set(
    webEditorConfig.fontFamilies
      .filter(
        (font): font is FontDescriptor => typeof font !== "string" && font.source !== undefined,
      )
      .map((font) => font.family),
  );

  expect(fixtureFamilies).toEqual(catalogFamilies);
});

async function stubGoogleFontFetch(fonts: Record<string, Record<string, Uint8Array>>) {
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://fonts.googleapis.com/")) {
      return new Response(googleFontCss(url), {
        headers: { "content-type": "text/css" },
      });
    }

    const localFont = /\/fonts\/google\/([^/]+)\/([^/?]+\.ttf)(?:\?.*)?$/.exec(url);
    if (localFont !== null) {
      return new Response(bytesBody(await fixtureFontBytes(localFont[1]!, localFont[2]!)), {
        headers: { "content-type": "font/ttf" },
      });
    }

    const fontUrl = new URL(url);
    if (fontUrl.origin === "https://fonts.gstatic.test") {
      const [, family, weight] = /\/([^/]+)-(\d+)\.woff2$/.exec(fontUrl.pathname) ?? [];
      const bytes =
        family === undefined || weight === undefined ? undefined : fonts[family]?.[weight];
      if (bytes !== undefined) {
        return new Response(bytesBody(bytes), {
          headers: { "content-type": "font/woff2" },
        });
      }
    }

    return originalFetch(input);
  };
}

function bytesBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function googleFontCss(url: string) {
  const familyQuery = new URL(url).searchParams.get("family") ?? "Arimo:wght@400";
  const [family = "Arimo", weight = "400"] = familyQuery.split(/:wght@/);
  const familySlug = family.toLowerCase().replaceAll(/\s+/g, "");

  return `
    /* latin */
    @font-face {
      font-family: '${family}';
      font-style: normal;
      font-weight: ${weight};
      font-display: swap;
      src: url(https://fonts.gstatic.test/${familySlug}-${weight}.woff2) format('woff2');
    }
  `;
}

async function fixtureFontBytes(family: string, fileName: string) {
  return new Uint8Array(
    await readFile(
      new URL(`../../editor/src/assets/fonts/google/${family}/${fileName}`, import.meta.url),
    ),
  );
}

function fontFixture(family: string, slug: string, regular: string, bold: string) {
  return {
    family,
    slug,
    files: {
      "400": regular,
      "700": bold,
    },
  };
}

type CanvasTextLine = Extract<CanvasNode, { kind: "textLine" }>;
type FillRectCommand = Extract<CanvasCommand, { type: "fillRect" }>;

function canvasTextLines(scene: CanvasScene) {
  return scene.pages.flatMap((page) => flattenCanvasTextLines(page.children));
}

function flattenCanvasTextLines(nodes: CanvasNode[]): CanvasTextLine[] {
  return nodes.flatMap((node) => {
    if (node.kind === "textLine") return [node];
    if (node.kind === "box") return flattenCanvasTextLines(node.children);
    return [];
  });
}

function lineByText(lines: CanvasTextLine[], text: string) {
  const line = lines.find((candidate) => candidate.text === text);
  expect(line, `Expected a canvas text line matching ${JSON.stringify(text)}`).toBeDefined();
  return line!;
}

function fontByWeight(fonts: VasaFont[], weight: string) {
  const font = fonts.find((candidate) => candidate.weight === weight);
  expect(font, `Expected font with weight ${weight}`).toBeDefined();
  return font!;
}

function fontDescriptorsForFamily(family: string) {
  const descriptors = webEditorConfig.fontFamilies.filter(
    (font): font is FontDescriptor => typeof font !== "string" && font.family === family,
  );
  expect(descriptors, `Expected descriptors for ${family}`).not.toHaveLength(0);
  return descriptors;
}

function renderWebParityScene(
  profile: EditorRenderProfileOptions,
  doc = createEditorParityDocument(),
) {
  const contract = createEditorRenderDocument({
    doc,
    page: webEditorConfig.page,
    measurer: createEditorRenderTextMeasurer(profile),
    profile,
    rootStyle: { gap: 14 },
    paragraphStyle: { flexDirection: "column" },
    extraChildren: webEditorConfig.extraChildren,
    layoutExtensions: collectLayoutExtensions(webEditorConfig.extensions),
    rendererExtensions: collectRendererExtensions(webEditorConfig.extensions),
    createRenderDocument,
  });

  return buildCanvasScene(contract.renderDocument, {
    pageGap: webEditorConfig.pageGap,
    extensions: collectExtensionRenderers(
      webEditorConfig.extensions,
      "canvas",
    ) as CanvasRendererExtension[],
    text: contract.canvasTextPaint,
  });
}

function withFontId(node: EditorJson, fontId: string): EditorJson {
  return {
    ...node,
    marks:
      node.type === "text"
        ? [
            ...(node.marks?.filter((mark) => mark.type !== "textStyle") ?? []),
            textStyleMark(node, fontId),
          ]
        : node.marks,
    content: node.content?.map((child) => withFontId(child, fontId)),
  };
}

function textStyleMark(node: EditorJson, fontId: string) {
  const textStyleAttrs = node.marks?.find((mark) => mark.type === "textStyle")?.attrs ?? {};
  return { type: "textStyle", attrs: { ...textStyleAttrs, fontId } };
}

function expectCanvasStrikeCommandInterop(scene: CanvasScene, line: CanvasTextLine) {
  expect(line.textDecorationLine).toBe("line-through");
  expect(line.textDecorationOffset).toBeDefined();
  expect(line.outline).toBeDefined();

  const command = canvasDecorationCommand(createCanvasCommands(scene), line);
  expect(
    command,
    `Expected canvas fillRect command for ${JSON.stringify(line.text)}`,
  ).toBeDefined();
  expect(command!.rect.y).toBe(Math.round(line.y + line.textDecorationOffset!));
  expect(command!.rect.height).toBe(line.textDecorationThickness ?? 1);
  expect(Math.abs(command!.rect.x - line.x)).toBeLessThanOrEqual(1);
  expect(command!.rect.width).toBeGreaterThan(0);
  expect(command!.rect.width).toBeLessThanOrEqual(line.width + 4);

  const bounds = textOutlinePathBounds(line.outline!);
  expect(bounds).toBeDefined();
  const glyphCenterY = bounds!.y + bounds!.height / 2;
  const strikeCenterY = command!.rect.y + command!.rect.height / 2;
  const tolerance = Math.max(1.25, bounds!.height * 0.18);

  expect(Math.abs(strikeCenterY - glyphCenterY)).toBeLessThanOrEqual(tolerance);
}

function canvasDecorationCommand(
  commands: CanvasCommand[],
  line: CanvasTextLine,
): FillRectCommand | undefined {
  const expectedY = Math.round(line.y + (line.textDecorationOffset ?? 0));
  const expectedFill = line.textDecorationColor ?? line.fill;

  for (const command of commands) {
    if (!isFillRectCommand(command)) continue;
    if (
      command.fill === expectedFill &&
      command.rect.y === expectedY &&
      Math.abs(command.rect.x - line.x) <= 1
    ) {
      return command;
    }
  }

  return undefined;
}

function isFillRectCommand(command: CanvasCommand): command is FillRectCommand {
  return command.type === "fillRect";
}

function expectLineRunsDoNotOverlap(lines: CanvasTextLine[]) {
  const rows = new Map<number, CanvasTextLine[]>();
  for (const line of lines) {
    const y = Math.round(line.y);
    rows.set(y, [...(rows.get(y) ?? []), line]);
  }

  for (const row of rows.values()) {
    const sorted = [...row].sort((left, right) => left.x - right.x);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;
      expect(
        previous.x + previous.width,
        `${previous.text} should not overlap ${current.text}`,
      ).toBeLessThanOrEqual(current.x + 1);
    }
  }
}
