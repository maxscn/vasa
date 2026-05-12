import {
  createFontRegistry,
  type FontDescriptor,
  type FontRegistry,
  type FontSource,
  type VasaFont,
} from "@vasa/font";
import { useCallback, useEffect, useMemo, useState } from "react";
import { editorFontDescriptorFromInput, mergeFonts, registerEditorFonts } from "../src/index.ts";

export type UseEditorFontsOptions = {
  bundledFont: VasaFont;
  bundledFontSource?: FontSource;
  fallbackFont: VasaFont;
  fallbackFontSource?: FontSource;
  fontFamilies?: Array<string | FontDescriptor>;
  initialFontId?: string;
  registry?: FontRegistry;
};

export function useEditorFonts(options: UseEditorFontsOptions) {
  const [fontRegistry] = useState(() => options.registry ?? createFontRegistry());
  const [fonts, setFonts] = useState<VasaFont[]>([options.bundledFont, options.fallbackFont]);
  const [isReady, setIsReady] = useState(false);
  const [selectedFontId, setSelectedFontId] = useState(
    options.initialFontId ?? options.bundledFont.id,
  );
  const activeFont = useMemo(
    () => fonts.find((font) => font.id === selectedFontId) ?? options.fallbackFont,
    [options.fallbackFont, fonts, selectedFontId],
  );
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

      return loadedFonts.filter((font): font is VasaFont => font !== undefined);
    },
    [fontDescriptors, fontRegistry],
  );
  const ensureFontLoaded = useCallback(
    async (fontId: string) => {
      const registered = fontRegistry.get(fontId);

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
    [fontRegistry, loadFontFamily],
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
    options.initialFontId,
    fontDescriptors,
    loadFontFamily,
  ]);

  return {
    activeFont,
    fontRegistry,
    fonts,
    isReady,
    selectedFontId,
    ensureFontLoaded,
    setSelectedFontId,
  };
}

export type UseEditorFontsReturn = ReturnType<typeof useEditorFonts>;
