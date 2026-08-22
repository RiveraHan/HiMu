/** @jest-environment node */
import path from "node:path";
import { readFileSync } from "node:fs";
import { runCLI } from "@jest/core";

const projectRoot = path.resolve(__dirname, "../../..");

async function normalJestDiscovery() {
  let output = "";
  const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });

  try {
    await runCLI({ listTests: true, runInBand: true, silent: true }, [projectRoot]);
  } finally {
    write.mockRestore();
  }

  return output
    .trim()
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .map((file) => path.relative(projectRoot, file));
}

describe("normal Jest discovery", () => {
  it("excludes nested worktrees from both test discovery and the haste module map", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(projectRoot, "package.json"), "utf8"),
    );

    expect(packageJson.jest.testPathIgnorePatterns).toContain(
      "<rootDir>/.worktrees/",
    );
    expect(packageJson.jest.modulePathIgnorePatterns).toContain(
      "<rootDir>/.worktrees/",
    );
  });

  it("excludes explicit Chrome QA launchers and their browser-only support", async () => {
    const discovered = await normalJestDiscovery();
    const browserQaEntries = discovered.filter(
      (file) =>
        file.includes("/__tests__/browser/") ||
        file === "src/components/forms/__tests__/ResponsiveFormShell-web-test.ts" ||
        file === "app/__tests__/create-dj-responsive-browser-test.ts" ||
        file === "app/__tests__/create-track-responsive-browser-test.ts",
    );

    expect(browserQaEntries).toEqual([]);
  });
});
