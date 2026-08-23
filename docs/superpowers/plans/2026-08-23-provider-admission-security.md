# Provider Admission and Tenant Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close findings 1, 2, 3, and 5 by making every paid provider admission durable and atomic and by limiting creative-draft model context to caller-visible DJ names.

**Architecture:** PostgreSQL owns provider admission through an append-only `provider_usage_events` ledger and service-only reservation RPCs protected by per-user/per-bucket advisory locks. Existing Edge Functions retain their stable responses but consume atomic reservation outcomes; Daily Drop keeps its local date only as job metadata. Creative-draft context is visibility-filtered and the same exclusions are used in deterministic output parsing.

**Tech Stack:** PostgreSQL 17 migrations and PL/pgSQL, Supabase Edge Functions/Deno TypeScript, Node `tsx` contract checks, Supabase JS integration checks, Jest where client behavior is involved.

**Spec:** `docs/superpowers/specs/2026-08-23-security-findings-remediation-design.md`

## Global Constraints

- Preserve the existing combined manual-mix/cover limit of 3 per rolling 24 hours.
- Enforce one Daily Drop provider reservation per rolling 24 hours; `dropDate` remains presentation metadata and never an admission partition.
- Enforce 3 avatar provider reservations per rolling 24 hours, including initial DJ portraits.
- Enforce 30 creative drafts per rolling hour.
- Durable events may cascade only from `auth.users`; they must not reference DJs, tracks, jobs, or regeneration rows through foreign keys.
- Only `service_role` may execute reservation RPCs or access the ledger.
- Provider failures retain their reservation; idempotent operational retries reuse it.
- Existing ownership, visibility, active-job, lease, recovery, and stable error-code behavior remains intact.
- Every production behavior change follows RED, GREEN, then refactor.

---

### Task 1: Migration Contract for the Durable Ledger

**Files:**
- Create: `scripts/check/security-remediation-migration.ts`
- Modify: `package.json`
- Create after RED: `supabase/migrations/20260823090000_security_findings_remediation.sql`

**Interfaces:**
- Consumes: the ordered migration directory under `supabase/migrations`.
- Produces: `npm run check:security-remediation-migration`, a static contract gate for the final migration.

- [ ] **Step 1: Write the failing migration contract**

Create a check that resolves `20260823090000_security_findings_remediation.sql`, reads it as UTF-8, and asserts the required security primitives:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(
  "supabase/migrations/20260823090000_security_findings_remediation.sql",
);
const sql = readFileSync(path, "utf8");
const requires = (pattern: RegExp, label: string) =>
  assert.match(sql, pattern, label);

requires(/create table public\.provider_usage_events/i, "durable ledger exists");
requires(/unique\s*\(user_id, quota_bucket, idempotency_key\)/i, "idempotency is durable");
requires(/references auth\.users\s*\(id\) on delete cascade/i, "only account lifecycle cascades usage");
assert.doesNotMatch(sql, /provider_usage_events[\s\S]*references public\.(djs|tracks|generation_jobs|cover_regens|avatar_regens)/i);
requires(/create (or replace )?function public\.reserve_provider_usage_event/i, "shared reservation exists");
requires(/pg_advisory_xact_lock/i, "reservations serialize");
requires(/create (or replace )?function public\.reserve_daily_generation_job/i, "daily drop is atomic");
requires(/create (or replace )?function public\.reserve_avatar_generation/i, "avatar is atomic");
requires(/create (or replace )?function public\.reserve_creative_draft/i, "draft is atomic");
requires(/revoke all on table public\.provider_usage_events from public, anon, authenticated/i, "ledger is private");
requires(/grant all on table public\.provider_usage_events to service_role/i, "service role owns ledger access");
requires(/insert into public\.provider_usage_events[\s\S]*generation_jobs/i, "history is backfilled");

