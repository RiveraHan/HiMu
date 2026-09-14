import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20260909143000_restrict_raw_public_tracks.sql",
  "utf8",
);

assert.match(
  sql,
  /revoke select on table public\.tracks from public, anon/i,
  "the raw tracks table must not inherit an anonymous SELECT grant",
);
assert.match(
  sql,
  /grant select on table public\.tracks to authenticated, service_role/i,
  "owner clients and the server boundary need explicit read grants",
);
assert.match(
  sql,
  /create policy "tracks_select_owned_or_catalog"[\s\S]*for select[\s\S]*to authenticated[\s\S]*owner_id\s*=\s*\(select auth\.uid\(\)\)[\s\S]*owner_id is null/i,
  "raw tracks must be limited to their owner or signed-in catalogue flows",
);
assert.doesNotMatch(
  sql,
  /is_public/i,
  "raw tracks must not be reopened merely because a Moment is public",
);

console.log("public tracks RLS boundary checks passed");
