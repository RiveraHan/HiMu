import { opendir, open, stat } from "node:fs/promises";
import path from "node:path";

type BundleFile = {
  absolutePath: string;
  relativePath: string;
  size: number;
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

const EXPO_WEB_BUNDLE_DIRECTORY = path.join("_expo", "static", "js", "web");
const EXPO_WEB_BUNDLE_NAME = /^index-[a-f0-9]{8,}\.(?:js|mjs)$/i;
const MAX_BUNDLE_DIRECTORY_ENTRIES = 32;
const MAX_BUNDLE_FILE_COUNT = 32;
const MAX_BUNDLE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BUNDLE_BYTES = 16 * 1024 * 1024;
const BUNDLE_READ_CHUNK_BYTES = 64 * 1024;

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PRESENTATION_MARKER_EXPRESSIONS = PRESENTATION_MARKERS.map(
  (marker) => [marker, new RegExp(`(["'])${escapeRegularExpression(marker)}\\1`)] as const,
);
const MARKER_CARRY_BYTES = Math.max(...PRESENTATION_MARKERS.map((marker) => marker.length + 2));

function jsonPath(value: string) {
  return JSON.stringify(value);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function exportCommand(exportDirectory: string) {
  return `npx expo export --platform web --output-dir ${shellQuote(exportDirectory)}`;
}

function verificationFailure(exportDirectory: string, failures: readonly string[]) {
  return new Error(
    `Web core route verification failed for ${jsonPath(exportDirectory)}:\n${failures
      .map((failure) => `- ${failure}`)
      .join("\n")}\nRun \`${exportCommand(exportDirectory)}\` first.`,
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown) {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

async function routeArtifactExists(exportDirectory: string, artifact: string) {
  try {
    return (await stat(path.join(exportDirectory, artifact))).isFile();
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw new Error(`Unable to inspect route artifact ${jsonPath(artifact)}: ${errorMessage(error)}.`);
  }
}

async function listExpoWebBundles(exportDirectory: string): Promise<BundleFile[]> {
  const bundleDirectory = path.join(exportDirectory, EXPO_WEB_BUNDLE_DIRECTORY);
  let directory;
  try {
    directory = await opendir(bundleDirectory);
  } catch (error) {
    throw new Error(
      `Unable to inspect Expo production JavaScript directory ${jsonPath(EXPO_WEB_BUNDLE_DIRECTORY)}: ${errorMessage(error)}.`,
    );
  }

  const bundles: BundleFile[] = [];
  let directoryEntryCount = 0;
  let fileCount = 0;
  let totalBytes = 0;

  // Expo writes web bundles directly in this directory; do not recurse into
  // arbitrary export content where a source, test, or checker could be copied.
  for await (const entry of directory) {
    directoryEntryCount += 1;
    if (directoryEntryCount > MAX_BUNDLE_DIRECTORY_ENTRIES) {
      throw new Error(
        `Expo production JavaScript directory entry scan limit of ${MAX_BUNDLE_DIRECTORY_ENTRIES} was exceeded.`,
      );
    }

    if (!entry.isFile() || !EXPO_WEB_BUNDLE_NAME.test(entry.name)) continue;

    fileCount += 1;
    if (fileCount > MAX_BUNDLE_FILE_COUNT) {
      throw new Error(
        `Expo production JavaScript directory exceeds the ${MAX_BUNDLE_FILE_COUNT}-file scan limit.`,
      );
    }

    const absolutePath = path.join(bundleDirectory, entry.name);
    let fileStats;
    try {
      fileStats = await stat(absolutePath);
    } catch (error) {
      throw new Error(`Unable to inspect Expo bundle ${jsonPath(entry.name)}: ${errorMessage(error)}.`);
    }

    if (!fileStats.isFile()) continue;
    if (fileStats.size > MAX_BUNDLE_FILE_BYTES) {
      throw new Error(
        `Expo bundle ${jsonPath(entry.name)} exceeds the per-file scan limit of ${MAX_BUNDLE_FILE_BYTES} bytes.`,
      );
    }

    totalBytes += fileStats.size;
    if (totalBytes > MAX_TOTAL_BUNDLE_BYTES) {
      throw new Error(
        `Expo production JavaScript exceeds the total scan limit of ${MAX_TOTAL_BUNDLE_BYTES} bytes.`,
      );
    }

    bundles.push({
      absolutePath,
      relativePath: path.posix.join(EXPO_WEB_BUNDLE_DIRECTORY, entry.name),
      size: fileStats.size,
    });
  }

  if (bundles.length === 0) {
    throw new Error(
      `No valid Expo production JavaScript bundles found in ${jsonPath(EXPO_WEB_BUNDLE_DIRECTORY)}. Expected files named like \`index-<content-hash>.js\`.`,
    );
  }

  return bundles;
}

async function findPresentationMarkers(bundles: readonly BundleFile[]) {
  const markers = new Set<string>();

  for (const bundle of bundles) {
    let file;
    try {
      file = await open(bundle.absolutePath, "r");
    } catch (error) {
      throw new Error(`Unable to open Expo bundle ${jsonPath(bundle.relativePath)}: ${errorMessage(error)}.`);
    }

    try {
      let position = 0;
      let carry = "";

      while (position < bundle.size) {
        const buffer = Buffer.allocUnsafe(Math.min(BUNDLE_READ_CHUNK_BYTES, bundle.size - position));
        const { bytesRead } = await file.read(buffer, 0, buffer.length, position);
        if (bytesRead === 0) {
          throw new Error(`Unexpected end of Expo bundle ${jsonPath(bundle.relativePath)}.`);
        }

        const content = carry + buffer.toString("utf8", 0, bytesRead);
        for (const [marker, expression] of PRESENTATION_MARKER_EXPRESSIONS) {
          if (expression.test(content)) markers.add(marker);
        }
        carry = content.slice(-MARKER_CARRY_BYTES);
        position += bytesRead;
      }
    } catch (error) {
      throw new Error(`Unable to scan Expo bundle ${jsonPath(bundle.relativePath)}: ${errorMessage(error)}.`);
    } finally {
      await file.close();
    }
  }

  return markers;
}

export async function verifyWebCoreRoutes(exportDirectory: string) {
  const resolvedDirectory = path.resolve(exportDirectory);
  let directoryStats;
  try {
    directoryStats = await stat(resolvedDirectory);
  } catch (error) {
    const reason = errorCode(error) === "ENOENT"
      ? `Export directory ${jsonPath(resolvedDirectory)} does not exist.`
      : `Unable to inspect export directory ${jsonPath(resolvedDirectory)}: ${errorMessage(error)}.`;
    throw verificationFailure(resolvedDirectory, [reason]);
  }

  if (!directoryStats.isDirectory()) {
    throw verificationFailure(resolvedDirectory, [
      `Export path ${jsonPath(resolvedDirectory)} is not a directory.`,
    ]);
  }

  const failures: string[] = [];
  for (const route of CORE_ROUTES) {
    const exists = await Promise.all(
      route.artifacts.map((artifact) => routeArtifactExists(resolvedDirectory, artifact)),
    );
    if (!exists.some(Boolean)) {
      failures.push(
        `${route.label} route artifact is missing (expected one of: ${route.artifacts.join(", ")}).`,
      );
    }
  }

  let presentationMarkers: Set<string>;
  try {
    presentationMarkers = await findPresentationMarkers(await listExpoWebBundles(resolvedDirectory));
  } catch (error) {
    throw verificationFailure(resolvedDirectory, [errorMessage(error)]);
  }

  const missingMarkers = PRESENTATION_MARKERS.filter((marker) => !presentationMarkers.has(marker));
  if (missingMarkers.length > 0) {
    failures.push(
      `Missing exact presentation marker(s) in Expo production JavaScript: ${missingMarkers.join(", ")}.`,
    );
  }

  if (failures.length > 0) throw verificationFailure(resolvedDirectory, failures);
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