console.log("security remediation migration checks passed");
```

Add the package script:

```json
"check:security-remediation-migration": "node --import tsx scripts/check/security-remediation-migration.ts"
```

- [ ] **Step 2: Run the contract to verify RED**

Run: `npm run check:security-remediation-migration`

Expected: FAIL with `ENOENT` for `20260823090000_security_findings_remediation.sql`.

- [ ] **Step 3: Create the migration shell and ledger schema**

Create the migration with the complete table boundary:

```sql
create table public.provider_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quota_bucket text not null check (
    quota_bucket in ('generation', 'daily_drop', 'avatar', 'creative_draft')
  ),
  operation text not null check (
    operation in (
      'manual_mix', 'cover', 'daily_drop',
      'initial_avatar', 'avatar_regen', 'creative_draft'
    )
  ),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  resource_id uuid,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (user_id, quota_bucket, idempotency_key)
);

create index provider_usage_events_user_bucket_created_idx
  on public.provider_usage_events (user_id, quota_bucket, created_at desc);

alter table public.provider_usage_events enable row level security;
revoke all on table public.provider_usage_events from public, anon, authenticated;
grant all on table public.provider_usage_events to service_role;
```

- [ ] **Step 4: Add the shared atomic reservation primitive**

Define a service-only function returning `outcome`, `event_id`, `daily_limit`, and `resource_id`. Validate bucket-specific limits inside the function rather than trusting arbitrary caller limits:

```sql
create function public.reserve_provider_usage_event(
  p_user_id uuid,
  p_quota_bucket text,
  p_operation text,
  p_idempotency_key text,
  p_resource_id uuid default null
)
returns table (outcome text, event_id uuid, daily_limit integer, resource_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_limit integer;
  v_window interval;
  v_event_id uuid;
  v_resource_id uuid;
begin
  select limits.limit_value, limits.window_value
  into v_limit, v_window
  from (values
    ('generation'::text, 3, interval '24 hours'),
    ('daily_drop'::text, 1, interval '24 hours'),
    ('avatar'::text, 3, interval '24 hours'),
    ('creative_draft'::text, 30, interval '1 hour')
  ) as limits(bucket, limit_value, window_value)
  where limits.bucket = p_quota_bucket;

  if v_limit is null or nullif(btrim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'invalid_provider_usage_reservation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext(p_quota_bucket)
  );

  select e.id, e.resource_id into v_event_id, v_resource_id
  from public.provider_usage_events as e
  where e.user_id = p_user_id
    and e.quota_bucket = p_quota_bucket
    and e.idempotency_key = p_idempotency_key;

  if found then
    return query select 'existing'::text, v_event_id, v_limit, v_resource_id;
    return;
  end if;

  if (select count(*) from public.provider_usage_events as e
      where e.user_id = p_user_id
        and e.quota_bucket = p_quota_bucket
        and e.created_at > v_now - v_window) >= v_limit then
    return query select 'quota'::text, null::uuid, v_limit, null::uuid;
    return;
  end if;

  insert into public.provider_usage_events (
    user_id, quota_bucket, operation, idempotency_key, resource_id, created_at
  ) values (
    p_user_id, p_quota_bucket, p_operation, p_idempotency_key, p_resource_id, v_now
  ) returning id into v_event_id;

  return query select 'created'::text, v_event_id, v_limit, p_resource_id;
end;
$$;

revoke all on function public.reserve_provider_usage_event(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_provider_usage_event(uuid, text, text, text, uuid)
  to service_role;
```

Add an explicit operation/bucket compatibility check before locking so `cover` cannot reserve the avatar bucket and `creative_draft` cannot reserve generation.

- [ ] **Step 5: Add historical backfill**

Insert stable events with `on conflict do nothing` for manual jobs, dated jobs, cover regenerations, avatar regenerations, and creative draft events. Use each source row's original timestamp and never add content foreign keys:

```sql
insert into public.provider_usage_events (
  user_id, quota_bucket, operation, idempotency_key, resource_id, created_at
)
select gj.user_id, 'generation', 'manual_mix', 'mix:' || gj.id, gj.id, gj.created_at
from public.generation_jobs as gj
where gj.drop_date is null
on conflict do nothing;

insert into public.provider_usage_events (
  user_id, quota_bucket, operation, idempotency_key, resource_id, created_at
)
select gj.user_id, 'daily_drop', 'daily_drop', 'drop:' || gj.id, gj.id, gj.created_at
from public.generation_jobs as gj
where gj.drop_date is not null
on conflict do nothing;
```

Add equivalent statements for `cover_regens`, `avatar_regens`, and `creative_draft_events` using `cover:`, `avatar:`, and `draft:` prefixes.

- [ ] **Step 6: Run the migration contract to verify the first GREEN boundary**

Run: `npm run check:security-remediation-migration`

Expected: PASS.

- [ ] **Step 7: Commit the ledger boundary**

```bash
git add package.json scripts/check/security-remediation-migration.ts supabase/migrations/20260823090000_security_findings_remediation.sql
git commit -m "fix: add durable provider usage ledger"
```

### Task 2: Generation and Daily Drop Reservation RPCs

**Files:**
- Modify: `scripts/check/security-remediation-migration.ts`
- Modify: `supabase/migrations/20260823090000_security_findings_remediation.sql`
- Create: `scripts/check/security-quota-invariants.ts`

**Interfaces:**
- Consumes: `reserve_provider_usage_event(uuid,text,text,text,uuid)`.
- Produces: durable `generation_quota_usage`, updated manual/cover/legacy RPCs, and `reserve_daily_generation_job(uuid,uuid,date)`.

- [ ] **Step 1: Extend the contract with failing assertions**

Require `generation_quota_usage` to count `provider_usage_events`, require each generation RPC to call the shared primitive, and require the daily RPC to insert the job and usage event in one function body.

```ts
requires(/generation_quota_usage[\s\S]*from public\.provider_usage_events[\s\S]*quota_bucket = 'generation'/i, "generation usage is durable");
requires(/reserve_manual_generation_job[\s\S]*reserve_provider_usage_event[\s\S]*'manual_mix'/i, "manual reservations use ledger");
requires(/retry_legacy_manual_generation_job[\s\S]*reserve_provider_usage_event[\s\S]*'manual_mix'/i, "legacy retries use ledger");
requires(/reserve_cover_generation[\s\S]*reserve_provider_usage_event[\s\S]*'cover'/i, "cover reservations use ledger");
requires(/reserve_daily_generation_job[\s\S]*'daily_drop'[\s\S]*insert into public\.generation_jobs/i, "daily jobs reserve atomically");
```

- [ ] **Step 2: Run the contract to verify RED**

Run: `npm run check:security-remediation-migration`

Expected: FAIL at `generation usage is durable`.

- [ ] **Step 3: Replace generation quota usage**

Return the count of `quota_bucket = 'generation'` events in the rolling 24-hour server window. Preserve the existing signature and grants:

```sql
create or replace function public.generation_quota_usage(
  p_user_id uuid,
  p_at timestamptz default pg_catalog.clock_timestamp()
)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.provider_usage_events as e
  where e.user_id = p_user_id
    and e.quota_bucket = 'generation'
    and e.created_at > p_at - interval '24 hours'
$$;
```

- [ ] **Step 4: Update manual, legacy retry, and cover RPCs**

In each RPC, generate the operational UUID before inserting, call the shared reservation with that UUID as both idempotency key suffix and resource ID, return quota before the operational insert, and rely on transaction rollback if the insert fails:

```sql
v_job_id := gen_random_uuid();
select r.outcome into v_usage_outcome
from public.reserve_provider_usage_event(
  p_user_id,
  'generation',
  'manual_mix',
  'mix:' || v_job_id,
  v_job_id
) as r;
if v_usage_outcome = 'quota' then
  return query select 'quota'::text, null::uuid, v_limit, null::timestamptz,
    null::boolean, null::jsonb, null::uuid;
  return;
end if;
```

Insert `id = v_job_id` explicitly. Apply the same pattern to a fresh legacy retry job and a fresh cover reservation (`cover:<reservation_id>`). Existing active jobs return before creating another usage event.

- [ ] **Step 5: Add `reserve_daily_generation_job`**

The function validates the date, locks the daily bucket through the shared primitive, returns a still-existing recent job across any submitted date, and fails closed if durable usage exists but its job was deleted:

```sql
create function public.reserve_daily_generation_job(
  p_user_id uuid,
  p_dj_id uuid,
  p_drop_date date
)
returns table (
  outcome text, job_id uuid, daily_limit integer, queued_at timestamptz,
  status text, updated_at timestamptz, dj_id uuid, is_public boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_job_id uuid;
  v_usage_outcome text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext('daily_drop')
  );

  return query
  select 'existing', gj.id, 1, gj.created_at, gj.status, gj.updated_at,
    gj.dj_id, gj.is_public
  from public.provider_usage_events e
  join public.generation_jobs gj on gj.id = e.resource_id
  where e.user_id = p_user_id
    and e.quota_bucket = 'daily_drop'
    and e.created_at > v_now - interval '24 hours'
  order by e.created_at desc
  limit 1;
  if found then return; end if;

  if exists (
    select 1 from public.provider_usage_events e
    where e.user_id = p_user_id
      and e.quota_bucket = 'daily_drop'
      and e.created_at > v_now - interval '24 hours'
  ) then
    return query select 'quota', null::uuid, 1, null::timestamptz,
      null::text, null::timestamptz, null::uuid, null::boolean;
    return;
  end if;

  v_job_id := gen_random_uuid();
  select r.outcome into v_usage_outcome
  from public.reserve_provider_usage_event(
    p_user_id, 'daily_drop', 'daily_drop', 'drop:' || v_job_id, v_job_id
  ) r;
  if v_usage_outcome = 'quota' then
    return query select 'quota', null::uuid, 1, null::timestamptz,
      null::text, null::timestamptz, null::uuid, null::boolean;
    return;
  end if;

  insert into public.generation_jobs (
    id, user_id, dj_id, status, drop_date, is_public, created_at, updated_at
  ) values (
    v_job_id, p_user_id, p_dj_id, 'queued', p_drop_date, false, v_now, v_now
  );
  return query select 'created', v_job_id, 1, v_now, 'queued', v_now, p_dj_id, false;
end;
$$;
```

Revoke public/authenticated execution and grant only `service_role`.

- [ ] **Step 6: Run static contracts GREEN**

Run: `npm run check:security-remediation-migration && npm run check:creative-generation-migration`

Expected: both PASS.

- [ ] **Step 7: Commit generation RPCs**

```bash
git add scripts/check/security-remediation-migration.ts supabase/migrations/20260823090000_security_findings_remediation.sql
git commit -m "fix: reserve generation usage atomically"
```

### Task 3: Daily Drop Edge Orchestration

**Files:**
- Modify: `scripts/check/generation-orchestration.ts`
- Modify: `supabase/functions/generate-mix/generation-orchestration.ts`
- Modify: `supabase/functions/generate-mix/index.ts`
- Modify: `src/hooks/use-daily-drop.ts`
- Modify: `src/hooks/__tests__/use-daily-drop-test.tsx`

**Interfaces:**
- Consumes: `reserve_daily_generation_job` rows.
- Produces: `RequestDependencies.reserveDailyJob`, server-bounded Daily Drop admission, and stable client handling of `daily_quota_reached`.

- [ ] **Step 1: Write failing orchestration tests**

Add fixtures where `dropDate` values differ but `reserveDailyJob` returns the same recent job, and where it returns quota. Assert `createDailyJob` no longer exists, quota stops before `runGeneration`, and an existing job remains idempotent:

```ts
const result = await handleGenerateMixRequest(
  { djId: "system-dj", dropDate: "2099-12-31", language: "en", localHour: 12 },
  "user-1",
  dependencies({
    reserveDailyJob: async () => ({
      outcome: "quota", jobId: null, dailyLimit: 1,
    }),
  }),
);
assert.deepEqual(result, {
  status: 429,
  body: {
    error: "daily drop already reserved",
    code: "daily_quota_reached",
    dailyLimit: 1,
  },
});
assert.equal(calls.runGeneration.length, 0);
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node --import tsx scripts/check/generation-orchestration.ts`

Expected: TypeScript/runtime failure because `reserveDailyJob` is not part of the dependency contract.

- [ ] **Step 3: Replace daily lookup/create dependencies**

Define the exact reservation union:

```ts
type DailyJobReservation =
  | { outcome: "created" | "existing"; job: DailyJobSummary; dailyLimit: number }
  | { outcome: "quota"; job: null; dailyLimit: number };

reserveDailyJob: (input: {
  userId: string;
  djId: unknown;
  dropDate: string;
}) => Promise<DailyJobReservation>;
```

Validate the DJ and owner before reservation. For Drop mode, reserve once, map quota to 429, load the returned job's authoritative DJ config when it differs from the proposal, then preserve the existing active/requeue/run behavior by job ID.

- [ ] **Step 4: Wire the RPC in the Edge Function**

Map the RPC row defensively and reject unknown outcomes or mismatched nullability:

```ts
reserveDailyJob: async ({ userId, djId, dropDate }) => {
  const { data, error } = await admin.rpc("reserve_daily_generation_job", {
    p_user_id: userId,
    p_dj_id: djId,
    p_drop_date: dropDate,
  }).maybeSingle();
  if (error) throw error;
  return mapDailyJobReservation(data);
},
```

- [ ] **Step 5: Preserve client recovery**

Teach `useDailyDrop` to treat `daily_quota_reached` as a bounded unavailable state rather than repeatedly submitting alternate dates. Keep a successful `jobId` path unchanged.

- [ ] **Step 6: Run RED-to-GREEN checks**

Run:

```bash
node --import tsx scripts/check/generation-orchestration.ts
npm test -- src/hooks/__tests__/use-daily-drop-test.tsx --runInBand
npx tsc --noEmit
```

Expected: all PASS.

- [ ] **Step 7: Challenge the patch**

Search every direct daily job insertion and date consumer:

```bash
rg -n "createDailyJob|drop_date.*insert|reserve_daily_generation_job|dropDate" supabase/functions src/hooks
```

Expected: no direct daily `generation_jobs` insert remains outside the migration RPC; local date remains only request/job metadata and UI identity.

- [ ] **Step 8: Commit Daily Drop admission**

```bash
git add scripts/check/generation-orchestration.ts supabase/functions/generate-mix/generation-orchestration.ts supabase/functions/generate-mix/index.ts src/hooks/use-daily-drop.ts src/hooks/__tests__/use-daily-drop-test.tsx
git commit -m "fix: bind daily drops to durable quota"
```

### Task 4: Atomic Avatar and Creative Draft RPCs

**Files:**
- Modify: `scripts/check/security-remediation-migration.ts`
- Modify: `supabase/migrations/20260823090000_security_findings_remediation.sql`
- Create: `supabase/functions/_shared/provider-usage.ts`
- Create: `scripts/check/provider-usage-contracts.ts`

**Interfaces:**
- Consumes: `reserve_provider_usage_event`.
- Produces: `reserve_avatar_generation(uuid,text,uuid)` and `reserve_creative_draft(uuid,text,uuid)` plus defensive TypeScript row mappers.

- [ ] **Step 1: Write failing TypeScript mapper tests**

Test valid `created`, `existing`, and `quota` rows and reject empty/unknown responses:

```ts
assert.deepEqual(mapProviderReservation([
  { outcome: "created", event_id: "event", daily_limit: 3, resource_id: "resource" },
]), { outcome: "created", eventId: "event", limit: 3, resourceId: "resource" });
assert.throws(() => mapProviderReservation([{ outcome: "allow" }]));
```

- [ ] **Step 2: Run mapper tests to verify RED**

Run: `node --import tsx scripts/check/provider-usage-contracts.ts`

Expected: module-not-found for `_shared/provider-usage.ts`.

- [ ] **Step 3: Implement the defensive mapper**

Export a discriminated union and reject invalid combinations:

```ts
export type ProviderReservation =
  | { outcome: "created" | "existing"; eventId: string; limit: number; resourceId: string | null }
  | { outcome: "quota"; eventId: null; limit: number; resourceId: null };
```

`mapProviderReservation(data, error?)` throws the supplied database error, requires exactly one row, and verifies string IDs and positive integer limits.

- [ ] **Step 4: Add avatar and draft RPCs**

Each wrapper calls the shared primitive with fixed bucket/operation values. Avatar accepts `p_operation` only when it is `initial_avatar` or `avatar_regen`; creative draft accepts only one of the existing five draft kinds and includes that kind in the operation idempotency key.

```sql
create function public.reserve_avatar_generation(
  p_user_id uuid,
  p_operation text,
  p_request_id uuid
)
returns table (outcome text, event_id uuid, daily_limit integer, resource_id uuid)
language sql
security invoker
set search_path = ''
as $$
  select r.outcome, r.event_id, r.daily_limit, r.resource_id
  from public.reserve_provider_usage_event(
    p_user_id,
    'avatar',
    p_operation,
    p_operation || ':' || p_request_id,
    p_request_id
  ) r
  where p_operation in ('initial_avatar', 'avatar_regen')
$$;
```

The PL/pgSQL version must raise `22023` for an invalid operation rather than returning zero rows. Apply the same fail-closed rule to draft kinds.

- [ ] **Step 5: Run mapper and migration checks GREEN**

Run:

```bash
node --import tsx scripts/check/provider-usage-contracts.ts
npm run check:security-remediation-migration
```

Expected: both PASS.

- [ ] **Step 6: Commit RPC contracts**

```bash
git add scripts/check/security-remediation-migration.ts scripts/check/provider-usage-contracts.ts supabase/functions/_shared/provider-usage.ts supabase/migrations/20260823090000_security_findings_remediation.sql
git commit -m "fix: add atomic avatar and draft reservations"
```

### Task 5: Avatar Entry Points Consume Atomic Reservations

**Files:**
- Create: `supabase/functions/update-dj/avatar-reservation.ts`
- Create: `scripts/check/avatar-reservation.ts`
- Modify: `supabase/functions/update-dj/index.ts`
- Modify: `supabase/functions/create-dj/index.ts`

**Interfaces:**
- Consumes: `reserve_avatar_generation` and `mapProviderReservation`.
- Produces: `reserveAvatarOrQuota` behavior used before every avatar provider call.

- [ ] **Step 1: Write failing focused tests**

Create a pure function dependency contract and prove quota blocks the provider callback while created/existing reservations permit exactly one callback:

```ts
const result = await runAvatarGeneration(
  { userId: "user", operation: "avatar_regen", requestId: "request" },
  {
    reserve: async () => ({ outcome: "quota", eventId: null, limit: 3, resourceId: null }),
    generate: async () => { throw new Error("provider must not run"); },
  },
);
assert.deepEqual(result, { outcome: "quota", limit: 3 });
```

- [ ] **Step 2: Run to verify RED**

Run: `node --import tsx scripts/check/avatar-reservation.ts`

Expected: module-not-found for `avatar-reservation.ts`.

- [ ] **Step 3: Implement the pure reservation boundary**

`runAvatarGeneration` calls `reserve` once and calls `generate` only for `created` or `existing`. It returns `{ outcome: "quota", limit }` or `{ outcome: "generated", value }` without swallowing provider errors.

- [ ] **Step 4: Wire `update-dj`**

Remove the `avatar_regens` count query. Generate a request UUID, call `reserve_avatar_generation` with `avatar_regen`, and preserve the 429 body:

```ts
if (reservation.outcome === "quota") {
  return json({
    error: `daily limit of ${reservation.limit} portraits reached`,
    code: "avatar_quota_reached",
  }, 429);
}
```

Keep trait validation, ownership, trait updates, provider generation, R2 cleanup, and best-effort `avatar_regens` insertion for operational history.

- [ ] **Step 5: Wire `create-dj` initial portraits**

After DJ/config creation and before Replicate, reserve `initial_avatar`. On quota, skip Replicate and return `{ djId, avatarReady: false }`; do not roll back the valid DJ. Provider/database failures keep the existing initials fallback.

- [ ] **Step 6: Run focused checks GREEN**

Run:

```bash
node --import tsx scripts/check/avatar-reservation.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Challenge all avatar provider callers**

Run:

```bash
rg -n "buildAvatarPrompt|flux-1\.1-pro|avatar_regens" supabase/functions
```

Expected: every Flux avatar call is preceded by `reserve_avatar_generation`; no count-then-insert admission remains.

- [ ] **Step 8: Commit avatar enforcement**

```bash
git add supabase/functions/update-dj/avatar-reservation.ts scripts/check/avatar-reservation.ts supabase/functions/update-dj/index.ts supabase/functions/create-dj/index.ts
git commit -m "fix: reserve avatar quota before provider calls"
```

### Task 6: Creative Draft Atomic Quota and Tenant Isolation

**Files:**
- Modify: `scripts/check/creative-draft-function.ts`
- Modify: `supabase/functions/creative-draft/handler.ts`
- Modify: `supabase/functions/creative-draft/index.ts`

**Interfaces:**
- Consumes: `reserve_creative_draft` and caller-visible DJ policies.
- Produces: `CreativeDraftDependencies.reserveDraft` and `listVisibleDjNames(userId)` semantics.

- [ ] **Step 1: Write failing handler tests**

Replace count/insert fixtures with an atomic `reserveDraft` fixture. Add assertions that quota stops before `generateText`, and that visible exclusions are present in both the outgoing prompt and parser rejection:

```ts
const { deps, calls } = dependencies({
  reserveDraft: async () => ({ outcome: "quota", limit: 30 }),
});
const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
assert.deepEqual(result, {
  status: 429,
  body: { error: "draft_rate_limited", code: "draft_rate_limited" },
});
assert.equal(calls.generated.length, 0);
```

Add a model response that repeats a visible name not present in `request.exclude`; expect `malformed_draft` after both attempts, proving parser context includes `existingDjNames`.

- [ ] **Step 2: Run to verify RED**

Run: `npm run check:creative-draft-function`

Expected: type/runtime failure because `reserveDraft` is absent and count/insert dependencies still exist.

- [ ] **Step 3: Replace the handler dependency contract**

Remove `countRecentEvents`, `insertEvent`, and `deleteOldEvents`. Add:

```ts
reserveDraft: (
  userId: string,
  kind: CreativeDraftKind,
  requestId: string,
) => Promise<{ outcome: "created" | "existing"; limit: number } | { outcome: "quota"; limit: number }>;
```

Reserve once after ownership/context validation and before `buildCreativeDraftModelInput`. Map quota to the existing 429 response.

- [ ] **Step 4: Pass visible exclusions into parsing**

Change `parse` to accept `existingDjNames` and merge normalized values with `request.exclude` only for `dj-identity`:

```ts
exclude: request.kind === "dj-identity"
  ? [...request.exclude, ...existingDjNames]
  : request.exclude,
```

Pass the same array on the initial and repair parse attempts.

- [ ] **Step 5: Wire the atomic RPC and visible query**

Generate one request UUID per HTTP request. Call `reserve_creative_draft` and map the row defensively. Replace the global admin name query with:

```ts
const { data, error } = await admin
  .from("djs")
  .select("name")
  .or(`owner_id.is.null,is_public.eq.true,owner_id.eq.${userId}`)
  .limit(500);
```

The authenticated `userId` is a server-validated UUID. Do not accept a user ID from the request body.

- [ ] **Step 6: Run focused checks GREEN**

Run:

```bash
npm run check:creative-draft-function
npm run check:creative-generation
npx tsc --noEmit
```

Expected: all PASS.

- [ ] **Step 7: Challenge the tenant boundary**

Run:

```bash
rg -n "from\(\"djs\"\).*select\(\"name\"|listExistingDjNames|existingDjNames" supabase/functions scripts/check
```

Expected: the only model-context query is visibility-filtered and the parser receives the same list.

- [ ] **Step 8: Commit draft enforcement**

```bash
git add scripts/check/creative-draft-function.ts supabase/functions/creative-draft/handler.ts supabase/functions/creative-draft/index.ts
git commit -m "fix: isolate and atomically limit creative drafts"
```

### Task 7: Local Database Security Reproducers

**Files:**
- Create: `scripts/check/security-quota-invariants.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: a running local Supabase stack with the new migration applied.
- Produces: `npm run check:security-quota-invariants`, the authoritative malicious and legitimate database reproducer.

- [ ] **Step 1: Write the integration check before resetting Supabase**

Use the existing `generation-quota-concurrency.ts` credential helper pattern. Create users/DJs, then assert:

```ts
const distinctDates = await Promise.all([
  reserveDaily("2025-01-01"),
  reserveDaily("2026-08-23"),
  reserveDaily("2099-12-31"),
]);
assert.equal(distinctDates.filter((row) => row.outcome === "created").length, 1);
assert.equal(distinctDates.filter((row) => row.outcome === "existing").length, 2);
```

Consume three generation events, delete the DJ, create a replacement, and assert manual/cover reservation remains quota. Reserve three avatar requests, delete the DJ, and assert an initial replacement avatar is quota. Race 40 draft reservations and assert exactly 30 created. Include a separate user to prove isolation and legitimate capacity.

- [ ] **Step 2: Add the package script**

```json
"check:security-quota-invariants": "node --import tsx scripts/check/security-quota-invariants.ts"
```

- [ ] **Step 3: Start/reset local Supabase**

Run:

```bash
npx supabase start
npx supabase db reset
```

Expected: migration applies successfully and local services become healthy. If Docker is unavailable, record this exact gate as unavailable and do not claim the findings verified.

- [ ] **Step 4: Run the integration check**

Run: `npm run check:security-quota-invariants`

Expected: PASS with explicit counts for daily, generation-after-delete, avatar-after-delete, and creative-draft concurrency.

- [ ] **Step 5: Run existing database regressions**

Run:

```bash
node --import tsx scripts/check/generation-quota-concurrency.ts
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/check/manual-generation-invariant.sql
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/check/content-visibility-rls.sql
```

Expected: all PASS. Obtain `LOCAL_DATABASE_URL` from `npx supabase status -o env` without printing credentials in logs.

- [ ] **Step 6: Commit the integration gate**

```bash
git add package.json scripts/check/security-quota-invariants.ts
git commit -m "test: prove durable provider quotas"
```

### Task 8: Provider-Admission Verification Gate

**Files:**
- Modify only if a test exposes a defect in files from Tasks 1-7.

**Interfaces:**
- Consumes: every artifact in this plan.
- Produces: fresh verification evidence for findings 1, 2, 3, and 5.

- [ ] **Step 1: Inspect the complete diff and source-to-sink coverage**

Run:

```bash
git diff ac8665d...HEAD --check
git diff ac8665d...HEAD --stat
rg -n "generation_jobs.*insert|replicateRun|replicateText|reserve_.*generation|provider_usage_events|listExistingDjNames" supabase/functions supabase/migrations scripts/check
```

Expected: no paid provider entry point identified by the report lacks a reservation; no global private-name query remains.

- [ ] **Step 2: Run focused contracts**

Run:

```bash
npm run check:security-remediation-migration
node --import tsx scripts/check/provider-usage-contracts.ts
node --import tsx scripts/check/avatar-reservation.ts
node --import tsx scripts/check/generation-orchestration.ts
npm run check:creative-draft-function
npm run check:creative-generation
npm run check:creative-generation-migration
```

Expected: all PASS.

- [ ] **Step 3: Run type and relevant Jest checks**

Run:

```bash
npx tsc --noEmit
npm test -- src/hooks/__tests__/use-daily-drop-test.tsx src/hooks/__tests__/use-generate-mix-test.tsx --runInBand
```

Expected: all PASS with zero test failures.

- [ ] **Step 4: Run local database checks**

Run:

```bash
npm run check:security-quota-invariants
node --import tsx scripts/check/generation-quota-concurrency.ts
```

Expected: all PASS. If the local stack is unavailable, this plan remains unverified.

- [ ] **Step 5: Record finding outcomes**

Record in the final remediation report:

- finding 1 malicious case: three different dates yield one created Daily Drop reservation;
- finding 2 malicious case: DJ deletion does not reduce generation/avatar usage;
- finding 3 malicious case: concurrent avatar/draft calls stop at 3/30;
- finding 5 malicious case: another tenant's private name is absent from provider input;
- legitimate controls: public/system/own DJ names remain exclusions, ordinary quota capacity works, and idempotent retries return existing reservations.
