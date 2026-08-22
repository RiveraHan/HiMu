# Creative Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trait-derived DJ identity drafts and explicitly confirmed track briefs with granular title/direction/lyric regeneration, private finished lyrics, and immutable linked track versions.

**Architecture:** An authenticated `creative-draft` Edge Function returns validated structured text but never creates jobs or consumes music quota. Manual `generate-mix` accepts a versioned brief, validates it against authoritative DJ data, stores it atomically with quota reservation, and finalizes a new immutable track plus owner-only lyrics and optional parent linkage. Client controllers keep drafts local until explicit confirmation and reuse existing auth-scope, activity, visibility, and recovery systems.

**Tech Stack:** Expo Router 6, React Native 0.81, TypeScript 5.9, TanStack Query 5, Supabase Auth/Postgres/Edge Functions, Replicate Llama text generation and Lyria music generation, Jest/Testing Library, Node assertion-based Edge Function checks.

## Global Constraints

- Do not redesign or duplicate genre, mood, energy, mode, vibe, or visibility controls.
- Preserve native Android and web authentication/session boundaries and all current uncommitted web/auth and quality-test work.
- A draft never creates a DJ, generation job, media object, or music-quota reservation.
- No suggested text is used until the user selects or edits it and explicitly confirms.
- DJ names remain 2-24 supported characters; identity concepts are 10-240 characters.
- Titles are 2-80 characters; creative direction is 10-500; vocal lyric theme is 2-120; lyrics remain at most 1,000 characters.
- Instrumental briefs contain no lyric theme or lyrics. Vocal drafts require recognizable verse and chorus sections in the requested locale.
- Exclusions contain at most ten normalized values, each at most 80 characters.
- Confirmed lyrics are owner-readable private data only. Public lyric access/display is deferred.
- Finished tracks, audio, lyrics, and accepted briefs are immutable. A later lyric edit creates a new track with direct-parent linkage.
- Daily Drops keep their current automatic title/lyrics path.
- Use TDD: observe each focused test fail before changing production behavior; do not weaken existing assertions.
- Do not add a broad dependency. Reuse `replicateText`, current Supabase helpers, components, and test tooling.
- Stage and commit only task-owned files. Before every commit run `git diff --cached --name-only` to ensure pre-existing unrelated changes are excluded.

---

## Planned file structure

- `src/types/creative-generation.ts`: client-safe versioned draft and confirmed-brief contracts plus pure local draft-state helpers.
- `supabase/functions/_shared/creative-generation.ts`: server validation, normalization, authoritative snapshot creation, prompt construction, and structured-output parsing.
- `supabase/functions/creative-draft/index.ts`: authenticated orchestration only; ownership/config lookup and text-model invocation.
- `src/hooks/use-creative-draft.ts`: auth-scoped draft mutations, separated by draft kind.
- `src/hooks/use-track-private-details.ts`: owner-only retrieval used to seed a new version.
- `src/components/dj/DjIdentityDraftStep.tsx`: three candidates, selection/edit/custom/regeneration UI.
- `src/components/dj/GenerationBriefEditor.tsx`: independent title/direction/theme/lyrics editing and regeneration.
- `src/components/dj/GenerationConfirmation.tsx`: exact immutable preview and deliberate submit action.
- `app/create-dj.tsx`: composes existing traits with the new identity step.
- `app/dj/[id].tsx`: launches preparation; no inline immediate generation.
- `app/create-track.tsx`: focused track preparation route, including optional `sourceTrackId`.
- One additive migration updates identity, job brief, private lyrics, lineage, reservation, and finalization atomically.

### Task 1: Versioned contracts and deterministic validation

