# Private Media Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close finding 4 by ensuring newly generated and existing private audio is stored outside the public CDN and is playable only through owner-authorized short-lived URLs.

**Architecture:** Public media remains in the current R2 public bucket, while private track and caption audio is stored in a separate non-public R2 bucket and represented by validated `r2-private://` references. An authenticated Edge Function verifies row ownership and returns a five-minute SigV4 GET URL. The main and caption players resolve private references at playback time, and an idempotent operational script migrates existing private public objects safely.

**Tech Stack:** Cloudflare R2 S3 API, `aws4fetch`, Supabase Edge Functions/Deno TypeScript, React Native/Expo Audio, Jest, Node `tsx`, Supabase JS.

**Spec:** `docs/superpowers/specs/2026-08-23-security-findings-remediation-design.md`

## Global Constraints

- `R2_PRIVATE_BUCKET` must have no public custom domain.
- Public generated media and Audius playback must remain direct and cacheable.
- Private database rows store only `r2-private://<generated-key>`, never a permanent public URL or persisted presigned URL.
- Track audio authorization is owner-or-public; caption audio authorization is generation-job owner only.
- Presigned URLs expire after five minutes and are never persisted in Zustand, PostgreSQL, or React Query.
- An auth change while resolution is pending must prevent playback under the new account.
- Existing private public objects are deleted only after private copy verification and successful database update.
- Every production behavior change follows RED, GREEN, then refactor.

---

### Task 1: Private Media Reference Contract

**Files:**
- Create: `supabase/functions/_shared/media-reference.ts`
- Create: `scripts/check/media-reference.ts`

**Interfaces:**
- Produces: `privateMediaReference`, `parsePrivateMediaReference`, and `parseGeneratedPublicKey`.

- [ ] **Step 1: Write failing reference tests**

```ts
assert.equal(
  privateMediaReference("tracks/generated/job/attempt.mp3"),
  "r2-private://tracks/generated/job/attempt.mp3",
);
assert.deepEqual(
  parsePrivateMediaReference("r2-private://tracks/generated/job/attempt.mp3", "track"),
  { key: "tracks/generated/job/attempt.mp3", kind: "track" },
);
assert.equal(parsePrivateMediaReference("https://public.example/private.mp3", "track"), null);
assert.equal(parsePrivateMediaReference("r2-private://avatars/generated/a.jpg", "track"), null);
assert.equal(parsePrivateMediaReference("r2-private://tracks/generated/../secret", "track"), null);
```

Also test caption keys under `captions/generated/` and reject query strings, fragments, control characters, encoded traversal, and non-generated prefixes.

- [ ] **Step 2: Run to verify RED**

Run: `node --import tsx scripts/check/media-reference.ts`

Expected: module-not-found for `media-reference.ts`.

- [ ] **Step 3: Implement strict reference parsing**

Use anchored regular expressions over decoded-free ASCII keys:

```ts
const TRACK_KEY = /^tracks\/generated\/[A-Za-z0-9._%:-]+\/[A-Za-z0-9._%:-]+\.mp3$/;
const CAPTION_KEY = /^captions\/generated\/[A-Za-z0-9._%:-]+\/[A-Za-z0-9._%:-]+\.mp3$/;
```

Reject `..`, `%2e`, backslashes, `?`, `#`, and control characters before matching. Return null for any kind/prefix mismatch.

- [ ] **Step 4: Run to verify GREEN**

Run: `node --import tsx scripts/check/media-reference.ts`

Expected: PASS.

- [ ] **Step 5: Commit the reference boundary**

```bash
git add supabase/functions/_shared/media-reference.ts scripts/check/media-reference.ts
git commit -m "fix: define opaque private media references"
```

### Task 2: Dual-Bucket R2 and Short-Lived Signing

