# Creative Generation Design

**Status:** Ready for user review

**Date:** 2026-08-12

**Scope:** DJ identity drafts and confirmed track-generation briefs. No product code in this change.

## Goal

Make creation feel authored rather than automatic. Himu should use the DJ traits the user already chose to propose distinctive identity, title, lyric, and creative-direction drafts, while requiring the user to select, edit, or replace every draft before it affects a DJ or track.

This design does not replace the existing DJ-characteristics form. Genres, moods, energy, vocal/instrumental mode, vibe, and visibility remain the source of truth and retain their current controls and validation.

## Repository constraints

The current implementation establishes these boundaries:

- `DjTraitsForm` owns name plus the existing genre, mood, energy, sound, and vibe inputs. Creation and training share this component.
- `create-dj` validates the traits again on the server, stores `vibe` as both `djs.character` and `personality_traits.vibe`, and derives the private `base_prompt` from the traits.
- The DJ profile permits optional user lyrics only for a user-owned vocal DJ. The client accepts 1,000 characters and the Edge Function revalidates ownership, vocal mode, length, and control characters.
- `generate-mix` currently chooses a generic random title only after audio generation. The title is therefore neither previewed nor submitted by the user.
- `generation_jobs.prompt` currently holds retry lyrics. It has no structured record of a confirmed title, creative direction, or intention.
- The finished `tracks` row stores the title but not lyrics or the generation brief. This design adds private owner-readable confirmed lyrics and immutable version lineage.
- Manual generation allows one active job per user and DJ and uses an atomic RPC for quota reservation. New behavior must preserve that concurrency, quota, lease, and recovery logic.
- Native and web share the generation hooks. The design must not alter the platform-specific authentication and session boundaries.

## Design decision

Use an authenticated, stateless creative-draft service for suggestions and a versioned, server-validated generation brief for the final confirmed request.

The initial draft request may return related fields together, while every subsequent request names exactly one field to regenerate. Drafting does not create a DJ, reserve a music-generation quota, create a generation job, or start media generation. Only the final explicit confirmation invokes the existing create or generate operation.

### Alternatives considered

1. **Recommended: dedicated draft service plus confirmed brief.** This cleanly separates inexpensive text ideation from long-running music/avatar generation, supports granular retry, and makes the final request reproducible. It adds one Edge Function boundary and a small amount of persisted job metadata.
2. **Extend `create-dj` and `generate-mix` to generate missing copy implicitly.** This changes fewer endpoints, but it cannot provide a real preview and risks silently substituting model output. It also makes granular retry and error recovery inseparable from expensive generation.
3. **Generate suggestions from local word lists.** This is fast and offline-friendly, but repeats the current generic title problem and cannot produce complete lyrics or trait-aware identity concepts. Local templates remain useful only as an explicit fallback, not the primary experience.

## Product flow

### DJ creation

1. The user completes the existing DJ traits and visibility controls. The traits flow is not repeated or redesigned.
2. When the traits are valid, the creation experience requests three identity candidates. Each candidate contains:
   - a DJ name;
   - a one- or two-sentence identity concept;
   - no unconfirmed changes to the underlying traits.
3. The user selects one candidate, edits its name and concept, regenerates all three suggestions, or switches to a fully custom name and concept.
4. Any trait change marks current identity suggestions stale. The screen preserves user-edited text but clearly offers regeneration from the updated traits; it never silently replaces the edit.
5. The create action remains disabled until a valid name and concept are present and the user has actively selected or entered them.
6. The final create action presents the existing visibility choice and a compact identity summary. Pressing the action is the explicit confirmation. Only then is `create-dj` invoked.

The creation version of the shared traits form must no longer be responsible for the name input. The training flow may continue to edit the saved name, but implementation should extract a small reusable traits-only section rather than fork six trait controls. This is a targeted component-boundary change, not a traits redesign.

### Track creation

