type TestCase = { name: string; run: () => void | Promise<void> };
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  await import("../../supabase/functions/track-moment/handler-test.ts");
  if (tests.length < 8) throw new Error("expected complete handler matrix");
  for (const test of tests) {
    try {
      await test.run();
    } catch (error) {
      throw new Error(`track Moment handler check failed: ${test.name}`, {
        cause: error,
      });
    }
  }
  const config = readFileSync("supabase/config.toml", "utf8");
  assert.match(
    config,
    /\[functions\.track-moment\]\s*verify_jwt\s*=\s*true/,
    "track-moment must retain platform JWT verification",
  );
  const index = readFileSync("supabase/functions/track-moment/index.ts", "utf8");
  assert.match(index, /serveAuthed\s*\(/, "entrypoint must authenticate a real user");
  const r2 = readFileSync("supabase/functions/_shared/r2.ts", "utf8");
  assert.doesNotMatch(r2, /private-media-runner/, "Edge code must not import a migration runner");
  assert.match(
    r2,
    /export async function r2DeleteStrict[\s\S]*await Promise\.all[\s\S]*if \(!res\.ok && res\.status !== 404\) res = await del\(key\)[\s\S]*throw new Error\(`R2 DELETE/,
    "Moment cleanup must report a bounded R2 delete failure",
  );
  console.log(`track moment function checks passed (${tests.length} cases)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