**Files:**
- Modify: `supabase/functions/_shared/r2.ts`
- Create: `supabase/functions/_shared/r2-contract.ts`
- Create: `scripts/check/r2-contract.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: strict media references.
- Produces: `r2Put(key,bytes,type,access)`, `r2Delete(keys,access)`, `r2PresignPrivateGet(key,expiresSeconds)`, and `keyFromStoredMedia`.

- [ ] **Step 1: Write failing pure contract tests**

Extract environment-independent URL/bucket decisions into `r2-contract.ts` and test:

```ts
assert.deepEqual(
  storageTarget("private", "tracks/generated/j/a.mp3", env),
  { bucket: "himu-private", reference: "r2-private://tracks/generated/j/a.mp3" },
);
assert.deepEqual(
  storageTarget("public", "tracks/generated/j/a.mp3", env),
  { bucket: "himu-public", reference: "https://media.example/tracks/generated/j/a.mp3" },
);
assert.throws(() => storageTarget("private", "tracks/generated/j/a.mp3", { ...env, privateBucket: "" }));
```

- [ ] **Step 2: Run to verify RED**

Run: `node --import tsx scripts/check/r2-contract.ts`

Expected: module-not-found for `r2-contract.ts`.

- [ ] **Step 3: Implement explicit storage targets**

Define:

```ts
export type R2Access = "public" | "private";
export type R2Environment = {
  accountId: string;
  publicBucket: string;
  privateBucket: string;
  publicBase: string;
};
```

`storageTarget` returns an S3 object URL and stored reference. It throws if the selected bucket/base is missing and never falls back from private to public.

- [ ] **Step 4: Update R2 operations**

`r2Put` chooses the correct bucket, uses `Cache-Control: private, no-store` for private bytes and `public, max-age=300` for public bytes, and returns the target's stored reference. `r2Delete` requires explicit access. `keyFromStoredMedia` parses either a generated public CDN URL or validated private reference and returns `{ key, access }`.

`r2PresignPrivateGet` builds the private S3 object URL with `X-Amz-Expires=300`, calls `await r2.sign(url, { method: "GET", aws: { signQuery: true } })`, and returns `signed.url.toString()`. Clamp expiry to 60-300 seconds.

- [ ] **Step 5: Document the required environment**

Add:

```dotenv
R2_PRIVATE_BUCKET=your-private-bucket-name  # no public custom domain
```

Keep `R2_BUCKET` and `R2_PUBLIC_BASE` for public media.

- [ ] **Step 6: Run checks GREEN**

Run:

```bash
node --import tsx scripts/check/r2-contract.ts
node --import tsx scripts/check/media-reference.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit dual-bucket storage**

```bash
git add .env.example supabase/functions/_shared/r2.ts supabase/functions/_shared/r2-contract.ts scripts/check/r2-contract.ts
git commit -m "fix: separate private audio storage"
```

### Task 3: Generation Writes Private Audio Authoritatively

**Files:**
- Modify: `scripts/check/generation-orchestration.ts`
- Modify: `supabase/functions/generate-mix/generation-orchestration.ts`
- Modify: `supabase/functions/generate-mix/index.ts`
- Modify: `supabase/functions/delete-dj/index.ts`

**Interfaces:**
- Consumes: explicit R2 access mode.
- Produces: private track/caption references for private jobs and bucket-aware cleanup.

- [ ] **Step 1: Write failing generation tests**

Record all `r2Put` calls and assert a private manual brief uses private access for track audio, a public manual brief uses public access, and Daily Drop caption/track audio uses private access:

```ts
assert.deepEqual(calls.r2Put.map(({ key, access }) => [key, access]), [
  [expectTrackKey, "private"],
  [expectCaptionKey, "private"],
]);
```

Preserve existing public cover behavior.

- [ ] **Step 2: Run to verify RED**

Run: `node --import tsx scripts/check/generation-orchestration.ts`

Expected: assertion/type failure because `r2Put` has no access argument.

- [ ] **Step 3: Carry authoritative access through generation**

Add `isPublic: boolean` to `RunGenerationInput` for both daily and manual jobs. Set it only from the reserved job/validated brief. Derive:

```ts
const audioAccess: R2Access = input.isPublic ? "public" : "private";
```

Pass `audioAccess` to track and caption uploads. Keep covers public. Make cleanup track the access associated with each uploaded key so failures delete from the correct bucket.

- [ ] **Step 4: Wire index dependencies**

Update the R2 dependency signature and every `runGeneration` call to use the reservation/job's `isPublic`, never the raw request value.

- [ ] **Step 5: Update delete-DJ cleanup**

Replace `keyFromPublicUrl` with `keyFromStoredMedia`, partition keys into public/private sets, delete each set from its authoritative bucket, and continue ignoring external URLs.

- [ ] **Step 6: Run focused checks GREEN**

Run:

```bash
node --import tsx scripts/check/generation-orchestration.ts
node --import tsx scripts/check/cover-orchestration.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Challenge all audio upload paths**

Run:

```bash
rg -n "r2Put\(|audio/mpeg|caption.*generated|tracks/generated" supabase/functions
```

Expected: every generated private audio call receives explicit private access; no helper default can silently publish it.

- [ ] **Step 8: Commit generation storage changes**

```bash
git add scripts/check/generation-orchestration.ts supabase/functions/generate-mix/generation-orchestration.ts supabase/functions/generate-mix/index.ts supabase/functions/delete-dj/index.ts
git commit -m "fix: keep private generated audio off public CDN"
```

### Task 4: Authenticated Private Media URL Edge Function

**Files:**
- Create: `supabase/functions/private-media-url/handler.ts`
- Create: `supabase/functions/private-media-url/index.ts`
- Create: `scripts/check/private-media-url-function.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `parsePrivateMediaReference` and `r2PresignPrivateGet`.
- Produces: POST `private-media-url` with `{ kind: "track", trackId }` or `{ kind: "caption", jobId }`, returning `{ url, expiresIn: 300 }`.

- [ ] **Step 1: Write failing pure handler tests**

Test invalid input, missing row, non-owner private track, owner private track, public track passthrough rejection, caption owner, caption non-owner, malformed stored reference, and signing failure. The owner case asserts only the validated database key reaches `signPrivateGet`:

```ts
const result = await handlePrivateMediaUrlRequest(
  { kind: "track", trackId: TRACK_ID },
  "owner",
  dependencies({
    loadTrack: async () => ({ ownerId: "owner", isPublic: false, audioRef: PRIVATE_REF }),
  }),
);
assert.deepEqual(result, {
  status: 200,
  body: { url: "https://signed.example/object", expiresIn: 300 },
});
assert.deepEqual(calls.signedKeys, ["tracks/generated/job/attempt.mp3"]);
```

- [ ] **Step 2: Run to verify RED**

Run: `node --import tsx scripts/check/private-media-url-function.ts`

Expected: module-not-found for the handler.

- [ ] **Step 3: Implement the pure handler**

Use UUID validation, stable errors, and dependency types:

```ts
type PrivateMediaDependencies = {
  loadTrack: (trackId: string) => Promise<{ ownerId: string | null; isPublic: boolean; audioRef: string | null } | null>;
  loadCaption: (jobId: string) => Promise<{ userId: string; audioRef: string | null } | null>;
  signPrivateGet: (key: string, expiresSeconds: number) => Promise<string>;
};
```

Return 403 before parsing/signing a non-owner row. Accept only private references for this endpoint; public media plays directly.

- [ ] **Step 4: Implement the authenticated index**

Use `serveAuthed`, POST-only method validation, JSON parsing, admin selects limited to the required columns, and `r2PresignPrivateGet`. Do not return stored references or keys in errors.

- [ ] **Step 5: Configure the Edge Function**

Add the function's standard JWT/auth configuration consistent with other authenticated functions in `supabase/config.toml`; do not disable JWT verification.

- [ ] **Step 6: Run checks GREEN**

Run:

```bash
node --import tsx scripts/check/private-media-url-function.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit the URL boundary**

```bash
git add supabase/functions/private-media-url/handler.ts supabase/functions/private-media-url/index.ts scripts/check/private-media-url-function.ts supabase/config.toml
git commit -m "fix: authorize private media URLs"
```

### Task 5: Auth-Scoped Client Media Resolution

**Files:**
- Create: `src/audio/private-media.ts`
- Create: `src/audio/__tests__/private-media-test.ts`
- Modify: `src/audio/player-provider.tsx`
- Modify: `src/audio/__tests__/player-provider-auth-test.tsx`

**Interfaces:**
- Consumes: `invokeWithAuthScope`, `r2-private://` references, and `private-media-url`.
- Produces: `resolveTrackPlaybackUrl(track, scope)` and auth-safe player loading.

- [ ] **Step 1: Write failing resolver tests**

Assert public/Audius URLs bypass Edge Functions, private references invoke the function with captured Authorization, malformed private references fail closed, and errors do not return the original opaque reference as a playable URL.

```ts
await expect(resolveTrackPlaybackUrl(privateTrack, scope, functions)).resolves.toBe(
  "https://signed.example/private.mp3",
);
expect(functions.invoke).toHaveBeenCalledWith("private-media-url", {
  body: { kind: "track", trackId: privateTrack.id },
  headers: { Authorization: scope.authorization },
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npm test -- src/audio/__tests__/private-media-test.ts --runInBand`

Expected: module-not-found for `private-media.ts`.

- [ ] **Step 3: Implement the resolver**

Only references beginning `r2-private://` invoke the Edge Function. Validate the response URL as HTTPS, require `expiresIn` between 60 and 300, call `assertCurrentMutationUser(scope.userId)` after awaiting, and return the short-lived URL without caching it.

- [ ] **Step 4: Write the failing player auth-race test**

Return a deferred signed URL for user A, switch auth state to B, resolve A's request, and assert `player.replace` never receives A's signed URL and playback does not start.