1. On an owned DJ profile, the user starts “Create track.” This opens a preparation state before any generation request.
2. Himu builds a concise intention from the saved DJ signals:
   - primary and secondary styles from genre specialties;
   - energy from `personality_traits.energy`;
   - vocal or instrumental mode from `personality_traits.isInstrumental` and the server-owned generation config;
   - the saved vibe and confirmed DJ identity concept;
   - a lyric theme for vocal tracks, derived from the editable direction or supplied explicitly by the user.
3. The draft service proposes:
   - one editable track title;
   - one editable creative-direction summary;
   - for vocal tracks only, complete lyrics with at least a verse and chorus, normally using a clear section structure such as `[Verse 1]`, `[Chorus]`, and an additional verse or bridge when appropriate;
   - a short explanation of the creative direction. This explanation is editable and becomes part of the generation brief, not hidden prompt text.
4. The user can edit or replace any field. They can paste custom lyrics and use a custom title.
5. “Regenerate title,” “Regenerate lyrics,” and “Regenerate direction” each replace only that field. The request includes the other current fields as context and an exclusion list for recent discarded outputs, but those other fields remain byte-for-byte unchanged.
6. Instrumental tracks never request, display, store, or submit lyrics. Track preparation does not edit saved DJ traits. If a refresh reveals that the DJ changed from vocal to instrumental elsewhere, preparation removes lyrics from the outgoing brief after a visible warning and requires reconfirmation.
7. A final review displays the editable direction, title, vocal status, lyric theme or “instrumental,” and visibility. The primary action says what it will do (for example, “Confirm and generate”).
8. The user must press that final action. Draft completion, field blur, navigation, or timeout can never start generation.
9. Any edit or field regeneration after confirmation begins must cancel the local confirmation state. If the server has already accepted a job, the immutable accepted brief remains attached to that job; the UI must not imply that later local edits affect it.

## State and component responsibilities

Names describe responsibilities rather than mandatory filenames.

### `CreativeDraftClient`

- Calls the authenticated draft Edge Function through the existing auth-scoped invocation helper.
- Accepts `kind`, locale, normalized context, current accepted fields, and recent exclusions.
- Exposes independent pending and error state per draft kind so one failed retry does not disable other edits.
- Does not persist drafts globally or invoke media generation.

### `DjIdentityDraftStep`

- Receives validated `DjTraits` without owning or recollecting them.
- Displays exactly three candidates and custom-entry controls.
- Tracks candidate provenance (`suggested`, `edited`, or `custom`) and explicit selection.
- Invalidates only candidate freshness when traits change.
- Returns one confirmed identity value to the existing create mutation.

### `TrackPreparationController`

- Loads the owned DJ and creates a local `GenerationBriefDraft`.
- Keeps title, direction, lyrics, lyric theme, visibility, and confirmation status independent.
- Prevents generation if the DJ is not owned, data is stale or missing, a draft request is active, validation fails, or an active generation already exists.
- Uses the current activity system only after the final generation mutation succeeds.

### `GenerationBriefEditor`

- Renders the title, creative direction, mode, theme, and conditional lyrics.
- Supports custom content and granular regeneration.
- Makes draft provenance visible in accessible copy, but does not privilege AI text over user text.
- Shows character counts and inline validation before the final preview.

### `GenerationConfirmation`

- Presents the exact values that will be submitted.
- Requires a deliberate press; it has no automatic submit path.
- Freezes a client snapshot for the request and prevents duplicate submissions while acceptance is pending.

### Edge Functions

- A new authenticated creative-draft function generates and validates text drafts.
- Existing `create-dj` accepts the confirmed identity concept in addition to the existing traits.
- Existing `generate-mix` accepts a confirmed generation brief instead of generating a title internally for manual jobs.
- Daily drops stay on the existing automatic-title and automatic-lyrics path. They are outside this manual ownership flow.

## Contracts and data flow

### Draft request

Use one versioned endpoint with a discriminated request:

