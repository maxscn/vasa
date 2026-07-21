import {
  createFontCatalog,
  createNativeFont,
  type FontCatalog,
  createFontRegistry,
  type FontDescriptor,
  type FontRegistry,
  type FontSource,
  type SkrivaFont,
} from "@skriva/font";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  editorFontDescriptorFromInput,
  fontIdFromFamily,
  mergeFonts,
  registerEditorFonts,
} from "../src/internal.ts";

export type UseEditorFontsOptions = {
  bundledFont: SkrivaFont;
  bundledFontSource?: FontSource;
  fallbackFont: SkrivaFont;
  fallbackFontSource?: FontSource;
  fontFamilies?: Array<string | FontDescriptor>;
  controlledFontFamilies?: string[];
  initialFontId?: string;
  registry?: FontRegistry;
};

export function useEditorFonts(options: UseEditorFontsOptions) {
  const fontDescriptors = useMemo(
    () => [
      {
        ...options.fallbackFont,
        ...(options.fallbackFontSource === undefined ? {} : { source: options.fallbackFontSource }),
      },
      ...(options.fontFamilies ?? []).map(editorFontDescriptorFromInput),
      {
        ...options.bundledFont,
        ...(options.bundledFontSource === undefined ? {} : { source: options.bundledFontSource }),
      },
    ],
    [
      options.bundledFont,
      options.bundledFontSource,
      options.fallbackFont,
      options.fallbackFontSource,
      options.fontFamilies,
    ],
  );
  const metadataFonts = useMemo(
    () => fontDescriptors.map(createEditorNativeFont),
    [fontDescriptors],
  );
  const [fontRegistry] = useState(() => options.registry ?? createFontRegistry());
  const [fonts, setFonts] = useState<SkrivaFont[]>(() =>
    mergeFonts([options.bundledFont, options.fallbackFont], metadataFonts),
  );
  const [isReady, setIsReady] = useState(false);
  const [selectedFontId, setSelectedFontId] = useState(
    options.initialFontId ?? options.bundledFont.id,
  );
  const activeFont = useMemo(
    () => fonts.find((font) => font.id === selectedFontId) ?? options.fallbackFont,
    [options.fallbackFont, fonts, selectedFontId],
  );
  const fontCatalog = useMemo<FontCatalog>(
    () =>
      createFontCatalog({
        fonts,
        controlledFamilies: options.controlledFontFamilies ?? [],
      }),
    [fonts, options.controlledFontFamilies],
  );
  const loadFontFamily = useCallback(
    async (fontId: string) => {
      const descriptor = fontDescriptors.find((font) => font.id === fontId);
      if (descriptor === undefined) return [];

      const familyDescriptors = fontDescriptors.filter((font) => font.family === descriptor.family);
      const loadedFonts = await Promise.all(
        familyDescriptors.map(async (font) => {
          if (font.id === undefined) return undefined;

          const registered = fontRegistry.get(font.id);
          if (registered?.data.kind === "outline") return registered;
          if (font.source === undefined) return registered;

          return fontRegistry.register(font).catch(() => registered);
        }),
      );

      return loadedFonts.filter((font): font is SkrivaFont => font !== undefined);
    },
    [fontDescriptors, fontRegistry],
  );
  const ensureFontLoaded = useCallback(
    async (fontId: string) => {
      const registered = fontRegistry.get(fontId);
      const descriptor = fontDescriptors.find((font) => font.id === fontId);
      if (registered?.data.kind === "outline") return registered;
      if (registered !== undefined && descriptor?.source === undefined) return registered;

      setIsReady(false);
      try {
        const loadedFonts = await loadFontFamily(fontId);
        setFonts((currentFonts) => mergeFonts(currentFonts, loadedFonts));
        return loadedFonts.find((font) => font.id === fontId) ?? registered;
      } catch {
        return registered;
      } finally {
        setIsReady(true);
      }
    },
    [fontDescriptors, fontRegistry, loadFontFamily],
  );

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);

    void registerEditorFonts({
      registry: fontRegistry,
      bundledFont: options.bundledFont,
      bundledFontSource: options.bundledFontSource,
      fallbackFont: options.fallbackFont,
      fallbackFontSource: options.fallbackFontSource,
      fontFamilies: options.fontFamilies,
    })
      .then(async (nextFonts) => {
        const initialFontId = options.initialFontId ?? options.bundledFont.id;
        const initialDescriptor = fontDescriptors.find((font) => font.id === initialFontId);

        if (!cancelled) {
          setFonts(nextFonts);
        }

        const initialFonts =
          initialDescriptor === undefined ? [] : await loadFontFamily(initialDescriptor.id ?? "");

        if (!cancelled) {
          if (initialFonts.length > 0) {
            setFonts((currentFonts) => mergeFonts(currentFonts, initialFonts));
          }
          setIsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [
    fontRegistry,
    options.bundledFont,
    options.bundledFontSource,
    options.fallbackFont,
    options.fallbackFontSource,
    options.fontFamilies,
    options.controlledFontFamilies,
    options.initialFontId,
    fontDescriptors,
    loadFontFamily,
  ]);

  return {
    activeFont,
    fontCatalog,
    fontRegistry,
    fonts,
    isReady,
    selectedFontId,
    ensureFontLoaded,
    setSelectedFontId,
  };
}

export type UseEditorFontsReturn = ReturnType<typeof useEditorFonts>;

function createEditorNativeFont(font: FontDescriptor): SkrivaFont {
  return createNativeFont({
    id: font.id ?? fontIdFromFamily(font.family),
    family: font.family,
    displayName: font.displayName ?? font.family,
    weight: String(font.weight ?? "400"),
    style: font.style ?? "normal",
    fallbackFamilies: font.fallbackFamilies,
  });
}
