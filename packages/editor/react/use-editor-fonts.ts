import {
  createFontRegistry,
  type FontDescriptor,
  type FontRegistry,
  type VasaFont,
} from "@vasa/font";
import { useEffect, useMemo, useState } from "react";
import { registerEditorFonts } from "../src/index.ts";

export type UseEditorFontsOptions = {
  bundledFont: VasaFont;
  bundledFontUrl: string;
  fallbackFont: VasaFont;
  fallbackFontUrl?: string;
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
      bundledFontSource: options.bundledFontUrl,
      fallbackFont: options.fallbackFont,
      fallbackFontSource: options.fallbackFontUrl,
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
    options.bundledFontUrl,
    options.fallbackFont,
    options.fallbackFontUrl,
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
