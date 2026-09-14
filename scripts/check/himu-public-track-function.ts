import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type TestCase = { name: string; run: () => void | Promise<void> };

async function main() {
  const tests: TestCase[] = [];
  Object.defineProperty(globalThis, "Deno", {
    configurable: true,
    value: {
      test(name: string, run: () => void | Promise<void>) {
        tests.push({ name, run });
      },
    },
  });
  await import("../../supabase/functions/public-track/handler-test.ts");
  assert.ok(tests.length >= 5, "expected complete public-track handler matrix");
  for (const test of tests) {
    try {
      await test.run();
    } catch (error) {
      throw new Error(`public-track handler check failed: ${test.name}`, {
        cause: error,
      });
    }
  }

  const config = readFileSync("supabase/config.toml", "utf8");
  assert.match(
    config,
    /\[functions\.public-track\]\s*verify_jwt\s*=\s*false/,
    "public-track must be reachable without a user JWT",
  );
  const index = readFileSync("supabase/functions/public-track/index.ts", "utf8");
  assert.match(index, /handlePublicTrackHttpRequest/);
  assert.doesNotMatch(index, /serveAuthed|getUser\s*\(/);
  assert.match(
    index,
    /Cache-Control["']?\s*,\s*["']no-store["']/,
    "public-track responses must not outlive an unpublish action",
  );
  console.log(`public track function checks passed (${tests.length} cases)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
