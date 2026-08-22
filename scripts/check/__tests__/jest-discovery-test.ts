/** @jest-environment node */
import path from "node:path";
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