- [ ] **Step 5: Run the player test to verify RED**

Run: `npm test -- src/audio/__tests__/player-provider-auth-test.tsx --runInBand`

Expected: FAIL because the current `load` immediately replaces the opaque URL.

- [ ] **Step 6: Make player loading auth-safe**

Make `load` await `resolveTrackPlaybackUrl` before committing the new track or calling `player.replace`. Capture the current auth scope at the start, discard on auth changes, and return `false` without disturbing the existing player when resolution fails. Public tracks retain synchronous network behavior apart from the already-Promise API.

- [ ] **Step 7: Run resolver/player tests GREEN**

Run:

```bash
npm test -- src/audio/__tests__/private-media-test.ts src/audio/__tests__/player-provider-auth-test.tsx src/audio/__tests__/player-provider-session-test.tsx --runInBand
npx tsc --noEmit
```

Expected: all PASS.

- [ ] **Step 8: Commit client track resolution**

```bash
git add src/audio/private-media.ts src/audio/__tests__/private-media-test.ts src/audio/player-provider.tsx src/audio/__tests__/player-provider-auth-test.tsx
git commit -m "fix: resolve private tracks with owner auth"
```

### Task 6: Private Caption Audio Resolution

**Files:**
- Modify: `src/hooks/use-daily-drop.ts`
- Modify: `src/components/home/CaptionVoiceButton.tsx`
- Create: `src/components/home/__tests__/CaptionVoiceButton-test.tsx`
- Modify: `src/hooks/__tests__/use-daily-drop-test.tsx`

**Interfaces:**
- Consumes: `private-media-url` caption mode.
- Produces: caption playback resolved by authoritative job ID.

- [ ] **Step 1: Expose the caption job identity with a failing hook test**

Extend `DailyDrop` with `captionJobId: string | null`. For a ready Daily Drop, assert it equals the polled job ID and is null for idle/failed states.

- [ ] **Step 2: Run hook test RED**

Run: `npm test -- src/hooks/__tests__/use-daily-drop-test.tsx --runInBand`

Expected: FAIL because `captionJobId` is absent.

- [ ] **Step 3: Implement the hook field**

Return the current authoritative job ID only when caption audio exists. Do not resolve or persist a signed URL in the hook.

- [ ] **Step 4: Write failing caption component tests**

Pass `{ audioRef, jobId }`, press the control, and assert a private reference invokes `private-media-url` with caption mode before `voice.replace`/play. Add an auth-switch deferred test that proves A's URL is discarded.

- [ ] **Step 5: Run component test RED**

Run: `npm test -- src/components/home/__tests__/CaptionVoiceButton-test.tsx --runInBand`

Expected: FAIL because the component initializes Expo Audio directly from the stored reference.

- [ ] **Step 6: Resolve caption audio on demand**

Initialize the isolated player without a source. On press, capture auth scope, resolve `{ kind: "caption", jobId }`, recheck scope, replace with the signed URL, seek, and play. Public caption URLs remain direct for rollout compatibility.

- [ ] **Step 7: Run caption checks GREEN**

Run:

```bash
npm test -- src/components/home/__tests__/CaptionVoiceButton-test.tsx src/hooks/__tests__/use-daily-drop-test.tsx --runInBand
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit caption resolution**

```bash
git add src/hooks/use-daily-drop.ts src/hooks/__tests__/use-daily-drop-test.tsx src/components/home/CaptionVoiceButton.tsx src/components/home/__tests__/CaptionVoiceButton-test.tsx
git commit -m "fix: authorize private caption playback"
```

### Task 7: Existing Private Media Migration

**Files:**
- Create: `scripts/migrate/private-media.ts`
- Create: `scripts/migrate/private-media-runner.ts`
- Create: `scripts/migrate/__tests__/private-media-test.ts`
- Modify: `package.json`
- Modify: `docs/GETTING_STARTED.md`

**Interfaces:**
- Consumes: Supabase service role, public/private R2 buckets, generated public URLs.
- Produces: `npm run migrate:private-media -- --dry-run` and resumable bounded migration.

- [ ] **Step 1: Write failing migration-order tests**

Use dependency injection for list, copy, head/verify, row update, and source delete. Assert exact order:

```ts
assert.deepEqual(events, [
  "copy:tracks/generated/job/a.mp3",
  "verify:tracks/generated/job/a.mp3",
  "update:track-id:r2-private://tracks/generated/job/a.mp3",
  "delete-public:tracks/generated/job/a.mp3",
]);
```

Test dry-run performs none of those mutations, copy failure preserves DB/source, update failure preserves source, already-private rows are skipped, and a resumed batch reports zero remainder.

- [ ] **Step 2: Run to verify RED**

Run: `npm test -- scripts/migrate/__tests__/private-media-test.ts --runInBand`

Expected: module-not-found for the migration module.

- [ ] **Step 3: Implement the pure migration engine**

Define explicit row unions for private tracks and private caption jobs. Validate every source through `parseGeneratedPublicKey`, copy bytes server-to-server, verify content length/etag when available, update only when the old URL still matches, then delete public source. Return counts `{ scanned, migrated, skipped, failed, remaining }`.

- [ ] **Step 4: Implement the environment runner**

Parse only `--dry-run`, `--batch-size=<1..500>`, and `--cursor=<uuid>`. Require all Supabase/R2 variables and fail before mutation when `R2_PRIVATE_BUCKET` is absent or equals `R2_BUCKET`. Never print secret values or signed requests.

- [ ] **Step 5: Add scripts and deployment documentation**

```json
"migrate:private-media": "node --env-file=.env --import tsx scripts/migrate/private-media-runner.ts"
```

Document private bucket creation, Edge secret configuration, dry-run, live run, resume, zero-remainder verification, and rollback constraints in `docs/GETTING_STARTED.md`.

- [ ] **Step 6: Run tests GREEN**

Run:

```bash
npm test -- scripts/migrate/__tests__/private-media-test.ts --runInBand
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Run dry-run against configured data**