```ts
type CreativeDraftRequest =
  | {
      version: 1;
      kind: "dj-identity";
      language: "en" | "es";
      traits: DjTraitSnapshot;
      exclude?: string[];
    }
  | {
      version: 1;
      kind: "track-brief" | "track-title" | "lyrics" | "creative-direction";
      language: "en" | "es";
      djId: string;
      current: Partial<GenerationBriefDraft>;
      exclude?: string[];
    };
```

For track requests the server loads the DJ, verifies ownership, and reads the private generation config. The client does not submit or receive `base_prompt`, service credentials, or other server-only configuration. For pre-creation identity requests, the server runs the same catalog, length, and trait validation used by `create-dj` before calling a text model.

Responses are structured JSON, not free-form text. The server strips formatting noise, bounds every string, verifies the requested language, rejects duplicate identity candidates after normalization, and rejects a malformed or incomplete lyric structure. It returns a stable error code and no partial field when validation exhausts its limited repair attempt.

### Confirmed DJ identity

Add a dedicated nullable `identity_concept text` column to `djs`. Do not overload `character`: it currently represents the user’s vibe and is displayed as “Sonic Philosophy.” Existing rows remain valid with a null concept.

`create-dj` receives `name`, `identityConcept`, the unchanged traits, and visibility. It validates the name with the existing rules and validates a concise concept with explicit length and control-character limits. `buildBasePrompt` includes the confirmed concept as bounded context while retaining every existing trait. The avatar prompt may use the concept only after confirmation.

### Confirmed generation brief

Manual `generate-mix` receives:

```ts
type ConfirmedGenerationBriefV1 = {
  version: 1;
  title: string;
  creativeDirection: string;
  mode: "instrumental" | "vocal";
  lyricTheme: string | null;
  lyrics: string | null;
  visibility: "private" | "public";
  traitSnapshot: {
    genres: string[];
    moods: string[];
    energy: number;
    vibe: string | null;
    identityConcept: string | null;
  };
};
```

The server treats the saved DJ/config as authoritative for ownership and vocal mode. It compares the request mode with the config, rebuilds the trait snapshot itself, and ignores a client-authored snapshot if it differs. The snapshot returned to the job is therefore server-derived.

Add a nullable, versioned `generation_brief jsonb` to `generation_jobs` for manual jobs. Legacy and daily jobs may remain null. Extend the atomic manual reservation RPC to write the validated brief in the same transaction that reserves quota. Retain `prompt` during compatibility rollout; new manual jobs should use `generation_brief`, and retry readers should prefer the brief and fall back to legacy `prompt` lyrics.

The music prompt uses the confirmed creative direction and lyrics within existing bounded, framed prompt construction. Manual completion uses the confirmed title and removes the current `creativeTitle()` call from only the manual path. Daily drops retain current behavior.

The accepted brief is immutable once the job is queued. Recovery retries reuse that same brief. A new creative attempt requires returning to preparation and explicitly confirming a new job after the prior job reaches a terminal state.

### Finished lyrics and track versioning

Confirmed vocal lyrics persist after completion as owner-readable, non-public data associated with the finished track. Instrumental tracks have no lyrics record. Public lyric display and public lyric access are explicitly deferred; current public track queries and responses must not expose the private data.

Add nullable `source_track_id uuid references tracks(id) on delete set null` columns to both `generation_jobs` and `tracks`. Add a separate `track_private_details` table keyed by `track_id`, with `owner_id` and non-null `confirmed_lyrics`; enable RLS and permit selects only when `owner_id = auth.uid()`. Keeping lyrics out of `tracks` prevents existing public track projections from exposing them accidentally. The generation finalization transaction copies accepted vocal lyrics from the immutable job brief into `track_private_details`; instrumental tracks have no private-details row. The first generated track and job have a null `source_track_id`.

Editing lyrics after completion never mutates the finished track, audio object, or accepted brief. The owner starts a new preparation flow seeded from the original track's private lyrics and confirmed brief, edits and reconfirms it, and generates a new track. The new job records the original track ID as its version source; its resulting track stores that ID in `source_track_id`. Each version owns independent audio, cover, title, lyrics, visibility, and immutable brief. Deleting or hiding a later version does not alter earlier versions. This phase exposes direct parent linkage only; version-tree browsing and public version labels are deferred.

