import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith("_himu_track_moment.sql"));
assert.equal(migrations.length, 1, "one track Moment migration is required");
const sql = readFileSync(join("supabase/migrations", migrations[0]!), "utf8");

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
]) {
  assert.match(sql, pattern);
}

assert.doesNotMatch(sql, /grant[^;]*track_experience_feedback[^;]*to anon/i);
assert.doesNotMatch(sql, /security definer[\s\S]*grant execute[^;]*to (?:public|anon|authenticated)/i);
console.log("track moment migration checks passed");
