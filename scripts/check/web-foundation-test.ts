import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const checkerPath = fileURLToPath(new URL("./web-foundation.ts", import.meta.url));
const projectRoot = path.resolve(path.dirname(checkerPath), "..", "..");

async function createFixture() {
  const exportDirectory = await mkdtemp(path.join(tmpdir(), "himu-web-foundation-test-"));
  const fontDirectory = path.join(exportDirectory, "assets", "fonts", "Manrope");
  const bundleDirectory = path.join(exportDirectory, "_expo", "static", "js", "web");

  await Promise.all([mkdir(fontDirectory, { recursive: true }), mkdir(bundleDirectory, { recursive: true })]);
  await Promise.all([
    writeFile(path.join(exportDirectory, "index.html"), "Manrope-Regular Manrope-SemiBold Manrope-Bold"),
    writeFile(path.join(exportDirectory, "login.html"), "login"),
    writeFile(path.join(exportDirectory, "profile.html"), "profile"),
    writeFile(path.join(exportDirectory, "player.html"), "player"),
    writeFile(path.join(bundleDirectory, "bundle.any-hash.js"), '"himu-image-fallback"'),
    writeFile(path.join(fontDirectory, "Manrope-Regular.opaque-hash.ttf"), "regular"),
    writeFile(path.join(fontDirectory, "Manrope-SemiBold.opaque-hash.ttf"), "semibold"),
    writeFile(path.join(fontDirectory, "Manrope-Bold.opaque-hash.ttf"), "bold"),
  ]);

  return exportDirectory;
}

function runChecker(exportDirectory: string) {
  return execFile(process.execPath, ["--import", "tsx", checkerPath, exportDirectory], {
    cwd: projectRoot,
  });
}

async function main() {
  const exportDirectory = await createFixture();

  try {
    await runChecker(exportDirectory);

    await unlink(
      path.join(exportDirectory, "assets", "fonts", "Manrope", "Manrope-SemiBold.opaque-hash.ttf"),
    );

    await assert.rejects(runChecker(exportDirectory));
  } finally {
    await rm(exportDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
