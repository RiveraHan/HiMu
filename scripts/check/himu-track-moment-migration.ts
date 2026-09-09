import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrations = readdirSync("supabase/migrations")
  .filter((name) => /_himu_track_moment(?:_(?:cleanup_outbox|unpublish_cleanup))?\.sql$/.test(name));
assert.equal(migrations.length, 3, "base, cleanup, and unpublish safety Moment migrations are required");
const migrationSql = Object.fromEntries(migrations.map((name) => [
  name,
  readFileSync(join("supabase/migrations", name), "utf8"),
]));
const sql = Object.values(migrationSql).join("\n");
const cleanupSql = Object.entries(migrationSql).find(([name]) =>
  name.endsWith("_himu_track_moment_cleanup_outbox.sql")
)?.[1];
const unpublishCleanupSql = Object.entries(migrationSql).find(([name]) =>
  name.endsWith("_himu_track_moment_unpublish_cleanup.sql")
 )?.[1];
assert.ok(cleanupSql, "cleanup outbox migration is required");
assert.ok(unpublishCleanupSql, "unpublish cleanup safety migration is required");

for (const pattern of [
  /create table public\.track_experience_feedback/i,
  /primary key \(user_id, track_id\)/i,
  /surprised boolean/i,
  /would_share boolean/i,
  /surprised is not null or would_share is not null/i,
  /user_id uuid not null references auth\.users\(id\) on delete cascade/i,
  /track_id uuid not null references public\.tracks\(id\) on delete cascade/i,
  /feedback_identity_immutable/i,
  /alter table public\.track_experience_feedback enable row level security/i,
  /for select\s+to authenticated\s+using\s*\([\s\S]*auth\.uid\(\)[\s\S]*track\.owner_id/i,
  /for insert\s+to authenticated\s+with check\s*\([\s\S]*auth\.uid\(\)[\s\S]*track\.owner_id/i,
  /for update\s+to authenticated\s+using\s*\([\s\S]*auth\.uid\(\)[\s\S]*track\.owner_id[\s\S]*with check\s*\([\s\S]*auth\.uid\(\)[\s\S]*track\.owner_id/i,
  /revoke all on table public\.track_experience_feedback from public/i,
  /grant select, insert, update on table public\.track_experience_feedback\s+to authenticated/i,
  /create table public\.track_moment_publications/i,
  /alter table public\.track_moment_publications enable row level security/i,
  /revoke all on table public\.track_moment_publications from anon, authenticated/i,
  /create function public\.claim_track_moment_publish/i,
  /create function public\.finalize_track_moment_publish/i,
  /create function public\.abort_track_moment_publish/i,
  /create function public\.unpublish_track_moment/i,
  /grant execute on function public\.claim_track_moment_publish[\s\S]*to service_role/i,
  /create table public\.track_moment_cleanup_outbox/i,
  /alter table public\.track_moment_cleanup_outbox enable row level security/i,
  /revoke all on table public\.track_moment_cleanup_outbox from anon, authenticated/i,
  /create (?:or replace )?function public\.queue_track_moment_cleanup/i,
  /create function public\.list_track_moment_cleanup/i,
  /create function public\.acknowledge_track_moment_cleanup/i,
  /create or replace function public\.abort_track_moment_publish/i,
  /create or replace function public\.unpublish_track_moment/i,
  /on conflict \(track_id, operation_token\) do nothing/i,
  /grant execute on function public\.queue_track_moment_cleanup[\s\S]*to service_role/i,
]) {
  assert.match(sql, pattern);
}

assert.doesNotMatch(sql, /grant[^;]*track_experience_feedback[^;]*to anon/i);
assert.doesNotMatch(sql, /security definer[\s\S]*grant execute[^;]*to (?:public|anon|authenticated)/i);
assert.doesNotMatch(
  cleanupSql,
  /grant[^;]*track_moment_cleanup_outbox[^;]*to (?:anon|authenticated)/i,
  "cleanup outbox must remain server-only",
);
assert.match(
  unpublishCleanupSql,
  /v_operation_public_key := pg_catalog\.regexp_replace[\s\S]*\.moment-' \|\| v_publication\.operation_token::text/i,
  "cancelling a claim must derive only its operation-owned public key",
);
assert.match(
  unpublishCleanupSql,
  /insert into public\.track_moment_cleanup_outbox[\s\S]*v_operation_public_key[\s\S]*on conflict \(track_id, operation_token\) do nothing/i,
  "cancelling a claim must durably enqueue cleanup before clearing it",
);
assert.match(
  unpublishCleanupSql,
  /v_existing_cleanup_key is distinct from v_operation_public_key[\s\S]*'conflict'/i,
  "a mismatched reused token must not erase its cleanup target",
);
assert.match(
  unpublishCleanupSql,
  /v_track\.is_public[\s\S]*state = 'publishing'[\s\S]*insert into public\.track_moment_cleanup_outbox/i,
  "only a still-private publishing claim can become cleanup",
);
assert.equal(
  unpublishCleanupSql.split(String.raw`\.mp3`).length - 1,
  4,
  "unpublish cleanup must use the canonical single-backslash .mp3 regexp in every media boundary",
);
assert.equal(
  unpublishCleanupSql.split(String.raw`\\.mp3`).length - 1,
  0,
  "unpublish cleanup must not use the double-backslash .mp3 regexp that rejects ordinary private keys",
);
console.log("track moment migration checks passed");