## Validation and safety

- Preserve the existing DJ name length and character rules unless user research justifies a later change. Suggestions must already satisfy them.
- Identity concept: 10-240 characters after trimming, free of control characters and URLs.
- Title: 2-80 characters after trimming, safe for display, and not equal to the DJ name. Reject generic fallback combinations and normalized duplicates from the exclusion list.
- Creative direction: 10-500 characters. Lyric theme: null for instrumental tracks and 2-120 characters for vocal tracks. Both are control-character filtered and treated as untrusted data inside provider prompts.
- Lyrics: vocal-only; raise the current 1,000-character limit only after verifying provider prompt budgets and database/retry impact. Until then, generated drafts must fit the existing limit. Require recognizable verse and chorus sections without requiring English labels in Spanish output.
- All model text is untrusted. Frame user/model content separately from fixed provider instructions, retain the current anti-prompt-injection boundary strategy, and never expose service-role or provider credentials.
- `track_private_details.confirmed_lyrics` is readable only to the owner. Anonymous and non-owner track projections cannot join or select that row even for public tracks.
- Draft service authorization, rate limits, request-size limits, timeouts, and abuse logging are independent of music quota. Draft retries must not consume the three daily music-generation slots.
- Bound exclusions to the ten most recent normalized values, with at most 80 characters per value. The client drops older entries.
- Do not claim uniqueness across the music industry. Apply local quality checks against Himu’s existing DJ names, the user’s recent suggestions/titles, repeated word-pair lists, and prohibited impersonation or artist-copy patterns.
- Prompts require original output and must not request imitation of a living artist or copyrighted lyrics. User-pasted lyrics remain the user’s responsibility and are handled as data, not instructions.

## Quality safeguards

1. Build prompts from structured traits, locale, current creative direction, and explicit exclusions instead of a generic “write a name/title” instruction.
2. Require three meaningfully distinct DJ candidates: different normalized names and different concept angles.
3. Reject internal fallback title pairs already used by `creativeTitle()` for user-prepared manual tracks.
4. Ask for concrete imagery, point of view, and a memorable hook in vocal drafts while forbidding references to named artists or existing songs.
5. Run deterministic post-generation checks before returning a draft: length, structure, duplicate phrases, empty sections, locale, and prohibited controls.
6. Allow at most one server-side repair pass for malformed model output. After that, return a recoverable error instead of low-quality copy.
7. Keep recent discarded outputs in bounded local state and send normalized exclusions on regeneration. Do not create an unlimited suggestion-history table in this phase.
8. Label every suggestion as a draft and retain user edits exactly unless the user chooses regeneration.

## Error and recovery behavior

- If identity drafting fails, traits remain intact. The user can retry or proceed with a fully custom name and concept.
- If one track field fails to regenerate, preserve its previous value and all other fields. Show an inline error next to that action.
- Offline preparation permits editing already loaded local draft text but disables new AI suggestions and final generation. Do not promise cross-device or app-restart draft recovery in this phase.
- If auth changes during a request, discard its result using the existing auth-scope protections and do not show another user’s drafts.
- If DJ traits change on the server during preparation, the final server validation returns a `brief_stale` conflict with the authoritative snapshot. Preserve user text, refresh the summary, and require reconfirmation.
- If another active job exists, return the existing job through current idempotency behavior. Never overwrite its accepted brief with a newer local draft.
- If a requested `sourceTrackId` is missing, not owned by the current user, or belongs to another DJ, reject the version request without revealing the source track's private lyrics.
- Quota, ownership, timeout, provider, and malformed-model errors use stable codes mapped to localized user messages. Provider error bodies remain server-side.
- Navigation away before confirmation performs no server mutation. Navigation after job acceptance relies on the existing activity/recovery system.

## Test strategy

Implementation follows test-driven development for every behavior change.

### Pure and contract tests

