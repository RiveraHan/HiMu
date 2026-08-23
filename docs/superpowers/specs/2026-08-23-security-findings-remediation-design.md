# Security Findings Remediation Design

**Status:** Ready for user review

**Date:** 2026-08-23

**Source scan:** `c671d9f0-1ad9-4ad7-94a1-dc7d91506bbb` at revision `d94a754edc6b465ae9996b8125aadf8616d41506`

## Goal

Close all five validated findings from the Codex Security report without weakening authentication, ownership checks, Daily Drop behavior, generation recovery, or public-media playback. The finished change must include executable regression coverage, database migration coverage, client and Edge Function checks, and a release-oriented verification pass.

## Findings in scope

1. Caller-selected drop dates bypass the paid generation quota.
2. Deleting and recreating a DJ resets paid-generation quota history.
3. Non-atomic quota checks permit concurrent avatar and creative-draft bursts.
4. Private generated audio is stored behind permanent public URLs.
5. Creative draft generation sends other tenants' private DJ names to an external model.

No unrelated product redesign, pricing change, visual redesign, or authentication change is included.

## Repository constraints

- Manual mix and cover generation already use PostgreSQL advisory locks and reservation RPCs. The remediation must extend this repository-native pattern rather than introduce an unrelated rate-limit service.
- Daily Drop currently uses a device-local `YYYY-MM-DD` identity for UI rollover and deterministic DJ selection. That value may remain presentation metadata, but it must no longer decide whether paid provider work is admitted.
- A user may own one current DJ. Deleting that DJ cascades its jobs, tracks, avatar regeneration rows, and cover regeneration rows.
- Creative drafts are limited to 30 per hour and avatar regeneration to 3 per rolling 24 hours, but both are currently implemented as non-atomic count-then-insert flows.
- Public tracks and Audius tracks must continue to play directly. Private generated audio needs an authenticated resolution step without putting permanent public object URLs in database rows.
- The existing R2 public custom domain exposes every object in its bucket. Truly private objects therefore require a separate R2 bucket with no public domain, not merely a less discoverable key.
- Edge Functions use the service-role client for server-side writes and `serveAuthed` for JWT validation. New privileged RPCs remain executable only by `service_role`.

## Approaches considered

### 1. Durable usage ledger plus a private R2 bucket — recommended

Add one append-only, user-scoped provider-usage ledger and make every paid provider entry point reserve usage atomically. Store private audio in a separate non-public R2 bucket and resolve it to short-lived signed URLs only after an authenticated ownership check.

This is the narrowest design that closes the shared root causes: usage history no longer depends on deletable content, concurrent admission is serialized, and private bytes are no longer reachable through the public CDN.

### 2. Patch each existing table independently

Avatar and creative-draft tables could receive their own locking functions, and generation rows could be retained after DJ deletion. This produces several quota implementations, complicates deletion semantics, and still couples billing history to mutable operational content. It is rejected because it does not completely close the deletion-reset class.

### 3. Add gateway throttling and keep public media URLs

Per-IP or per-route throttles would reduce request volume but would not provide per-user, cross-route atomic accounting. Obscuring public R2 keys would still leave private audio as permanent bearer content. This approach is defense in depth only and is not a remediation for the validated findings.

## Design overview

The remediation has four boundaries:

1. `provider_usage_events` becomes the durable source of truth for provider admission.
2. PostgreSQL reservation functions serialize each user's quota bucket and create usage events in the same transaction as operational reservations.
3. Private audio is written to a non-public R2 bucket and represented in the database by an opaque `r2-private://` reference.
4. Creative draft context is limited to names the caller is allowed to know, and deterministic output validation receives the same exclusions sent to the model.

## Durable provider usage accounting

### Table

Add `public.provider_usage_events` with:

- `id uuid primary key default gen_random_uuid()`;
- `user_id uuid not null references auth.users(id) on delete cascade`;
- `quota_bucket text not null` constrained to `generation`, `daily_drop`, `avatar`, or `creative_draft`;
- `operation text not null` constrained to the concrete provider action;
- `idempotency_key text not null`;
- `resource_id uuid null` with no content foreign key;
- `created_at timestamptz not null default clock_timestamp()`;
- a unique constraint on `(user_id, quota_bucket, idempotency_key)`;
- a lookup index on `(user_id, quota_bucket, created_at desc)`.

The table has RLS enabled and no privileges for `anon` or `authenticated`. Only `service_role` may read or write it. The `user_id` cascade is intentional: account deletion may remove billing history, while deletion of a DJ, track, job, or regeneration row may not.

### Shared reservation primitive

Create a service-only SQL function that:

1. validates a known quota bucket, operation, positive limit, bounded window, and non-empty idempotency key;
2. takes a transaction advisory lock derived from `(user_id, quota_bucket)`;
3. returns the existing reservation for a repeated idempotency key;
4. counts durable events in the server-time window;
5. returns `quota` at the limit;
6. inserts and returns a new event otherwise.

