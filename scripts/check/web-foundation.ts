import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type ExportFile = {
  absolutePath: string;
  relativePath: string;
};

const REQUIRED_ROUTES = [
  { label: "Login", artifacts: ["login.html", "login/index.html", "(auth)/login.html"] },
  { label: "Home", artifacts: ["index.html"] },
  { label: "Profile", artifacts: ["profile.html", "profile/index.html", "(app)/profile.html"] },
  { label: "Player", artifacts: ["player.html", "player/index.html"] },
] as const;

const MANROPE_FAMILIES = [
  "Manrope-Regular",
  "Manrope-SemiBold",
  "Manrope-Bold",
] as const;

const IMAGE_FALLBACK_MARKER = "himu-image-fallback";
const TEXT_ARTIFACT_EXTENSION = /\.(?:html?|js|mjs|css)$/i;
const FONT_ASSET_EXTENSION = /\.(?:ttf|otf|woff2?)$/i;
const FONT_HASH_SUFFIX = "(?:[._-][a-f0-9]{6,})*";

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function familyReferenceExpression(family: string) {
  return new RegExp(
    `(^|[^a-z0-9_-])${escapeRegularExpression(family)}(?=$|[^a-z0-9_-])`,
    "i",
  );
}

function familyAssetExpression(family: string) {
  return new RegExp(
    `^${escapeRegularExpression(family)}${FONT_HASH_SUFFIX}\\.(?:ttf|otf|woff2?)$`,
    "i",
  );
}

async function listFiles(directory: string, relativeDirectory = ""): Promise<ExportFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: ExportFile[] = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

function manropeAssetFamily(relativePath: string) {
  if (!FONT_ASSET_EXTENSION.test(relativePath)) return undefined;

  const basename = path.posix.basename(relativePath);
  return MANROPE_FAMILIES.find((family) => familyAssetExpression(family).test(basename));
}

async function scanTextArtifacts(files: ExportFile[]) {
  const referencedManropeFamilies = new Set<string>();
  let hasImageFallbackMarker = false;

  for (const file of files) {
    if (!TEXT_ARTIFACT_EXTENSION.test(file.relativePath)) continue;

    const content = await readFile(file.absolutePath, "utf8");
    for (const family of MANROPE_FAMILIES) {
      if (familyReferenceExpression(family).test(content)) referencedManropeFamilies.add(family);
    }
    if (content.includes(IMAGE_FALLBACK_MARKER)) hasImageFallbackMarker = true;
  }

  return { referencedManropeFamilies, hasImageFallbackMarker };
}

export async function verifyWebFoundation(exportDirectory: string) {
  const resolvedDirectory = path.resolve(exportDirectory);
  let directoryStats;
  try {
    directoryStats = await stat(resolvedDirectory);
  } catch {
    throw new Error(
      `Export directory does not exist: ${resolvedDirectory}. Run \`npx expo export --platform web --output-dir ${resolvedDirectory}\` first.`,
    );
  }

  if (!directoryStats.isDirectory()) {
    throw new Error(`Export path is not a directory: ${resolvedDirectory}.`);
  }

  const files = await listFiles(resolvedDirectory);
  const filePaths = new Set(files.map((file) => file.relativePath));
  const { referencedManropeFamilies, hasImageFallbackMarker } = await scanTextArtifacts(files);
  const bundledManropeAssets = new Set(
    files.map((file) => manropeAssetFamily(file.relativePath)).filter(Boolean),
  );
  const failures: string[] = [];

  for (const route of REQUIRED_ROUTES) {
    if (!route.artifacts.some((artifact) => filePaths.has(artifact))) {
      failures.push(
        `${route.label} route artifact is missing (expected one of: ${route.artifacts.join(", ")}).`,
      );
    }
  }

  const missingFontReferences = MANROPE_FAMILIES.filter(
    (family) => !referencedManropeFamilies.has(family),
  );
  if (missingFontReferences.length > 0) {
    failures.push(
      `Missing bundled Manrope reference(s): ${missingFontReferences.join(", ")}.`,
    );
  }

  const missingFontAssets = MANROPE_FAMILIES.filter((family) => !bundledManropeAssets.has(family));
  if (missingFontAssets.length > 0) {
    failures.push(
      `Missing bundled Manrope asset(s): ${missingFontAssets.join(", ")}. Expected individually named .ttf, .otf, .woff, or .woff2 files; hash suffixes are allowed.`,
    );
  }

  if (!hasImageFallbackMarker) {
    failures.push(
      `Resilient image fallback marker \`${IMAGE_FALLBACK_MARKER}\` is absent from the bundled text artifacts.`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Web foundation verification failed for ${resolvedDirectory}:\n${failures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
  }
}

async function main() {
  const [exportDirectory] = process.argv.slice(2);

  if (!exportDirectory) {
    throw new Error(
      "Missing export directory. Run `npm run check:web-foundation -- /path/to/web-export`.",
    );
  }

  await verifyWebFoundation(exportDirectory);

  console.log(
    `Web foundation verified: ${REQUIRED_ROUTES.length} routes, ${MANROPE_FAMILIES.length} Manrope families, and resilient image fallback marker.`,
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
