import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const names = readdirSync(resolve("supabase/migrations"))
  .filter((name) => name.endsWith("_himu_experience_state.sql"));
assert.equal(names.length, 1, "expected one experience-state migration");
const sql = readFileSync(resolve("supabase/migrations", names[0]), "utf8");
assert.match(sql, /create table public\.user_experience_state/i);
assert.match(sql, /alter table public\.user_experience_state enable row level security/i);
assert.match(sql, /for select to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
assert.match(sql, /revoke all on table public\.user_experience_state from public, anon, authenticated/i);
assert.match(sql, /grant select on table public\.user_experience_state to authenticated/i);
assert.match(sql, /transition_user_experience/i);
assert.match(sql, /grant execute on function public\.transition_user_experience[\s\S]*to service_role/i);
assert.match(sql, /capture_first_owned_track_ready/i);
assert.match(sql, /after update of status, track_id on public\.generation_jobs/i);
assert.doesNotMatch(sql, /alter table public\.user_onboarding/i);
