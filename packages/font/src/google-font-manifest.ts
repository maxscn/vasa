export type GoogleFontFaceManifestEntry = {
  weight: string;
  style: string;
};

export type GoogleFontFamilyManifestEntry = {
  family: string;
  faces: GoogleFontFaceManifestEntry[];
};

const romanAndItalic = (weights: string[]): GoogleFontFaceManifestEntry[] =>
  weights.flatMap((weight) => [
    { weight, style: "normal" },
    { weight, style: "italic" },
  ]);

export const googleFontManifest = [
  {
    family: "Arimo",
    faces: romanAndItalic(["400", "500", "600", "700"]),
  },
  {
    family: "Geist",
    faces: romanAndItalic(["100", "200", "300", "400", "500", "600", "700", "800", "900"]),
  },
  {
    family: "Inter",
    faces: romanAndItalic(["100", "200", "300", "400", "500", "600", "700", "800", "900"]),
  },
  {
    family: "Lora",
    faces: romanAndItalic(["400", "500", "600", "700"]),
  },
  {
    family: "Merriweather",
    faces: romanAndItalic(["300", "400", "700", "900"]),
  },
  {
    family: "Montserrat",
    faces: romanAndItalic(["100", "200", "300", "400", "500", "600", "700", "800", "900"]),
  },
  {
    family: "Nunito",
    faces: romanAndItalic(["200", "300", "400", "500", "600", "700", "800", "900"]),
  },
  {
    family: "Oswald",
    faces: ["200", "300", "400", "500", "600", "700"].map((weight) => ({
      weight,
      style: "normal",
    })),
  },
  {
    family: "Playfair Display",
    faces: romanAndItalic(["400", "500", "600", "700", "800", "900"]),
  },
  {
    family: "Roboto",
    faces: romanAndItalic(["100", "300", "400", "500", "700", "900"]),
  },
  {
    family: "Source Serif 4",
    faces: romanAndItalic(["200", "300", "400", "500", "600", "700", "800", "900"]),
  },
  {
    family: "Space Grotesk",
    faces: ["300", "400", "500", "600", "700"].map((weight) => ({
      weight,
      style: "normal",
    })),
  },
] satisfies GoogleFontFamilyManifestEntry[];