**Files:**
- Create: `src/types/creative-generation.ts`
- Create: `supabase/functions/_shared/creative-generation.ts`
- Create: `scripts/check/creative-generation-contracts.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `DjTraitSnapshot`, `DjIdentityCandidate`, `GenerationBriefDraft`, `ConfirmedGenerationBriefV1`, `CreativeDraftRequest`, and `CreativeDraftResponse`.
- Produces `validateCreativeDraftRequest(value)`, `validateConfirmedBrief(value, authoritative)`, `parseCreativeDraftOutput(kind, raw)`, `buildCreativeDraftModelInput(request, context)`, and `sameTraitSnapshot(a, b)`.

- [ ] **Step 1: Write the failing contract check** covering all discriminants, exact limits, ten-item exclusions, duplicate normalized identities, banned current fallback titles, EN/ES verse-and-chorus recognition, instrumental null lyrics, hostile controls, invalid model JSON, and stale authoritative snapshots.

```ts
assert.throws(() => validateConfirmedBrief({ ...valid, title: "Neon Pulse" }, authoritative), /generic_title/);
assert.throws(() => validateConfirmedBrief({ ...valid, mode: "instrumental", lyrics: "[Verse]\nX" }, authoritative), /instrumental/);
assert.equal(validateConfirmedBrief(valid, authoritative).version, 1);
assert.throws(() => parseCreativeDraftOutput("dj-identity", duplicateCandidates), /duplicate/);
```

- [ ] **Step 2: Run `node --import tsx scripts/check/creative-generation-contracts.ts`** and verify it fails because the shared contract module does not exist.
- [ ] **Step 3: Implement client types and pure server functions.** `buildCreativeDraftModelInput` must frame traits/current fields/exclusions as data, require JSON-only output, original work, no named-artist imitation, and the requested locale. Permit one caller-managed repair pass; parsing itself must never silently repair or truncate invalid output.
- [ ] **Step 4: Add `check:creative-generation` to `package.json` and run it.** Expected: the new check passes, plus `npx tsc --noEmit` passes.
- [ ] **Step 5: Commit only the four files:** `git commit -m "feat: define creative generation contracts"`.

### Task 2: Database privacy, immutable briefs, and version lineage

**Files:**
- Create: `supabase/migrations/20260812190000_creative_generation_briefs.sql`
- Create: `scripts/check/creative-generation-migration.ts`
- Modify: `package.json`
- Modify after applying/linking: `src/types/database.ts`

**Interfaces:**
- Produces `djs.identity_concept text`.
- Produces `generation_jobs.generation_brief jsonb` and `generation_jobs.source_track_id uuid`.
- Produces `tracks.source_track_id uuid`.
- Produces `track_private_details(track_id PK, owner_id, confirmed_lyrics, created_at)` with owner-only SELECT RLS and no anonymous grants beyond RLS-governed access.
- Produces service-role-only `creative_draft_events(id, user_id, kind, created_at)` for a rolling 30-request/hour draft limit; RLS is enabled with no client policies.
- Replaces service-role-only `reserve_manual_generation_job(uuid, uuid, jsonb, boolean, uuid)` and `finalize_generated_mix(...)` signatures while dropping superseded overloads.

- [ ] **Step 1: Write a failing migration contract check** that reads the SQL and requires columns, FKs with `on delete set null`, owner-only lyric RLS, service-role-only draft events, no public lyric view, the new RPC signatures, active-job brief immutability, and atomic private-detail insertion.
- [ ] **Step 2: Run `node --import tsx scripts/check/creative-generation-migration.ts`** and verify failure because the migration is absent.
- [ ] **Step 3: Write the additive migration.** The reservation RPC must accept `p_generation_brief jsonb` and `p_source_track_id uuid`, store both only when creating a job, and return an existing active job without overwriting its values. The finalization RPC must copy `generation_brief->>'lyrics'` into `track_private_details` only when non-empty, copy job lineage to the new track, and preserve current attempt fencing and visibility.

```sql
create table public.track_private_details (
  track_id uuid primary key references public.tracks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  confirmed_lyrics text not null check (char_length(confirmed_lyrics) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.track_private_details enable row level security;
create policy track_private_details_owner_select on public.track_private_details
for select to authenticated using (owner_id = (select auth.uid()));
```

- [ ] **Step 4: Run the migration check and a local Supabase reset if Docker/local Supabase is available.** Expected: check passes; otherwise record the manual DB verification without pretending it ran.
- [ ] **Step 5: Regenerate `src/types/database.ts` from the linked schema only when the migration is applied; otherwise make the exact generated-shape additions manually and schedule linked regeneration in final verification.** Run `npx tsc --noEmit`.
- [ ] **Step 6: Commit only migration/check/type/script changes:** `git commit -m "feat: persist private creative briefs"`.

### Task 3: Authenticated creative-draft Edge Function

**Files:**
- Create: `supabase/functions/creative-draft/index.ts`
- Create: `scripts/check/creative-draft-function.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes Task 1 validators and `replicateText`.
- Produces authenticated responses `{ version: 1, kind, draft }` and stable errors: `invalid_input`, `not_owner`, `draft_rate_limited`, `draft_timeout`, `malformed_draft`, `provider_unavailable`.

- [ ] **Step 1: Write a failing dependency-injected function check** for valid pre-creation identity traits, exactly three candidates, owned-track context, non-owner rejection, no job/quota calls, malformed output then one repair, repair exhaustion, timeout, and sanitized provider errors.
- [ ] **Step 2: Run the check** and observe the missing handler failure.
- [ ] **Step 3: Implement `handleCreativeDraftRequest(raw, userId, deps)` separately from `serveAuthed`.** For track kinds load `dj_generation_configs` with DJ identity/traits and verify `owner_id`; for identity validate the submitted traits. Use `LLAMA_ENDPOINT`, a 30-second request deadline, and one repair prompt. Never return `base_prompt`.
- [ ] **Step 4: Enforce the independent rolling rate limit.** Before the model call, count this user's `creative_draft_events` from the last hour; return `429 draft_rate_limited` at 30. Otherwise insert `{ user_id, kind }`. This table is service-role-only and the code must never call `generation_quota_usage` or reserve a music job.
- [ ] **Step 5: Run contract/function checks and `deno check supabase/functions/creative-draft/index.ts` when Deno is available.** Expected: pass; document unavailable tooling.
- [ ] **Step 6: Commit:** `git commit -m "feat: add creative draft endpoint"`.

### Task 4: Confirmed identity through DJ creation

**Files:**
- Modify: `supabase/functions/_shared/dj-input.ts`
- Modify: `supabase/functions/create-dj/index.ts`
- Modify: `supabase/functions/update-dj/index.ts`
- Modify: `src/hooks/use-create-dj.ts`
- Modify: `src/hooks/use-dj.ts`
- Modify: `scripts/check/creative-generation-contracts.ts`
- Test: `app/__tests__/create-dj-i18n-test.tsx`
- Test: `app/__tests__/train-dj-i18n-test.tsx`

**Interfaces:**
- `CreateDJInput` gains required `identityConcept: string`.
- `UpdateDJInput` remains unchanged. `update-dj` loads the saved concept server-side and retains it when rebuilding `base_prompt`; training never edits or clears it in this phase.
- DJ detail projections return `identity_concept` to owners/public viewers as ordinary DJ identity copy.

- [ ] **Step 1: Add failing tests** proving create validates and stores a confirmed concept, `buildBasePrompt` and avatar prompt include bounded confirmed identity only after submission, and training a DJ does not erase an existing concept.
- [ ] **Step 2: Run the focused checks/tests** and observe missing-field/storage failures.
- [ ] **Step 3: Implement minimal server/client contract changes.** Keep `character` as vibe; write `identity_concept` separately. Do not synthesize a concept in `create-dj`.
- [ ] **Step 4: Run focused checks, `npx tsc --noEmit`, and lint.** Expected: pass.
- [ ] **Step 5: Commit:** `git commit -m "feat: persist confirmed DJ identity"`.

### Task 5: Client draft hooks and pure preparation state

**Files:**
- Create: `src/hooks/use-creative-draft.ts`
- Create: `src/hooks/__tests__/use-creative-draft-test.tsx`
- Create: `src/utils/generation-brief-state.ts`
- Create: `src/utils/__tests__/generation-brief-state-test.ts`
- Modify: `src/api/queries.ts`

**Interfaces:**
- Produces `useDjIdentityDrafts()`, `useTrackBriefDraft()`, `useRegenerateTrackField(kind)` using `invokeWithAuthScope`.
- Produces pure `createBriefDraft`, `editBriefField`, `applyRegeneratedField`, `markTraitsStale`, `confirmBrief`, and `canConfirmBrief`.

- [ ] **Step 1: Write failing tests** for auth-scope changes discarding responses, independent pending/errors, bounded exclusions, unrelated fields remaining byte-for-byte unchanged, edits invalidating confirmation, stale traits blocking confirmation, and no mutation calls from pure state operations.
- [ ] **Step 2: Run focused tests** and verify missing hooks/helpers fail.
- [ ] **Step 3: Implement minimal hooks and reducer-like helpers.** Do not put draft content in a global Zustand store or persistent storage.
- [ ] **Step 4: Run focused tests, typecheck, and lint.** Expected: pass.
- [ ] **Step 5: Commit:** `git commit -m "feat: add creative draft state"`.

### Task 6: DJ identity proposal step

**Files:**
- Create: `src/components/dj/DjIdentityDraftStep.tsx`
- Create: `src/components/dj/__tests__/DjIdentityDraftStep-test.tsx`
- Modify: `src/components/dj/DjTraitsForm.tsx`
- Modify: `src/components/index.ts`
- Modify: `app/create-dj.tsx`
- Modify: `app/__tests__/create-dj-i18n-test.tsx`
- Modify: `src/i18n/locales/en/dj.ts`
- Modify: `src/i18n/locales/es/dj.ts`
- Modify: `src/i18n/__tests__/resources-test.ts`

**Interfaces:**
- `DjTraitsForm` gains `showName?: boolean` (default `true`) so training remains unchanged and creation uses `false`.
- `DjIdentityDraftStep` receives `{ traits, value, onChange, disabled }` and outputs `{ name, identityConcept, provenance, confirmed }`.

- [ ] **Step 1: Write failing component/screen tests** for exactly three candidates, selection, edit, custom entry, regenerate-all, failed drafting with custom fallback, trait staleness without erased edits, accessibility selection state, and create disabled until explicit identity confirmation.
- [ ] **Step 2: Run focused tests** and observe missing component/flow failures.
- [ ] **Step 3: Implement the step using existing `PrefSection`, `GlassInput`, `Button`, and theme primitives.** Do not alter the six existing trait controls or visibility behavior.
- [ ] **Step 4: Add complete EN/ES copy and resource parity assertions.** Run focused tests, typecheck, and lint.
- [ ] **Step 5: Commit:** `git commit -m "feat: add DJ identity drafts"`.

### Task 7: Manual generation accepts an immutable confirmed brief

**Files:**
- Modify: `supabase/functions/generate-mix/generation-models.ts`
- Modify: `supabase/functions/generate-mix/generation-orchestration.ts`
- Modify: `supabase/functions/generate-mix/index.ts`
- Modify: `scripts/check/generation-models.ts`
- Modify: `scripts/check/generation-orchestration.ts`
- Modify: `src/hooks/use-generate-mix.ts`
- Modify: `src/activity/types.ts`
- Modify: `src/activity/generation-activity.ts`
- Modify: `src/activity/use-generation-activity.ts`
- Test: `src/activity/__tests__/generation-activity-test.ts`
- Test: `src/activity/__tests__/ActivityProvider-test.tsx`

**Interfaces:**
- `GenerateMixInput` becomes `{ djId, brief: ConfirmedGenerationBriefV1, sourceTrackId?: string | null }`.
- Reservation receives authoritative brief JSON, `isPublic` derived from brief visibility, and validated source ID.
- Activity retries retain `retryBrief` and `sourceTrackId`; legacy rows fall back from `prompt` into the old lyric-only retry path.

- [ ] **Step 1: Add failing orchestration checks** for authoritative trait rebuilding, `brief_stale`, ownership/mode/source validation, active-job immutability, confirmed manual title/direction/lyrics, daily behavior unchanged, and recovery reusing the stored brief.
- [ ] **Step 2: Run generation checks** and observe the old lyric/title behavior fail.
- [ ] **Step 3: Extend `buildMusicInput` with separately framed creative direction** within `MAX_LYRIA_PROMPT_CHARS`. Manual `runGeneration` uses `brief.title`; daily generation alone keeps `creativeTitle()`.
- [ ] **Step 4: Update endpoint dependencies/RPC calls and client/activity contracts.** Never accept a client trait snapshot as authoritative. An existing active job response must hydrate its persisted brief rather than the new request.
- [ ] **Step 5: Run generation checks, activity tests, typecheck, and lint.** Expected: pass.
- [ ] **Step 6: Commit:** `git commit -m "feat: generate from confirmed creative briefs"`.

### Task 8: Track preparation, granular regeneration, and confirmation

**Files:**
- Create: `app/create-track.tsx`
- Create: `app/__tests__/create-track-test.tsx`
- Create: `src/components/dj/GenerationBriefEditor.tsx`
- Create: `src/components/dj/GenerationConfirmation.tsx`
- Create: `src/components/dj/__tests__/GenerationBriefEditor-test.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/dj/[id].tsx`
- Modify: `app/dj/__tests__/dj-profile-test.tsx`
- Modify: `src/components/index.ts`
- Modify: `src/i18n/locales/en/dj.ts`
- Modify: `src/i18n/locales/es/dj.ts`

**Interfaces:**
- Route params: `{ djId: string, sourceTrackId?: string }`; params identify records only and never carry private lyrics.
- Confirmation sends the exact frozen brief snapshot once.

- [ ] **Step 1: Write failing tests** for owned-DJ launch, initial title/direction/conditional lyric draft, custom paste, per-field regeneration preserving other fields, inline retry errors, instrumental hiding lyrics, exact preview, edit invalidating preview, offline editing but disabled draft/generation, active-job blocking, and no generate call without confirmation press.
- [ ] **Step 2: Run focused tests** and observe missing route/components.
- [ ] **Step 3: Implement preparation route and components.** Replace the DJ profile's inline lyrics/immediate generate controls with navigation to preparation. Visibility remains editable in the final brief.
- [ ] **Step 4: Add accessibility and EN/ES parity tests**, then run focused tests, typecheck, and lint.
- [ ] **Step 5: Commit:** `git commit -m "feat: confirm creative track briefs"`.

### Task 9: Owner-private lyrics and new track versions

**Files:**
- Create: `src/hooks/use-track-private-details.ts`
- Create: `src/hooks/__tests__/use-track-private-details-test.tsx`
- Modify: `src/api/queries.ts`
- Modify: `app/player.tsx`
- Modify: `app/__tests__/player-i18n-test.tsx`
- Modify: `app/create-track.tsx`
- Modify: `app/__tests__/create-track-test.tsx`
- Modify: `supabase/functions/generate-mix/generation-orchestration.ts`
- Modify: `scripts/check/generation-orchestration.ts`

**Interfaces:**
- `useTrackPrivateDetails(trackId)` queries `track_private_details(track_id, confirmed_lyrics)` only when authenticated and ownership is true.
- Player offers “Create a new version” only for owned vocal tracks with private lyrics; it navigates with IDs only.
- New confirmed requests pass `sourceTrackId`; finalization creates new audio/track/private details and never updates the source.

- [ ] **Step 1: Write failing privacy/version tests**: owner can load lyrics; anonymous/non-owner receives no row; public track projections contain no lyrics; source must share owner and DJ; seeded edit preserves original; finalization creates a distinct track with parent linkage and new private lyrics.
- [ ] **Step 2: Run focused tests/checks** and observe missing private query/version behavior.
- [ ] **Step 3: Implement owner query and version entry action.** Keep public display absent. Do not add in-place update mutations.
- [ ] **Step 4: Run focused tests, generation checks, typecheck, and lint.** Expected: pass.
- [ ] **Step 5: Commit:** `git commit -m "feat: create private lyric track versions"`.

### Task 10: Full verification and release handoff

**Files:**
- Modify only if tests find a feature-scoped defect; start with no planned production edits.
- Update generated `src/types/database.ts` if linked schema generation was deferred in Task 2.

- [ ] **Step 1: Run every focused check:** `npm run check:creative-generation`, migration/function checks, `node --import tsx scripts/check/generation-models.ts`, and `node --import tsx scripts/check/generation-orchestration.ts`.
- [ ] **Step 2: Run `npm test`.** Expected: all suites/assertions pass. If the known Jest open handle remains after the success summary, record it; do not add `--forceExit`.
- [ ] **Step 3: Run `npx tsc --noEmit`, `npm run lint`, and `git diff --check`.** Expected: all exit zero and lint has no warnings.
- [ ] **Step 4: Run `npx expo export --platform web --output-dir /tmp/himu-creative-web`** and serve locally to confirm `/`, `/create-dj.html`, and `/create-track.html` return 200 without static-render errors.
- [ ] **Step 5: Run `npx expo-doctor` as informative and `npx expo export --platform android --output-dir /tmp/himu-creative-android`.** Do not publish or use production credentials. If Expo Doctor is not locally installed and restricted networking prevents it from starting, record that exact limitation; the Android export remains required.
- [ ] **Step 6: Run a curated EN/ES quality matrix** with at least calm instrumental, intense instrumental, calm vocal, and intense vocal DJ traits. Verify three distinct identities, non-generic titles, complete lyrics, correct locale, and granular regeneration. Use test/non-production provider configuration.
- [ ] **Step 7: Audit privacy and secrets:** confirm no service-role/provider secret enters client files or web bundle; anonymous/non-owner SQL/API attempts cannot read `track_private_details`; public track payloads omit lyrics.
- [ ] **Step 8: Review `git status`, commit only any feature-scoped verification fixes, and report migrations/deploy order:** database migration → `creative-draft` → `create-dj`/`update-dj` → `generate-mix` → app build. Include rollback cautions for new RPC signatures.

## Implementation readiness

The plan is ready for execution after the current web/auth and quality-test changes are safely committed or copied into the chosen isolated worktree; starting from bare `develop` without those changes is not acceptable. The recommended execution mode is subagent-driven development with a fresh review at each task boundary; inline execution with `superpowers:executing-plans` is also valid.
