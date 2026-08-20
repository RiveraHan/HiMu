import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir).find((name) =>
  name.endsWith("_creative_generation_briefs.sql"),
);
assert.ok(migrationName, "creative generation migration is missing");
const sql = readFileSync(join(migrationsDir, migrationName), "utf8");

function requires(pattern: RegExp, message: string) {
  assert.match(sql, pattern, message);
}

requires(/alter table public\.djs[\s\S]*identity_concept\s+text/i, "DJ identity concept column");
requires(/alter table public\.generation_jobs[\s\S]*generation_brief\s+jsonb/i, "job brief column");
requires(/generation_jobs[\s\S]*source_track_id\s+uuid[\s\S]*references public\.tracks\s*\(id\)[\s\S]*on delete set null/i, "job source lineage FK");
requires(/alter table public\.tracks[\s\S]*source_track_id\s+uuid[\s\S]*references public\.tracks\s*\(id\)[\s\S]*on delete set null/i, "track source lineage FK");

requires(/create table public\.track_private_details/i, "private lyric table");
requires(/track_id\s+uuid\s+primary key[\s\S]*references public\.tracks\s*\(id\)\s+on delete cascade/i, "private lyric track FK");
requires(/confirmed_lyrics\s+text\s+not null[\s\S]*char_length\(confirmed_lyrics\)\s+between\s+1\s+and\s+1000/i, "bounded private lyrics");
requires(/alter table public\.track_private_details enable row level security/i, "private lyric RLS");
requires(/create policy[\s\S]*track_private_details[\s\S]*for select\s+to authenticated[\s\S]*owner_id\s*=\s*\(select auth\.uid\(\)\)/i, "owner-only lyric policy");
requires(/revoke all on table public\.track_private_details from anon/i, "anonymous lyric grants revoked");
requires(/grant select on table public\.track_private_details to authenticated/i, "authenticated lyric read grant bounded by RLS");
assert.doesNotMatch(sql, /create\s+(?:or replace\s+)?view[\s\S]*lyrics/i, "migration must not create a public lyric view");

requires(/create table public\.creative_draft_events/i, "draft rate-limit events");
requires(/alter table public\.creative_draft_events enable row level security/i, "draft events RLS");
requires(/create index[\s\S]*creative_draft_events[\s\S]*\(user_id, created_at desc\)/i, "bounded rate lookup index");
requires(/revoke all on table public\.creative_draft_events from anon, authenticated/i, "draft events inaccessible to clients");
requires(/grant (?:select, insert, delete|all) on table public\.creative_draft_events to service_role/i, "service role draft event access");

requires(/drop function if exists public\.reserve_manual_generation_job\(uuid, uuid, text, boolean\)/i, "superseded reservation removed");
requires(/create function public\.reserve_manual_generation_job\([\s\S]*p_generation_brief jsonb[\s\S]*p_is_public boolean[\s\S]*p_source_track_id uuid/i, "versioned reservation signature");
requires(/insert into public\.generation_jobs[\s\S]*generation_brief[\s\S]*source_track_id/i, "reservation stores brief and lineage");
requires(/if found then[\s\S]*return query[\s\S]*'existing'/i, "active jobs return without overwrite");
assert.doesNotMatch(sql, /update public\.generation_jobs[\s\S]{0,800}?set[\s\S]{0,800}?generation_brief\s*=/i, "active accepted briefs stay immutable");
requires(/revoke all on function public\.reserve_manual_generation_job\(uuid, uuid, jsonb, boolean, uuid\)[\s\S]*from public, anon, authenticated/i, "reservation is service-only");
requires(/create function public\.retry_legacy_manual_generation_job\([\s\S]*p_job_id uuid[\s\S]*generation_brief is null[\s\S]*status = 'failed'/i, "legacy retry reads only the requested failed pre-brief job");
requires(/create function public\.retry_legacy_manual_generation_job\([\s\S]*generation_quota_usage\(p_user_id, v_now\)[\s\S]*insert into public\.generation_jobs/i, "legacy retry enforces shared quota and creates a distinct job");
assert.doesNotMatch(sql, /create function public\.retry_legacy_manual_generation_job\([\s\S]{0,2500}?update public\.generation_jobs[\s\S]{0,500}?where gj\.id = p_job_id/i, "legacy retry never reuses the failed job id");
requires(/revoke all on function public\.retry_legacy_manual_generation_job\(uuid, uuid, uuid\)[\s\S]*from public, anon, authenticated/i, "legacy retry is service-only");

requires(/create (?:or replace )?function public\.finalize_generated_mix/i, "finalization function");
requires(/gj\.source_track_id/i, "finalization copies source lineage");
requires(/insert into public\.track_private_details/i, "finalization stores owner-private lyrics atomically");
requires(/gj\.generation_brief\s*->>\s*'lyrics'/i, "finalization copies accepted lyrics");
requires(/gj\.status\s*=\s*'generating'[\s\S]*gj\.updated_at\s*=\s*p_started_at/i, "attempt fencing remains in finalization");

console.log(`creative generation migration checks passed (${migrationName})`);