Every provider-facing RPC calls this primitive inside its own transaction. Client-supplied dates, content existence, provider success, and later content deletion never reduce usage already reserved in the active window.

### Quota buckets and legitimate behavior

- `generation`: 3 per rolling 24 hours, shared by manual mixes and cover regenerations, preserving the current combined limit.
- `daily_drop`: 1 per rolling 24 hours. The local date remains a UI/job label, but distinct submitted dates cannot create additional provider reservations.
- `avatar`: 3 per rolling 24 hours. Both initial DJ portraits and later portrait regenerations reserve this bucket so delete/recreate loops remain bounded. DJ creation still succeeds with initials when portrait quota is unavailable.
- `creative_draft`: 30 per rolling hour.

Provider failures continue to consume a reservation because the paid or resource-intensive attempt may already have started. Idempotent retries of the same operational reservation reuse the original usage event.

### Backfill

The migration backfills existing operational history into the ledger using stable prefixed idempotency keys:

- non-daily generation jobs as `mix:<job_id>`;
- cover regenerations as `cover:<regen_id>`;
- dated generation jobs as `drop:<job_id>`;
- avatar regeneration rows as `avatar:<regen_id>`;
- creative draft events as `draft:<event_id>`.

Backfill preserves current in-window usage before the new functions become authoritative. Initial historical avatar creation has no durable event to backfill, so only future initial portraits are reserved.

## Entry-point changes

### Daily Drop and manual generation

Replace direct daily-job insertion with an atomic daily reservation RPC. It returns the one recent daily job when it still exists, returns `quota` when durable history exists but its content was deleted, or creates a new job and linked usage event. The Edge Function continues validating DJ visibility and ownership before reserving work.

`dropDate` remains format-validated and stored for client presentation, but the server-time `daily_drop` ledger is the only admission control. Repeating the same date remains idempotent; varying dates cannot exceed one provider attempt per 24 hours.

Manual mix reservation, legacy retry, and cover reservation retain their existing RPC contracts and active-job behavior while inserting durable `generation` usage in the same transaction as each new operational reservation. `generation_quota_usage` reads the ledger rather than cascade-deletable rows.

### Avatar generation

Add an atomic avatar reservation RPC. `update-dj` calls it before any Replicate request and returns the existing `avatar_quota_reached` response on quota. Traits keep their established validation and ownership requirements.

`create-dj` reserves an initial portrait after creating the DJ and generation config but before Replicate. If quota is unavailable, it returns a successful DJ creation with `avatarReady: false`, preserving the documented initials fallback and preventing deletion/recreation from causing unbounded portrait spend.

### Creative drafts

Replace `deleteOldEvents`, `countRecentEvents`, and `insertEvent` with one atomic reservation dependency. A quota result preserves the existing `draft_rate_limited` response and stops before the model call.

## Private audio storage and delivery

### Storage representation

Add `R2_PRIVATE_BUCKET`, which must reference an R2 bucket without a public custom domain. Extend the R2 helper with explicit `public` and `private` access modes:

- public media is uploaded to `R2_BUCKET` and returns its current CDN URL;
- private audio is uploaded to `R2_PRIVATE_BUCKET` and returns `r2-private://<generated-key>`;
- deletion parses stored references and deletes from the correct bucket;
- private responses use `Cache-Control: private, no-store`; public responses keep existing public caching.

Generated track audio and generated caption audio use the job's authoritative visibility. Public generated tracks remain direct CDN URLs. Audius media remains external and public. Existing covers and avatars remain public presentation assets in this remediation because the validated finding concerns private audio and the current product displays those images outside the player.

### Authenticated resolution

Add an authenticated `private-media-url` Edge Function with a pure testable handler. It accepts either a track ID for track audio or a generation-job ID for caption audio, loads the authoritative row, and verifies:

- track audio: `is_public = true` or `owner_id = auth.uid()`;
- caption audio: `generation_jobs.user_id = auth.uid()`;
- the stored value is a valid generated `r2-private://` reference for the requested media class.

For authorized private media it returns a five-minute R2 SigV4 GET URL. It returns stable `invalid_input`, `not_found`, and `not_owner` errors without exposing object keys to unauthorized callers.

The player resolves private track references immediately before playback through the existing auth-scoped invocation helper. It rechecks that the same user still owns the request before replacing the player source. Public and Audius URLs bypass this call. The caption voice control resolves its private job media the same way and never persists the signed URL.

### Existing private media migration

Code changes secure newly generated media, but existing private tracks still point to public objects. Add an idempotent operational migration script that:

1. queries owner-private tracks and private daily-job caption audio with the service role;
2. validates each generated public key;
3. copies the object from the public bucket to the private bucket;
4. updates the database row to `r2-private://<key>` only after copy verification;
5. deletes the public source only after the database update succeeds;
6. supports dry-run, bounded batches, resume, and explicit failure reporting.

