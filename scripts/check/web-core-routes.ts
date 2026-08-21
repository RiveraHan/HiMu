import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

type ExportFile = {
  absolutePath: string;
  relativePath: string;
};

const CORE_ROUTES = [
  { label: "Login", artifacts: ["login.html", "login/index.html", "(auth)/login.html"] },
  { label: "Home", artifacts: ["index.html"] },
  { label: "Discover", artifacts: ["discover.html", "discover/index.html", "(app)/discover.html"] },
  { label: "Profile", artifacts: ["profile.html", "profile/index.html", "(app)/profile.html"] },
  { label: "Player", artifacts: ["player.html", "player/index.html"] },
  { label: "DJ profile", artifacts: ["dj/[id].html", "dj/[id]/index.html"] },
  { label: "Focus Mode", artifacts: ["focus-mode.html", "focus-mode/index.html"] },
  { label: "Vibe Check", artifacts: ["vibe-check.html", "vibe-check/index.html"] },
  { label: "Favorites", artifacts: ["favorites.html", "favorites/index.html"] },
] as const;

const PRESENTATION_MARKERS = [
  "responsive-app-shell",
  "desktop-rail",
  "login-hero-desktop",
  "home-desktop-grid",
  "profile-desktop-layout",
  "player-desktop-stage",
  "dj-desktop-layout",
  "focus-central-stage",
  "vibe-dashboard",
  "track-grid",
] as const;

const JAVASCRIPT_EXTENSION = /\.(?:js|mjs|cjs)$/i;

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactStringLiteralExpression(value: string) {
  const escaped = escapeRegularExpression(value);
  return new RegExp(`(["'])${escaped}\\1`);
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

async function findPresentationMarkers(files: ExportFile[]) {
  const markers = new Set<string>();

  for (const file of files) {
    if (!JAVASCRIPT_EXTENSION.test(file.relativePath)) continue;

    const content = await readFile(file.absolutePath, "utf8");
    for (const marker of PRESENTATION_MARKERS) {
      if (exactStringLiteralExpression(marker).test(content)) markers.add(marker);
    }
  }

  return markers;
}

export async function verifyWebCoreRoutes(exportDirectory: string) {
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
  const presentationMarkers = await findPresentationMarkers(files);
  const failures: string[] = [];

  for (const route of CORE_ROUTES) {
    if (!route.artifacts.some((artifact) => filePaths.has(artifact))) {
      failures.push(
        `${route.label} route artifact is missing (expected one of: ${route.artifacts.join(", ")}).`,
      );
    }
  }

  const missingMarkers = PRESENTATION_MARKERS.filter((marker) => !presentationMarkers.has(marker));
  if (missingMarkers.length > 0) {
    failures.push(
      `Missing exact presentation marker(s) in bundled JavaScript: ${missingMarkers.join(", ")}.`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Web core route verification failed for ${resolvedDirectory}:\n${failures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
  }
}

async function main() {
  const [exportDirectory] = process.argv.slice(2);
  if (!exportDirectory) {
    throw new Error(
      "Missing export directory. Run `npm run check:web-core-routes -- /path/to/web-export`.",
    );
  }

  await verifyWebCoreRoutes(exportDirectory);
  console.log(
    `Web core routes verified: ${CORE_ROUTES.length} routes and ${PRESENTATION_MARKERS.length} presentation markers.`,
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