Run: `npm run migrate:private-media -- --dry-run --batch-size=100`

Expected: no writes/deletes and a report of remaining public private-audio rows. Without a configured distinct private bucket and reachable Supabase project, release remains incomplete.

- [ ] **Step 8: Commit the migration tool**

```bash
git add package.json docs/GETTING_STARTED.md scripts/migrate/private-media.ts scripts/migrate/private-media-runner.ts scripts/migrate/__tests__/private-media-test.ts
git commit -m "feat: migrate existing private audio safely"
```

### Task 8: Cloudflare/Supabase Deployment and Finding Verification

**Files:**
- Modify only if deployment validation exposes a defect.

**Interfaces:**
- Consumes: completed provider-admission plan and Tasks 1-7 here.
- Produces: deployed private bucket/function/migration state and final evidence for all five findings.

- [ ] **Step 1: Verify Cloudflare private bucket state**

Using the Cloudflare plugin or Wrangler, confirm/create the named `R2_PRIVATE_BUCKET`, confirm it has no public development URL or custom domain, and confirm service credentials can PUT/GET/DELETE through the S3 API. Do not expose credential values.

- [ ] **Step 2: Configure Supabase Edge secrets and deploy functions**

Configure `R2_PRIVATE_BUCKET` plus existing R2 credentials for Edge Functions, apply the database migration, and deploy changed/new functions. Use linked-project/plugin operations and preserve existing function JWT enforcement.

- [ ] **Step 3: Run the operational migration**

Run dry-run first, then live bounded batches until `remaining = 0`. Verify a sample migrated database reference is `r2-private://...` and its former public URL returns 404/denied while the private-media endpoint returns an owner-only five-minute URL.

- [ ] **Step 4: Run complete repository verification**

Run:

```bash
npm run check:security-remediation-migration
npm run check:security-quota-invariants
npm run check:creative-generation
npm run check:creative-generation-migration
npm run check:creative-draft-function
node --import tsx scripts/check/generation-orchestration.ts
node --import tsx scripts/check/cover-orchestration.ts
node --import tsx scripts/check/private-media-url-function.ts
node --import tsx scripts/check/media-reference.ts
node --import tsx scripts/check/r2-contract.ts
npx tsc --noEmit
npm test -- --runInBand
npm run lint
npx expo export --platform web
```

Expected: every command exits 0 with zero failed tests/errors.

- [ ] **Step 5: Reproduce the original private-audio attack and legitimate control**

Malicious control: request the former/new private object URL without authentication and assert denied; request `private-media-url` as another user and assert 403. Legitimate control: owner resolves and streams the short-lived URL; public/Audius tracks still play directly.

- [ ] **Step 6: Run a follow-up security verification**

Run a focused Codex Security verification or diff scan across the remediation commit range. Require all five original source-to-sink paths to be closed and investigate any new reportable finding before completion.

- [ ] **Step 7: Write the final remediation report**

For each finding, record changed files, malicious reproducer result, legitimate control result, exact verification commands, deployment/migration evidence, and any remaining uncertainty. Do not mark the objective complete unless private-bucket configuration, production data migration, and all required checks are evidenced.
