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
  "himu-web-core-app-shell",
  "himu-web-core-desktop-rail",
  "himu-web-core-login-hero",
  "himu-web-core-home-grid",
  "himu-web-core-profile-layout",
  "himu-web-core-player-stage",
  "himu-web-core-dj-layout",
  "himu-web-core-focus-stage",
  "himu-web-core-vibe-dashboard",
  "himu-web-core-track-grid",
];

const strippedTestIdMarkers = [
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
  htmlContent?: string;
  unrelatedJavaScriptContent?: string;
  unrelatedProductionJavaScriptContent?: string;
  productionDirectoryEntryCount?: number;
  prefix?: string;
}) {
  const exportDirectory = await mkdtemp(
    path.join(tmpdir(), options?.prefix ?? "himu-web-core-routes-test-"),
  );
  const bundleDirectory = path.join(exportDirectory, "_expo", "static", "js", "web");

  await Promise.all([
    ...coreRouteArtifacts
      .filter((route) => route !== options?.omitRoute)
      .map(async (route) => {
        const routePath = path.join(exportDirectory, route);
        await mkdir(path.dirname(routePath), { recursive: true });
        await writeFile(
          routePath,
          route === "index.html" ? options?.htmlContent ?? "static route" : "static route",
        );
      }),
    mkdir(bundleDirectory, { recursive: true }),
  ]);

  await writeFile(
    path.join(bundleDirectory, "index-7064c481a59b49c3f2670097fc6d8ef7.js"),
    options?.bundleContent ?? presentationMarkers.map((marker) => `nativeID:"${marker}"`).join(";"),
  );

  if (options?.unrelatedJavaScriptContent) {
    const unrelatedDirectory = path.join(exportDirectory, "scripts", "check");
    await mkdir(unrelatedDirectory, { recursive: true });
    await writeFile(
      path.join(unrelatedDirectory, "web-core-routes.test.js"),
      options.unrelatedJavaScriptContent,
    );
  }

  if (options?.unrelatedProductionJavaScriptContent) {
    await writeFile(
      path.join(bundleDirectory, "web-core-routes.test.js"),
      options.unrelatedProductionJavaScriptContent,
    );
  }

  await Promise.all(
    Array.from({ length: options?.productionDirectoryEntryCount ?? 0 }, (_, index) =>
      writeFile(path.join(bundleDirectory, `unrelated-${index}.txt`), "ignored"),
    ),
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

async function checkerFailure(exportDirectory: string) {
  try {
    await verifyWebCoreRoutes(exportDirectory);
    throw new Error("Expected web core route verification to fail.");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);
    return (error as Error).message;
  }
}

async function expectCheckerFailure(exportDirectory: string, diagnostic: string) {
  const message = await checkerFailure(exportDirectory);
  expect(message).toContain("Web core route verification failed");
  expect(message).toContain(diagnostic);
}

describe("web core route checker", () => {
  test("accepts all core routes and stable native presentation IDs from Expo production assets", async () => {
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
          .map((marker) => `nativeID:"${marker === "himu-web-core-desktop-rail" ? "himu-web-core-desktop-railing" : marker}"`)
          .join(";"),
      },
    );
  });

  test("rejects markers copied into route HTML when the production bundle lacks them", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "himu-web-core-home-grid");
      },
      {
        htmlContent: presentationMarkers.map((marker) => `data-marker="${marker}"`).join(" "),
        bundleContent: presentationMarkers
          .filter((marker) => marker !== "himu-web-core-home-grid")
          .map((marker) => `nativeID:"${marker}"`)
          .join(";"),
      },
    );
  });

  test("rejects markers found only in unrelated JavaScript outside Expo production assets", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "himu-web-core-vibe-dashboard");
      },
      {
        bundleContent: presentationMarkers
          .filter((marker) => marker !== "himu-web-core-vibe-dashboard")
          .map((marker) => `nativeID:"${marker}"`)
          .join(";"),
        unrelatedJavaScriptContent: presentationMarkers
          .map((marker) => `nativeID:"${marker}"`)
          .join(";"),
      },
    );
  });

  test("rejects markers found only in an invalid JavaScript filename beside the Expo bundle", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "himu-web-core-profile-layout");
      },
      {
        bundleContent: presentationMarkers
          .filter((marker) => marker !== "himu-web-core-profile-layout")
          .map((marker) => `nativeID:"${marker}"`)
          .join(";"),
        unrelatedProductionJavaScriptContent: presentationMarkers
          .map((marker) => `nativeID:"${marker}"`)
          .join(";"),
      },
    );
  });

  test("rejects the former production-stripped testID values as presentation evidence", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "himu-web-core-app-shell");
      },
      { bundleContent: strippedTestIdMarkers.map((marker) => `testID:"${marker}"`).join(";") },
    );
  });

  test("finds an exact marker split across bounded bundle read chunks", async () => {
    const splitMarker = "himu-web-core-desktop-rail";
    const largePrefix = "x".repeat(64 * 1024 - 5);
    await withFixture(
      async (exportDirectory) => {
        await expect(verifyWebCoreRoutes(exportDirectory)).resolves.toBeUndefined();
      },
      {
        bundleContent: [
          largePrefix,
          `"${splitMarker}"`,
          ...presentationMarkers
            .filter((marker) => marker !== splitMarker)
            .map((marker) => `nativeID:"${marker}"`),
        ].join(";"),
      },
    );
  });

  test("fails before reading an oversized production bundle", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "exceeds the per-file scan limit");
      },
      {
        bundleContent: `${presentationMarkers.map((marker) => `"${marker}"`).join(";")};${"x".repeat(9 * 1024 * 1024)}`,
      },
    );
  });

  test("fails when the direct Expo bundle directory exceeds its entry scan limit", async () => {
    await withFixture(
      async (exportDirectory) => {
        await expectCheckerFailure(exportDirectory, "directory entry scan limit");
      },
      { productionDirectoryEntryCount: 33 },
    );
  });

  test("quotes a missing directory with spaces in both diagnostics and the suggested command", async () => {
    const missingDirectory = path.join(tmpdir(), "himu web core missing export");
    const message = await checkerFailure(missingDirectory);

    expect(message).toContain(JSON.stringify(missingDirectory));
    expect(message).toContain(`--output-dir '${missingDirectory}'`);
  });

  test("reports a non-directory export path with an actionable quoted diagnostic", async () => {
    await withFixture(async (exportDirectory) => {
      const notDirectory = path.join(exportDirectory, "web export file");
      await writeFile(notDirectory, "not a directory");

      const message = await checkerFailure(notDirectory);
      expect(message).toContain("is not a directory");
      expect(message).toContain(JSON.stringify(notDirectory));
      expect(message).toContain(`--output-dir '${notDirectory}'`);
    });
  });
});
