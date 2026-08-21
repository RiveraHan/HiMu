import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type WebCoreRouteChecker = (exportDirectory: string) => Promise<void>;

function verifyWebCoreRoutes(exportDirectory: string) {
  const checker = require("../web-core-routes") as {
    verifyWebCoreRoutes?: WebCoreRouteChecker;
  };

  expect(checker.verifyWebCoreRoutes).toEqual(expect.any(Function));
  return checker.verifyWebCoreRoutes!(exportDirectory);
}

const coreRouteArtifacts = [
  "index.html",
  "login.html",
  "discover.html",
  "profile.html",
  "player.html",
  "dj/[id].html",
  "focus-mode.html",
  "vibe-check.html",
  "favorites.html",
];

const presentationMarkers = [
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
];

async function createFixture(options?: {
  omitRoute?: string;
  bundleContent?: string;
}) {
  const exportDirectory = await mkdtemp(path.join(tmpdir(), "himu-web-core-routes-test-"));
  const bundleDirectory = path.join(exportDirectory, "_expo", "static", "js", "web");

  await Promise.all([
    ...coreRouteArtifacts
      .filter((route) => route !== options?.omitRoute)
      .map(async (route) => {
        const routePath = path.join(exportDirectory, route);
        await mkdir(path.dirname(routePath), { recursive: true });
        await writeFile(routePath, "static route");
      }),
    mkdir(bundleDirectory, { recursive: true }),
  ]);

  await writeFile(
    path.join(bundleDirectory, "app.opaque-build-id.js"),
    options?.bundleContent ?? presentationMarkers.map((marker) => `testID:"${marker}"`).join(";"),
  );

  return exportDirectory;
}

async function withFixture(
  run: (exportDirectory: string) => Promise<void>,
  options?: Parameters<typeof createFixture>[0],
) {
  const exportDirectory = await createFixture(options);
  try {
    await run(exportDirectory);
  } finally {
    await rm(exportDirectory, { recursive: true, force: true });
  }
}

async function expectCheckerFailure(exportDirectory: string, diagnostic: string) {
  try {
    await verifyWebCoreRoutes(exportDirectory);
    throw new Error("Expected web core route verification to fail.");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("Web core route verification failed");
    expect(message).toContain(diagnostic);
  }
}

describe("web core route checker", () => {
  test("accepts all core routes and exact presentation markers from opaque build assets", async () => {
    await withFixture(async (exportDirectory) => {
      await expect(verifyWebCoreRoutes(exportDirectory)).resolves.toBeUndefined();
    });
  });

  test("names the missing core route so the export regression is actionable", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "Focus Mode route artifact is missing");
      },
      { omitRoute: "focus-mode.html" },
    );
  });

  test("rejects a longer presentation token instead of treating it as a marker", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "desktop-rail");
      },
      {
        bundleContent: presentationMarkers
          .map((marker) => `testID:"${marker === "desktop-rail" ? "desktop-railing" : marker}"`)
          .join(";"),
      },
    );
  });

  test("rejects a marker copied into HTML when no JavaScript presentation artifact contains it", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "home-desktop-grid");
      },
      {
        bundleContent: presentationMarkers
          .filter((marker) => marker !== "home-desktop-grid")
          .map((marker) => `testID:"${marker}"`)
          .join(";"),
      },
    );
  });
});
