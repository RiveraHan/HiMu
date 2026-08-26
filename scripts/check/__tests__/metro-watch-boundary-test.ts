import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

function isBlocked(path: string): boolean {
  const output = execFileSync(
    process.execPath,
    [
      "-e",
      `
        const config = require(process.env.METRO_CONFIG_PATH);
        const patterns = Array.isArray(config.resolver.blockList)
          ? config.resolver.blockList
          : [config.resolver.blockList];
        const blocked = patterns.filter(Boolean).some((pattern) => {
          pattern.lastIndex = 0;
          return pattern.test(process.env.METRO_TARGET_PATH);
        });
        process.stdout.write(String(blocked));
      `,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        METRO_CONFIG_PATH: resolve(process.cwd(), "metro.config.js"),
        METRO_TARGET_PATH: path,
      },
    },
  );

  return output === "true";
}

describe("Metro watch boundaries", () => {
  it("excludes repository worktrees from Metro's file map", () => {
    expect(
      isBlocked(
        resolve(process.cwd(), ".worktrees/creative-generation/node_modules/react/index.js"),
      ),
    ).toBe(true);
  });

  it("excludes generated Android build output from Metro's file map", () => {
    expect(
      isBlocked(
        resolve(process.cwd(), "android/app/build/intermediates/merged_manifests/debug/AndroidManifest.xml"),
      ),
    ).toBe(true);
  });

  it("keeps Android application source visible to Metro", () => {
    expect(
      isBlocked(
        resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
      ),
    ).toBe(false);
  });
});
