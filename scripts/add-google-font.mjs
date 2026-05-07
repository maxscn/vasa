#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const args = parseArgs(process.argv.slice(2));

if (args.family === undefined) {
  console.error("Usage: node scripts/add-google-font.mjs <family> [--weight 400] [--style normal]");
  process.exit(1);
}

const slug = slugify(args.family);
const weight = args.weight ?? "400";
const style = args.style ?? "normal";
const fontDir = await googleFontsDirectory(slug);
const files = await githubJson(`https://api.github.com/repos/google/fonts/contents/${fontDir}`);
const fontFile = selectFontFile(files, args.family, weight, style);
const licenseFile = files.find((file) => /^ofl\.txt$/i.test(file.name));

if (fontFile === undefined) {
  throw new Error(`Could not find a TTF for ${args.family} ${weight} ${style} in ${fontDir}.`);
}

const fontBytes = await githubBytes(fontFile.download_url);
const licenseText =
  licenseFile === undefined
    ? `Downloaded from Google Fonts: https://github.com/google/fonts/tree/main/${fontDir}\n`
    : await githubText(licenseFile.download_url);
const fileName = localFontFileName(args.family, weight, style);
const destinations = [
  new URL(`apps/editor/src/assets/fonts/google/${slug}/`, root),
  new URL(`packages/pdf/tests/fixtures/fonts/google/${slug}/`, root),
];

for (const destination of destinations) {
  await mkdir(destination, { recursive: true });
  await writeFile(new URL(fileName, destination), fontBytes);
  await writeFile(new URL("LICENSE_OFL.txt", destination), licenseText);
}

console.log(`Added ${args.family} from Google Fonts.`);
console.log(`Font file: ${fileName} (source: ${fontFile.name})`);
console.log(`App URL: /__vasa-assets/fonts/google/${slug}/${fileName}`);

function parseArgs(values) {
  const parsed = {};
  const family = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--weight") {
      parsed.weight = values[++index];
      continue;
    }
    if (value === "--style") {
      parsed.style = values[++index];
      continue;
    }
    family.push(value);
  }

  return { ...parsed, family: family.join(" ").trim() || undefined };
}

async function googleFontsDirectory(slug) {
  for (const license of ["ofl", "apache", "ufl"]) {
    const path = `${license}/${slug}`;
    const response = await fetch(`https://api.github.com/repos/google/fonts/contents/${path}`, {
      headers: { "User-Agent": "vasa-font-installer" },
    });
    if (response.ok) return path;
  }

  throw new Error(`Could not find ${slug} in google/fonts under ofl, apache, or ufl.`);
}

function selectFontFile(files, family, weight, style) {
  const ttfFiles = files.filter((file) => file.type === "file" && /\.ttf$/i.test(file.name));
  const normalizedFamily = family.replaceAll(/\s+/g, "");
  const styleSuffix = style === "normal" ? "" : style.charAt(0).toUpperCase() + style.slice(1);
  const exactName = `${normalizedFamily}-${weight === "400" ? "Regular" : `${weight}${styleSuffix}`}.ttf`;
  const regularName = `${normalizedFamily}-${style === "normal" ? "Regular" : styleSuffix}.ttf`;

  return (
    ttfFiles.find((file) => file.name === exactName) ??
    ttfFiles.find((file) => file.name === regularName) ??
    ttfFiles.find(
      (file) =>
        /\[[^\]]*wght[^\]]*\]/i.test(file.name) && style === "normal" && !/italic/i.test(file.name),
    ) ??
    ttfFiles.find((file) => file.name.includes(`[ital,wght]`)) ??
    ttfFiles[0]
  );
}

async function githubJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "vasa-font-installer" } });
  if (!response.ok)
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  return response.json();
}

async function githubBytes(url) {
  const response = await fetch(url, { headers: { "User-Agent": "vasa-font-installer" } });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function githubText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "vasa-font-installer" } });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  return response.text();
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "")
    .trim();
}

function localFontFileName(family, weight, style) {
  const normalizedFamily = family
    .trim()
    .replaceAll(/[^a-z0-9]+/gi, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const styleName =
    style === "normal" ? (weight === "400" ? "Regular" : weight) : `${weight}-${style}`;
  return `${normalizedFamily}-${styleName}.ttf`;
}
