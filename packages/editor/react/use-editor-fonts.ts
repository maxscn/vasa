import {
  createFontRegistry,
  type FontDescriptor,
  type FontRegistry,
  type FontSource,
  type VasaFont,
} from "@vasa/font";
import { useEffect, useMemo, useState } from "react";
import { registerEditorFonts } from "../src/index.ts";

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
      .then((nextFonts) => {
        if (!cancelled) {
          setFonts(nextFonts);
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
  ]);

  return {
    activeFont,
    fontRegistry,
    fonts,
    isReady,
    selectedFontId,
    setSelectedFontId,
  };
}

export type UseEditorFontsReturn = ReturnType<typeof useEditorFonts>;
