import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(
  "supabase/migrations/20260824120000_generation_brief_v2.sql",
);
const sql = readFileSync(path, "utf8");

function requires(pattern: RegExp, label: string): void {
  assert.match(sql, pattern, label);
}

requires(
  /create or replace function public\.reserve_manual_generation_job\(\s*p_user_id uuid,\s*p_dj_id uuid,\s*p_generation_brief jsonb,\s*p_is_public boolean,\s*p_source_track_id uuid\s*\)/i,
  "keeps the versioned reservation signature",
);
requires(/security invoker/i, "keeps security invoker");
requires(/set search_path\s*=\s*''/i, "keeps an empty search path");
requires(
  /p_generation_brief->>'version'\s+not in\s*\(\s*'1'\s*,\s*'2'\s*\)/i,
  "accepts only Brief V1 or V2",
);
requires(/pg_advisory_xact_lock/i, "keeps quota serialization");
requires(/reserve_provider_usage_event/i, "keeps provider usage reservation");
requires(
  /if found then[\s\S]*return query select[\s\S]*v_job_brief[\s\S]*return;/i,
  "returns an active persisted brief without replacement",
);
requires(
  /insert into public\.generation_jobs[\s\S]*generation_brief[\s\S]*p_generation_brief/i,
  "persists the accepted brief on new jobs",
);
assert.doesNotMatch(
  sql,
  /update public\.generation_jobs[\s\S]{0,800}?set[\s\S]{0,800}?generation_brief\s*=/i,
  "never mutates an accepted active brief",
);
requires(
  /revoke all on function public\.reserve_manual_generation_job\([\s\S]*from public, anon, authenticated/i,
  "keeps client roles revoked",
);
requires(
  /grant execute on function public\.reserve_manual_generation_job\([\s\S]*to service_role/i,
  "keeps service role execution",
);

console.log("generation brief V2 migration checks passed");
