type TestCase = { name: string; run: () => void | Promise<void> };
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync } from "node:fs";

type StrictR2Delete = (keys: string[], access: "public" | "private") => Promise<void>;
const R2_TEST_ENV: Record<string, string> = {
  CLOUDFLARE_ACCOUNT_ID: "contract-account",
  R2_BUCKET: "contract-public",
  R2_PRIVATE_BUCKET: "contract-private",
  R2_ACCESS_KEY_ID: "contract-key",
  R2_SECRET_ACCESS_KEY: "contract-secret",
  R2_PUBLIC_BASE: "https://media.example",
};

async function loadStrictR2Delete(): Promise<StrictR2Delete> {
  const bundle = await build({
    entryPoints: ["supabase/functions/_shared/r2.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    alias: { "npm:aws4fetch": "aws4fetch" },
  });
  const source = bundle.outputFiles[0]?.text;
  if (!source) throw new Error("unable to bundle strict R2 delete for its contract test");
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`,
  ) as { r2DeleteStrict?: StrictR2Delete };
  if (typeof module.r2DeleteStrict !== "function") {
    throw new Error("strict R2 delete export unavailable");
  }
  return module.r2DeleteStrict;
}

async function main() {
  const tests: TestCase[] = [];
  Object.defineProperty(globalThis, "Deno", {
    configurable: true,
    value: {
      test(name: string, run: () => void | Promise<void>) {
        tests.push({ name, run });
      },
      env: { get: (key: string) => process.env[key] ?? R2_TEST_ENV[key] ?? "" },
    },
  });
  Object.defineProperty(globalThis, "__himuTrackMomentStrictR2Delete", {
    configurable: true,
    value: await loadStrictR2Delete(),
  });
  try {
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
  } finally {
    delete (globalThis as typeof globalThis & {
      __himuTrackMomentStrictR2Delete?: StrictR2Delete;
    }).__himuTrackMomentStrictR2Delete;
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
