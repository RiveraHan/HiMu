import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { verifyWebRouteMatrix, WEB_ROUTE_MATRIX } from "../web-route-matrix";

const routeArtifacts = [
  ["Login", "login.html"],
  ["Home", "index.html"],
  ["Discover", "discover.html"],
  ["Profile", "profile.html"],
  ["Player", "player.html"],
  ["DJ", "dj/[id].html"],
  ["Favorites", "favorites.html"],
  ["Focus", "focus-mode.html"],
  ["Vibe", "vibe-check.html"],
  ["Create DJ", "create-dj.html"],
  ["Create Track", "create-track.html"],
  ["Train DJ", "train-dj/[id].html"],
  ["Preferences", "preferences.html"],
  ["Account Settings", "account-settings.html"],
] as const;

const bundleRelativePath = "_expo/static/js/web/entry.js";
const validHtml = `<!DOCTYPE html><html><head>
  <style id="expo-reset">#root{display:flex}</style>
  <style id="react-native-stylesheet">.css-view{display:flex}</style>
  <script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>
</head><body><div id="root"></div>
<script src="/${bundleRelativePath}" defer></script></body></html>`;

async function createExport(options?: {
  artifactContent?: string;
  omitArtifact?: string;
  omitBundle?: boolean;
}) {
  const exportDirectory = await mkdtemp(path.join(tmpdir(), "himu-web-route-matrix-"));

  await Promise.all(
    routeArtifacts
      .filter(([, artifact]) => artifact !== options?.omitArtifact)
      .map(async ([, artifact]) => {
        const artifactPath = path.join(exportDirectory, artifact);
        await mkdir(path.dirname(artifactPath), { recursive: true });
        await writeFile(artifactPath, options?.artifactContent ?? validHtml);
      }),
  );

  if (!options?.omitBundle) {
    const bundlePath = path.join(exportDirectory, bundleRelativePath);
    await mkdir(path.dirname(bundlePath), { recursive: true });
    await writeFile(bundlePath, "production Expo bundle".repeat(64));
  }

  return exportDirectory;
}

async function withExport(
  run: (exportDirectory: string) => Promise<void>,
  options?: Parameters<typeof createExport>[0],
) {
  const exportDirectory = await createExport(options);
  try {
    await run(exportDirectory);
  } finally {
    await rm(exportDirectory, { recursive: true, force: true });
  }
}

async function failureMessage(exportDirectory: string) {
  try {
    await verifyWebRouteMatrix(exportDirectory);
    throw new Error("Expected web route matrix verification to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return (error as Error).message;
  }
}

describe("web route matrix checker", () => {
  it("accepts the complete shipped-route export without requiring Community", async () => {
    await withExport(async (exportDirectory) => {
      await expect(verifyWebRouteMatrix(exportDirectory)).resolves.toBeUndefined();
    });
  });

  it("publishes exactly the fourteen shipped routes in the QA matrix", () => {
    expect(WEB_ROUTE_MATRIX.map(({ label }) => label)).toEqual([
      "Login",
      "Home",
      "Discover",
      "Profile",
      "Player",
      "DJ",
      "Favorites",
      "Focus",
      "Vibe",
      "Create DJ",
      "Create Track",
      "Train DJ",
      "Preferences",
      "Account Settings",
    ]);
    expect(WEB_ROUTE_MATRIX.some(({ label }) => label === "Community")).toBe(false);
  });

  it.each(routeArtifacts)("names a missing %s artifact", async (label, artifact) => {
    await withExport(
      async (exportDirectory) => {
        const message = await failureMessage(exportDirectory);
        expect(message).toContain(`${label} route artifact is missing`);
      },
      { omitArtifact: artifact },
    );
  });

  it("rejects filenames that do not contain an Expo Router web artifact", async () => {
    await withExport(
      async (exportDirectory) => {
        const message = await failureMessage(exportDirectory);
        expect(message).toContain("is not a complete Expo Router web artifact");
      },
      { artifactContent: "fixture-only route name and markup" },
    );
  });

  it("requires each artifact's referenced production bundle to exist", async () => {
    await withExport(
      async (exportDirectory) => {
        const message = await failureMessage(exportDirectory);
        expect(message).toContain("references a missing production bundle");
      },
      { omitBundle: true },
    );
  });

  it("does not recurse into unrelated fixture directories for missing routes", async () => {
    await withExport(
      async (exportDirectory) => {
        const unrelated = path.join(exportDirectory, "fixtures", "create-track.html");
        await mkdir(path.dirname(unrelated), { recursive: true });
        await writeFile(unrelated, validHtml);

        const message = await failureMessage(exportDirectory);
        expect(message).toContain("Create Track route artifact is missing");
      },
      { omitArtifact: "create-track.html" },
    );
  });

  it("rejects symlinked route artifacts instead of reading outside the export", async () => {
    await withExport(async (exportDirectory) => {
      const externalDirectory = await mkdtemp(path.join(tmpdir(), "himu-route-external-"));
      const externalArtifact = path.join(externalDirectory, "login.html");
      try {
        await writeFile(externalArtifact, validHtml);
        await rm(path.join(exportDirectory, "login.html"));
        await symlink(externalArtifact, path.join(exportDirectory, "login.html"));

        const message = await failureMessage(exportDirectory);
        expect(message).toContain("Login route artifact is missing");
      } finally {
        await rm(externalDirectory, { recursive: true, force: true });
      }
    });
  });

  it("rejects oversized HTML rather than performing an unbounded read", async () => {
    await withExport(async (exportDirectory) => {
      await writeFile(path.join(exportDirectory, "login.html"), "x".repeat(1024 * 1024 + 1));

      const message = await failureMessage(exportDirectory);
      expect(message).toContain("exceeds the 1048576-byte read limit");
    });
  });
});
