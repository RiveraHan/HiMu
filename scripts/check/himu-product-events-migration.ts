import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const names = readdirSync(resolve("supabase/migrations"))
  .filter((name) => name.endsWith("_himu_product_events.sql"));
assert.equal(names.length, 1, "expected one product-events migration");

const sql = readFileSync(resolve("supabase/migrations", names[0]!), "utf8");
assert.match(sql, /create table public\.product_events/i);
assert.match(sql, /event_id uuid primary key/i);
assert.match(sql, /user_id uuid references auth\.users\s*\(\s*id\s*\) on delete set null/i);
assert.match(sql, /check\s*\(\s*pg_column_size\s*\(\s*properties\s*\)\s*<=\s*4096\s*\)/i);
assert.match(sql, /alter table public\.product_events enable row level security/i);
assert.match(sql, /revoke all on table public\.product_events from public, anon, authenticated/i);
assert.match(sql, /grant all on table public\.product_events to service_role/i);
assert.match(sql, /create function public\.record_product_event/i);
assert.match(sql, /security invoker[\s\S]*set search_path\s*=\s*''/i);
assert.match(sql, /pg_advisory_xact_lock\s*\([\s\S]*hashtext\s*\(\s*p_installation_id::text\s*\)/i);
assert.match(sql, /created_at\s*>=\s*[\s\S]*interval\s*'1 minute'/i);
assert.match(sql, /\)\s*>=\s*60\s+then/i);
assert.match(sql, /return\s+'duplicate'/i);
assert.match(sql, /return\s+'rate_limited'/i);
assert.match(sql, /return\s+'accepted'/i);
assert.match(sql, /revoke all on function public\.record_product_event[\s\S]*from public, anon, authenticated/i);
assert.match(sql, /grant execute on function public\.record_product_event[\s\S]*to service_role/i);

console.log("product events migration checks passed");
