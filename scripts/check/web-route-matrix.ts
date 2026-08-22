import { constants, lstat, open } from "node:fs/promises";
import path from "node:path";

export const WEB_ROUTE_MATRIX = [
  { label: "Login", artifacts: ["login.html", "login/index.html", "(auth)/login.html"] },
  { label: "Home", artifacts: ["index.html", "(app)/index.html"] },
  { label: "Discover", artifacts: ["discover.html", "discover/index.html", "(app)/discover.html"] },
  { label: "Profile", artifacts: ["profile.html", "profile/index.html", "(app)/profile.html"] },
  { label: "Player", artifacts: ["player.html", "player/index.html"] },
  { label: "DJ", artifacts: ["dj/[id].html", "dj/[id]/index.html"] },
  { label: "Favorites", artifacts: ["favorites.html", "favorites/index.html"] },
  { label: "Focus", artifacts: ["focus-mode.html", "focus-mode/index.html"] },
  { label: "Vibe", artifacts: ["vibe-check.html", "vibe-check/index.html"] },
  { label: "Create DJ", artifacts: ["create-dj.html", "create-dj/index.html"] },
  { label: "Create Track", artifacts: ["create-track.html", "create-track/index.html"] },
  { label: "Train DJ", artifacts: ["train-dj/[id].html", "train-dj/[id]/index.html"] },
  { label: "Preferences", artifacts: ["preferences.html", "preferences/index.html"] },
  { label: "Account Settings", artifacts: ["account-settings.html", "account-settings/index.html"] },
] as const;

const MAX_ARTIFACT_BYTES = 1024 * 1024;
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024;
const EXPO_ARTIFACT_MARKERS = [
  /<!doctype html/i,
  /<div\s+id=["']root["']/i,
  /id=["']expo-reset["']/i,
  /id=["']react-native-stylesheet["']/i,
  /__EXPO_ROUTER_HYDRATE__/,
] as const;
const SCRIPT_SOURCE = /<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>/gi;
const EXPO_WEB_SCRIPT = /^\/_expo\/static\/js\/web\/[A-Za-z0-9._-]+\.(?:js|mjs)$/i;

function errorCode(error: unknown) {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function json(value: string) {
  return JSON.stringify(value);
}

async function regularFileSize(filePath: string) {
  try {
    const stats = await lstat(filePath);
    return stats.isFile() ? stats.size : undefined;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

async function findRouteArtifact(exportDirectory: string, artifacts: readonly string[]) {
  for (const artifact of artifacts) {
    const size = await regularFileSize(path.join(exportDirectory, artifact));
    if (size !== undefined) return { artifact, size };
  }
  return undefined;
}

async function boundedRead(filePath: string, size: number) {
  const file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const currentStats = await file.stat();
    if (!currentStats.isFile() || currentStats.size !== size) {
      throw new Error("file changed while it was being inspected");
    }
    const buffer = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await file.read(buffer, offset, size - offset, offset);
      if (bytesRead === 0) throw new Error("unexpected end of file");
      offset += bytesRead;
    }
    return buffer.toString("utf8");
  } finally {
    await file.close();
  }
}

function productionBundleSource(html: string) {
  SCRIPT_SOURCE.lastIndex = 0;
  for (const match of html.matchAll(SCRIPT_SOURCE)) {
    if (EXPO_WEB_SCRIPT.test(match[2])) return match[2];
  }
  return undefined;
}

async function inspectArtifact(
  exportDirectory: string,
  label: string,
  artifact: string,
  size: number,
) {
  if (size > MAX_ARTIFACT_BYTES) {
    return `${label} route artifact ${json(artifact)} exceeds the ${MAX_ARTIFACT_BYTES}-byte read limit.`;
  }

  let html: string;
  try {
    html = await boundedRead(path.join(exportDirectory, artifact), size);
  } catch (error) {
    return `Unable to read ${label} route artifact ${json(artifact)}: ${message(error)}.`;
  }

  if (!EXPO_ARTIFACT_MARKERS.every((marker) => marker.test(html))) {
    return `${label} route artifact ${json(artifact)} is not a complete Expo Router web artifact.`;
  }

  const bundleSource = productionBundleSource(html);
  if (!bundleSource) {
    return `${label} route artifact ${json(artifact)} is not a complete Expo Router web artifact.`;
  }

  const bundlePath = path.join(exportDirectory, bundleSource.slice(1));
  let bundleSize: number | undefined;
  try {
    bundleSize = await regularFileSize(bundlePath);
  } catch (error) {
    return `Unable to inspect the production bundle referenced by ${label}: ${message(error)}.`;
  }

  if (bundleSize === undefined || bundleSize === 0) {
    return `${label} route artifact ${json(artifact)} references a missing production bundle.`;
  }
  if (bundleSize > MAX_BUNDLE_BYTES) {
    return `${label} route artifact ${json(artifact)} references a production bundle larger than ${MAX_BUNDLE_BYTES} bytes.`;
  }

  return undefined;
}

export async function verifyWebRouteMatrix(exportDirectory: string) {
  const resolvedDirectory = path.resolve(exportDirectory);
  let rootStats;
  try {
    rootStats = await lstat(resolvedDirectory);
  } catch (error) {
    throw new Error(
      `Web route matrix verification failed: unable to inspect export directory ${json(resolvedDirectory)}: ${message(error)}.`,
    );
  }
  if (!rootStats.isDirectory()) {
    throw new Error(
      `Web route matrix verification failed: export path ${json(resolvedDirectory)} is not a directory.`,
    );
  }

  const failures: string[] = [];
  for (const route of WEB_ROUTE_MATRIX) {
    let found;
    try {
      found = await findRouteArtifact(resolvedDirectory, route.artifacts);
    } catch (error) {
      failures.push(`Unable to inspect ${route.label} route artifacts: ${message(error)}.`);
      continue;
    }

    if (!found) {
      failures.push(
        `${route.label} route artifact is missing (expected one of: ${route.artifacts.join(", ")}).`,
      );
      continue;
    }

    const artifactFailure = await inspectArtifact(
      resolvedDirectory,
      route.label,
      found.artifact,
      found.size,
    );
    if (artifactFailure) failures.push(artifactFailure);
  }

  if (failures.length > 0) {
    throw new Error(
      `Web route matrix verification failed for ${json(resolvedDirectory)}:\n${failures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
  }
}

async function main() {
  const [exportDirectory] = process.argv.slice(2);
  if (!exportDirectory) {
    throw new Error(
      "Missing export directory. Run `npm run check:web-route-matrix -- /path/to/web-export`.",
    );
  }

  await verifyWebRouteMatrix(exportDirectory);
  console.log(`Web route matrix verified: ${WEB_ROUTE_MATRIX.length} shipped route artifacts.`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(message(error));
    process.exitCode = 1;
  });
}
