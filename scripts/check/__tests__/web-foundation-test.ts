import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const projectRoot = path.resolve(__dirname, "..", "..", "..");
const checkerPath = path.join(projectRoot, "scripts", "check", "web-foundation.ts");
const fontDirectoryParts = ["assets", "fonts", "Manrope"];
const semiboldAsset = "Manrope-SemiBold.80cb1a8ba262608706cb7f2b017835.ttf";

async function createFixture() {
  const exportDirectory = await mkdtemp(path.join(tmpdir(), "himu-web-foundation-test-"));
  const fontDirectory = path.join(exportDirectory, ...fontDirectoryParts);
  const bundleDirectory = path.join(exportDirectory, "_expo", "static", "js", "web");

  await Promise.all([mkdir(fontDirectory, { recursive: true }), mkdir(bundleDirectory, { recursive: true })]);
  await Promise.all([
    writeFile(path.join(exportDirectory, "index.html"), "Manrope-Regular Manrope-SemiBold Manrope-Bold"),
    writeFile(path.join(exportDirectory, "login.html"), "login"),
    writeFile(path.join(exportDirectory, "profile.html"), "profile"),
    writeFile(path.join(exportDirectory, "player.html"), "player"),
    writeFile(path.join(bundleDirectory, "bundle.any-hash.js"), '"himu-image-fallback"'),
    writeFile(path.join(fontDirectory, "Manrope-Regular.8ca1a84037fdb644723129315c390ad9.ttf"), "regular"),
    writeFile(path.join(fontDirectory, semiboldAsset), "semibold"),
    writeFile(path.join(fontDirectory, "Manrope-Bold.8e8fe178c0f147b91ed2a2b3097ad8a4.ttf"), "bold"),
  ]);

  return exportDirectory;
}

function runChecker(exportDirectory: string) {
  return execFile(process.execPath, ["--import", "tsx", checkerPath, exportDirectory], {
    cwd: projectRoot,
  });
}

async function withFixture(run: (exportDirectory: string) => Promise<void>) {
  const exportDirectory = await createFixture();
  try {
    await run(exportDirectory);
  } finally {
    await rm(exportDirectory, { recursive: true, force: true });
  }
}

async function replaceSemiboldAsset(exportDirectory: string, replacementPath: string) {
  await unlink(path.join(exportDirectory, ...fontDirectoryParts, semiboldAsset));
  const fullReplacementPath = path.join(exportDirectory, ...fontDirectoryParts, replacementPath);
  await mkdir(path.dirname(fullReplacementPath), { recursive: true });
  await writeFile(fullReplacementPath, "not semibold");
}

describe("web foundation checker", () => {
  jest.setTimeout(15_000);

  test("accepts a complete export with Expo-style opaque font hashes", async () => {
    await withFixture(async (exportDirectory) => {
      await expect(runChecker(exportDirectory)).resolves.toBeDefined();
    });
  });

  test("rejects a prefixed font filename as SemiBold evidence", async () => {
    await withFixture(async (exportDirectory) => {
      await replaceSemiboldAsset(exportDirectory, "not-Manrope-SemiBold.ttf");
      await expect(runChecker(exportDirectory)).rejects.toBeDefined();
    });
  });

  test("rejects a Manrope family directory without a matching basename", async () => {
    await withFixture(async (exportDirectory) => {
      await replaceSemiboldAsset(exportDirectory, path.join("Manrope-SemiBold", "font.ttf"));
      await expect(runChecker(exportDirectory)).rejects.toBeDefined();
    });
  });

  test("rejects a longer font basename token as SemiBold evidence", async () => {
    await withFixture(async (exportDirectory) => {
      await replaceSemiboldAsset(exportDirectory, "Manrope-SemiBoldExtra.ttf");
      await expect(runChecker(exportDirectory)).rejects.toBeDefined();
    });
  });

  test("rejects a longer text token as a Manrope family reference", async () => {
    await withFixture(async (exportDirectory) => {
      await writeFile(
        path.join(exportDirectory, "index.html"),
        "Manrope-Regular Manrope-SemiBoldExtra Manrope-Bold",
      );
      await expect(runChecker(exportDirectory)).rejects.toBeDefined();
    });
  });
});
