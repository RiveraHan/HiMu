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

async function main() {
  const [exportDirectory] = process.argv.slice(2);

  if (!exportDirectory) {
    throw new Error(
      "Missing export directory. Run `npm run check:web-foundation -- /path/to/web-export`.",
    );
  }

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
  const textFiles = files.filter((file) => TEXT_ARTIFACT_EXTENSION.test(file.relativePath));
  const textArtifacts = await Promise.all(
    textFiles.map(async (file) => ({
      relativePath: file.relativePath,
      content: await readFile(file.absolutePath, "utf8"),
    })),
  );
  const allText = textArtifacts.map((artifact) => artifact.content).join("\n");
  const failures: string[] = [];

  for (const route of REQUIRED_ROUTES) {
    if (!route.artifacts.some((artifact) => filePaths.has(artifact))) {
      failures.push(
        `${route.label} route artifact is missing (expected one of: ${route.artifacts.join(", ")}).`,
      );
    }
  }

  const missingFontReferences = MANROPE_FAMILIES.filter((family) => !allText.includes(family));
  if (missingFontReferences.length > 0) {
    failures.push(
      `Missing bundled Manrope reference(s): ${missingFontReferences.join(", ")}.`,
    );
  }

  if (!files.some((file) => FONT_ASSET_EXTENSION.test(file.relativePath) && /manrope/i.test(file.relativePath))) {
    failures.push("No bundled Manrope font asset was found (expected a .ttf, .otf, .woff, or .woff2 file).");
  }

  if (!allText.includes(IMAGE_FALLBACK_MARKER)) {
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

  console.log(
    `Web foundation verified: ${REQUIRED_ROUTES.length} routes, ${MANROPE_FAMILIES.length} Manrope families, and resilient image fallback marker.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
