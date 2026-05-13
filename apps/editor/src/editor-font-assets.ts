import {
  googleFontManifest,
  createGoogleFontDescriptors,
  type FontDescriptor,
} from "@opeinspection/skriva/font";

const googleFontAssetUrls = import.meta.glob<string>("./assets/fonts/google/**/*.ttf", {
  eager: true,
  import: "default",
  query: "?url",
});

export const localArimoRegularFontSource = localGoogleFontSource("arimo/Arimo-Regular.ttf");

export const localGoogleFontDescriptors: FontDescriptor[] =
  localGoogleFontDescriptorsForAssets(googleFontAssetUrls);

export const localControlledGoogleFontFamilies = completeGoogleFontFamilies(
  localGoogleFontDescriptors,
);

export function localGoogleFontDescriptorsForAssets(
  assetUrls: Record<string, string>,
): FontDescriptor[] {
  const localDescriptors = createGoogleFontDescriptors({
    basePath: "",
  }).flatMap((font) => {
    const source = maybeLocalGoogleFontSource(assetUrls, localFontFile(font));
    return source === undefined ? [] : [{ ...font, source }];
  });
  const completeFamilies = new Set(completeGoogleFontFamilies(localDescriptors));

  return localDescriptors.filter((font) => completeFamilies.has(font.family));
}

function localFontFile(font: FontDescriptor) {
  if (typeof font.source !== "string") {
    throw new Error(`Expected a local file path for ${font.id}`);
  }
  return font.source.replace(/^\/+/, "");
}

function localGoogleFontSource(file: string) {
  const source = maybeLocalGoogleFontSource(googleFontAssetUrls, file);
  if (source === undefined) {
    throw new Error(`Missing local Google font asset: ${file}`);
  }
  return source;
}

function maybeLocalGoogleFontSource(assetUrls: Record<string, string>, file: string) {
  return assetUrls[`./assets/fonts/google/${file}`];
}

function completeGoogleFontFamilies(fonts: FontDescriptor[]) {
  const facesByFamily = new Map<string, Set<string>>();
  for (const font of fonts) {
    const faces = facesByFamily.get(font.family) ?? new Set<string>();
    faces.add(faceKey({ weight: String(font.weight ?? "400"), style: font.style ?? "normal" }));
    facesByFamily.set(font.family, faces);
  }

  return googleFontManifest
    .filter((entry) => {
      const registeredFaces = facesByFamily.get(entry.family);
      return (
        registeredFaces !== undefined &&
        entry.faces.every((face) => registeredFaces.has(faceKey(face)))
      );
    })
    .map((entry) => entry.family);
}

function faceKey(face: { weight: string; style: string }) {
  return `${face.weight}\u0000${face.style}`;
}