- DJ trait snapshots normalize identically in create and draft endpoints.
- Draft response parsing rejects malformed JSON, duplicate candidates, generic banned pairs, invalid locale, oversized fields, and incomplete vocal lyrics.
- Granular regeneration changes only the requested field and retains all user-edited context.
- Brief validation enforces vocal/instrumental invariants and prompt budgets.
- Prompt builders frame lyrics and creative direction as data and never interpolate secrets.

### Edge Function tests

- Identity drafting works before DJ creation only with valid authenticated traits.
- Track drafting requires ownership and loads the authoritative server config.
- Draft retries do not reserve music quota or create generation jobs.
- Manual reservation atomically stores the confirmed brief, preserves active-job idempotency, and rejects stale trait snapshots.
- Manual generation uses the confirmed title, direction, and lyrics; daily-drop behavior remains unchanged.
- Failure and lease recovery reuse the immutable accepted brief.
- Finalization copies confirmed vocal lyrics into the owner-private track field and records valid direct-parent version lineage.
- Non-owner and anonymous reads cannot obtain confirmed lyrics; an owner can load them to seed a new explicitly confirmed version.

### Hook and screen tests

- Three candidates render; selection, edit, custom entry, and regeneration require explicit action.
- Trait changes mark suggestions stale without erasing edits.
- Vocal preparation displays lyrics; instrumental preparation never does.
- Pasting custom lyrics and editing title/direction survive unrelated regeneration.
- Opening a completed owned vocal track can seed a new preparation draft; saving it creates a distinct job and track while preserving the original track and audio.
- The final generation mutation cannot run without a confirmation press.
- Editing after preview invalidates confirmation.
- Offline, auth-scope change, stale brief, quota, and field-level draft failures preserve recoverable user input.
- Accessibility tests cover labels, pending/disabled state, field errors, candidate selection, and confirmation summary.

### Regression and release checks

- Existing create/train traits tests continue to pass.
- Existing active-job, retry, quota, visibility, privacy, and ownership tests continue to pass.
- Android native and web auth/session suites remain unchanged and green.
- TypeScript, lint, full Jest, Edge Function tests, Expo web export, and the relevant Android static/build check form the implementation gate.

## Delivery boundaries

### In scope

- Draft-generation contracts and authenticated server boundary.
- DJ identity proposal/selection/customization before creation.
- Track title, creative direction, and conditional complete lyric drafting.
- Granular regeneration and an explicit final confirmation.
- Persisted confirmed generation brief for reliable job execution and retry.
- Necessary focused migrations, localized copy, validation, and tests.

### Out of scope

- Reworking genre, mood, energy, mode, vibe, or visibility controls.
- Changing authentication/session architecture.
- Audio preview snippets, stems, mastering controls, model selection, or multiple generated audio candidates.
- In-place editing of a finished track’s audio, title, lyrics, or accepted brief. Lyric changes create a new linked track version instead.
- Draft autosave or cross-device synchronization.
- Monetization, subscription tiers, or paid draft quotas.
- Daily Drop authoring changes.
- Broad DJ profile, player, or visual redesign.

## Implementation sequencing

1. Extract shared server validation and define versioned draft/brief contracts with tests.
2. Add the creative-draft Edge Function and deterministic output validation.
3. Add identity concept storage, confirmed-brief job storage, private finished lyrics, and direct-parent track-version storage/RPC compatibility migrations.
4. Add client draft hooks and state machines with auth-scope handling.
5. Integrate the DJ identity step without changing existing trait controls.
6. Integrate track preparation, granular regeneration, and confirmation.
7. Make manual generation consume the confirmed brief while retaining daily/legacy compatibility.
8. Run regression, web export, and Android checks; then validate output quality with a small curated prompt matrix in English and Spanish.

## Approved lyric retention decision

Confirmed vocal lyrics persist after completion as owner-readable private data. Public lyric display and access remain out of scope. Later lyric edits create a new linked track version with new audio and a new immutable accepted brief; the original track, audio, lyrics, and brief are never overwritten.
