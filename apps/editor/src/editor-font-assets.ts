import { createGoogleFontDescriptors, type FontDescriptor } from "@vasa/font";

const googleFontAssetUrls = import.meta.glob<string>("./assets/fonts/google/**/*.ttf", {
  eager: true,
  import: "default",
  query: "?url",
});

export const localArimoRegularFontSource = localGoogleFontSource("arimo/Arimo-Regular.ttf");

export const localGoogleFontDescriptors: FontDescriptor[] = createGoogleFontDescriptors({
  basePath: "",
}).flatMap((font) => {
  const source = maybeLocalGoogleFontSource(localFontFile(font));
  return source === undefined ? [] : [{ ...font, source }];
});

function localFontFile(font: FontDescriptor) {
  if (typeof font.source !== "string") {
    throw new Error(`Expected a local file path for ${font.id}`);
  }
  return font.source.replace(/^\/+/, "");
}

function localGoogleFontSource(file: string) {
  const source = maybeLocalGoogleFontSource(file);
  if (source === undefined) {
    throw new Error(`Missing local Google font asset: ${file}`);
  }
  return source;
}

function maybeLocalGoogleFontSource(file: string) {
  return googleFontAssetUrls[`./assets/fonts/google/${file}`];
}