Production release is not considered complete until this script reports no remaining private generated-audio rows backed by the public CDN.

## Creative draft tenant isolation

`listExistingDjNames(userId)` returns only:

- system DJs (`owner_id is null`);
- public DJs;
- the caller's own DJs.

The query remains bounded to 500 rows. The handler passes this same visible-name set to output parsing so the model cannot return a collision that the deterministic parser was not told to reject. Global uniqueness, if later required, must be implemented as a non-disclosing database conflict check rather than by sending private values to a model.

## Error and recovery behavior

- Quota exhaustion keeps current stable client error codes.
- Database reservation failure returns a server/provider-unavailable response and stops before external work.
- A provider failure does not release durable usage automatically.
- Repeated idempotency keys return the original reservation without double charging.
- A deleted daily job with an active durable reservation yields quota until its server-time window expires; it never silently starts a replacement provider call.
- Private-media resolution fails closed on malformed references, missing ownership, auth changes, or signing errors.
- Public playback never depends on the private-media resolver.
- R2 upload/finalization failure keeps existing orphan cleanup, using the authoritative public/private bucket.

## Test-driven implementation strategy

Every production behavior change begins with a focused failing test.

### Database and migration tests

- Migration contract checks assert the ledger schema, service-only grants, no content foreign keys, backfill, and all reservation wiring.
- Local Supabase integration tests race avatar, creative draft, manual, cover, and Daily Drop reservations and prove limits cannot be exceeded.
- A delete/recreate test consumes generation and avatar usage, deletes the DJ, creates replacement content, and proves the original window remains counted.
- A malicious-date test submits distinct past and future dates concurrently and proves only one Daily Drop provider reservation is created.
- Legitimate sequential and idempotent controls prove current limits, active-job reuse, and daily retry behavior remain intact.

### Edge Function and pure contract tests

- Daily orchestration stops on durable quota before `runGeneration`.
- Avatar and creative draft paths stop before Replicate when reservation is unavailable.
- Visible DJ name context includes system, public, and own names but excludes another user's private name.
- The parser receives the exact visible exclusion set.
- Private media rejects anonymous/non-owner access, signs owner access, validates key classes, and never signs an arbitrary key.
- R2 reference parsing accepts only generated private keys and routes deletion to the correct bucket.

### Client tests

- Public and Audius tracks play without invoking the private resolver.
- Private tracks invoke the resolver with the captured auth scope and use the returned short-lived URL.
- An A-to-B auth change discards A's pending signed URL and does not start playback.
- Private resolution failure leaves the prior player state safe and returns a failed load confirmation.
- Caption playback resolves private job audio without persisting the signed URL.

### Operational migration tests

- Dry-run performs no writes or deletes.
- Successful migration orders copy, verification, row update, then public deletion.
- Failure before row update preserves the public source and original database value.
- A resumed batch skips already-private rows and reports a zero-remainder completion state.

## Verification and release gates

The remediation is complete only when all applicable gates pass with fresh output:

1. focused RED/GREEN tests for each finding;
2. migration contract scripts and local Supabase reset;
3. local concurrency, deletion-reset, RLS, and private-media integration checks;
4. Edge Function checks and TypeScript checks;
5. full Jest suite and Expo lint;
6. Expo web export/build and existing creative-generation contract checks;
7. operational private-media migration dry-run against configured production-like data;
8. production migration execution with zero remaining public private-audio rows;
9. a follow-up Codex Security scan or focused verification demonstrating that all five original paths no longer reproduce.

If production credentials or deployment authority are unavailable, code may be ready but the overall objective remains unverified rather than being reported as complete.

## Expected files and components

- one new Supabase migration for the ledger, backfill, and reservation RPC changes;
- updates to `generate-mix`, `regenerate-cover`, `create-dj`, `update-dj`, and `creative-draft`;
- updates to the shared R2 helper;
- a new `private-media-url` Edge Function and pure handler;
- a small client private-media resolver used by the main player and caption voice control;
- an idempotent private-media migration script;
- focused check scripts and Jest tests;
- `.env.example` and deployment documentation for `R2_PRIVATE_BUCKET`.

## Completion criteria by finding

1. Distinct caller-controlled dates cannot create more than one Daily Drop provider reservation in a 24-hour server window.
2. DJ deletion cannot reduce any active provider quota, and initial replacement avatars are also reserved.
3. Concurrent avatar and creative-draft requests cannot exceed their limits.
4. New and migrated private audio has no public CDN object path; only an authorized owner receives a short-lived URL.
5. Another tenant's private DJ name is absent from the provider request and from model-output validation context.

All five criteria require both a malicious reproducer that no longer succeeds and a legitimate control that still succeeds.
