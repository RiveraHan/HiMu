import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const migrationsDirectory = resolve("supabase/migrations");
const migrationNames = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith("_security_findings_remediation.sql"))
  .sort();

assert.equal(
  migrationNames.length,
  1,
  "expected exactly one generated security findings remediation migration",
);

const sql = readFileSync(resolve(migrationsDirectory, migrationNames[0]), "utf8");
const requires = (pattern: RegExp, label: string) =>
  assert.match(sql, pattern, label);

requires(/create table public\.provider_usage_events/i, "durable ledger exists");
requires(
  /unique\s*\(user_id, quota_bucket, idempotency_key\)/i,
  "idempotency is durable",
);
requires(
  /references auth\.users\s*\(id\) on delete cascade/i,
  "only account lifecycle cascades usage",
);
assert.doesNotMatch(
  sql,
  /provider_usage_events[\s\S]*references public\.(djs|tracks|generation_jobs|cover_regens|avatar_regens)/i,
  "usage events must outlive content rows",
);
requires(
  /create (or replace )?function public\.reserve_provider_usage_event/i,
  "shared reservation exists",
);
requires(/pg_advisory_xact_lock/i, "reservations serialize");
requires(
  /revoke all on table public\.provider_usage_events from public, anon, authenticated/i,
  "ledger is private",
);
requires(
  /grant all on table public\.provider_usage_events to service_role/i,
  "service role owns ledger access",
);
requires(
  /insert into public\.provider_usage_events[\s\S]*generation_jobs/i,
  "history is backfilled",
);

console.log(`security remediation migration checks passed (${migrationNames[0]})`);
