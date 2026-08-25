# HiMu Beta UX Design

**Status:** Ready for user review

**Date:** 2026-08-25

**Scope:** Public pre-auth introduction, first-track continuation, progressive DJ creation, post-track music preferences, first-party product telemetry, and the supporting additive data contracts. No product code in this change.

## Summary

HiMu's public beta should move a new listener from understanding the product to creating a first original track without making them configure the whole application up front. The experience will explain the promise before authentication, preserve the listener's intent through authentication, guide them through only the DJ decisions needed for creation, and ask for optional long-term music preferences after the first track is ready.

The redesign keeps HiMu's current visual language and generation architecture. It changes information hierarchy and navigation rather than introducing a second design system. It also removes preference controls that currently promise behavior the product does not implement and replaces them with one explicit atmosphere preference that affects both eligible automatic queues and generated music.

The approved work is delivered in three implementation phases:

1. experience-state foundation, first-party telemetry, public introduction, and first-track continuation;
2. progressive Create DJ flow and continuation into Create track;
3. compact music preferences, effective atmosphere behavior, and the one-time post-track preference nudge.

`PostTrackExperience` is an extension boundary only in this scope. A shareable “HiMu Moment,” clips, and feedback questions are deferred.

## Goals

- Explain HiMu's core promise in three short pre-auth steps.
- Preserve “Create my first track” intent across web OAuth and native authentication.
- Take a new authenticated user directly to the next valid creation step.
- Reduce simultaneous choices in Create DJ without reducing the traits that shape output.
- Reduce Music Preferences to decisions that have a truthful, testable effect.
- Give calm, balanced, and intense atmosphere choices real downstream behavior.
- Ask for long-term preferences only after a first owned track is successfully ready.
- Preserve current offline, auth-scope, async activity, visibility, and server-validation guarantees.
- Deliver equal functional completeness and release quality on Android and web from shared logical state, while using platform-native interaction patterns.
- Resolve phones, tablets, orientations, narrow web, wide web, zoom, and enlarged text without clipping, unreachable controls, or a platform-specific dead end.
- Measure the activation funnel without collecting creative text or introducing a third-party analytics SDK.

## Non-goals

- Building HiMu Moment, shareable audio/video clips, or post-track feedback questions.
- Adding payment, subscriptions, entitlements, commercial licenses, or rights claims.
- Redesigning Create track, the player, Home, Discover, the DJ profile, or the full application shell.
- Replacing the current visual system, typography, spacing, glass surfaces, or navigation paradigm.
- Turning Train DJ into the same creation wizard. Training reuses compact controls but remains an editing screen.
- Replacing the weighted queue heuristic with a semantic or model-based recommender.
- Deleting legacy onboarding data or legacy `music_preferences` columns.
- Adding draft autosave or cross-device recovery for an unfinished DJ wizard.
- Allowing a preference to override an explicit per-track direction or a required DJ invariant.
- Creating mockups, prototypes, or visual-comparison artifacts.

## Current repository constraints

The implementation must respect these existing boundaries:

- Root navigation currently protects the auth group while signed out and product routes while signed in. Web Google auth redirects to the browser origin; native Google auth returns a session in place.
- The current onboarding runs only for an authenticated user and stores a versioned local/server mirror in `user_onboarding`. It includes two modal welcome pages, three Home spotlight steps, contextual tips, continuation, and replay.
- Profile already exposes a replay action. It can become the discoverable Help entry for the new introduction without adding a new navigation area.
- Home sends a user with an owned DJ to Create track and a user without one to Create DJ. Create track currently requires ownership of the selected DJ.
- Create DJ and Train DJ share `DjTraitsForm`. The Edge Functions independently require one to three catalog genres, one to three catalog moods, integer energy from 1 to 10, vocal/instrumental mode, a valid name, and a valid identity concept.
- Create DJ currently renders all trait controls, identity candidates, identity inputs, visibility, and review in one document. `ResponsiveFormShell` changes their layout at 1024 px, but it does not control which step is visible.
- Identity drafting already protects against stale and out-of-order responses. Those correctness properties must survive the new step timing.
- Creation remains an asynchronous activity that can finish after the origin screen unmounts. Navigation must not create a second submission or require a blocking birth overlay.
- Music Preferences currently persists genres, excluded moods, a two-axis `vibe_mapping`, `ai_frequency`, and `discovery_depth`. The original table also retains `bpm_range` and `focus_modes`.
- Only preferred genres and excluded moods have consumers today. The two vibe sliders, AI frequency, discovery depth, BPM range, and focus modes do not affect the product.
- Preferred genres can weight Home ordering and can add a compatible genre emphasis to generated music. Excluded moods filter Home automatic shelves and Focus Mode. They do not block direct playback or requested generation.
- The project already provides readable and wide canvases, responsive breakpoints at 768 and 1024 px, glass cards, accessible buttons, `StateNotice`, safe-area spacing, and browser checks at compact, desktop, and effective 200% zoom widths.

## Design decision

Use a progressive, outcome-first flow built from the existing system:

- a public, resumable three-step introduction;
- a small post-auth route resolver for first-track intent;
- a real three-step DJ wizard that mounts one active editing step at a time;
- one readable-column preferences screen with progressive pickers;
- an additive experience-state row that keeps new lifecycle state separate from legacy onboarding;
- a first-party, allowlisted product-event collector;
- additive preference storage and server-owned preference interpretation.

### Alternatives considered

1. **Recommended: progressive flows with explicit state boundaries.** This solves the activation and saturation problems while reusing current contracts, async activity, tokens, and server validation. It requires navigation state, one additive experience table, one additive preference column, and focused component extraction.
2. **Collapse the current long pages without changing flow state.** This would be faster but would leave the Create DJ progress rail decorative, keep duplicated review content, continue drafting identity while the user is still changing traits, and fail to preserve first-track intent through auth.
3. **Use a conversational one-question-per-screen flow.** This minimizes each decision but adds too many transitions for returning users, fragments review and correction, and requires more state and instrumentation than the beta needs.

## Experience architecture

```text
Signed out, intro unseen
        |
        v
Public Product Intro -- final CTA --> pending first_track intent
        |                                  |
        +-- existing user ----------------> Login
                                           |
                                           v
                                      FirstTrackGate
                                        /        \
                              owned DJ /          \ no owned DJ
                                      v            v
                                Create track    Create DJ wizard
                                                       |
                                                       v
                                                 Create track
                                                       |
                                                       v
                                            first owned track ready
                                                       |
                                                       v
                                      optional preference nudge
                                                       |
                                                       v
                                           Music Preferences
```

The intro, intent resolver, DJ wizard, preferences, and post-track nudge are independent units. Each owns one state transition and communicates through typed data rather than route-specific assumptions.

## Cross-platform quality contract

Android and web are co-primary release targets. Neither is a reference implementation for a secondary adaptation. A phase is incomplete if its happy path, recovery path, accessibility contract, or responsive matrix passes on only one platform.

### Shared behavior, native presentation

Controllers, schemas, validation, query keys, mutations, analytics contracts, localized copy, and state transitions are shared. Platform-specific presentation boundaries may differ only where the native interaction model differs:

- Android uses safe-area-aware screens, hardware Back, keyboard avoidance, touch-first controls, and modal bottom sheets for catalog selection.
- Web uses stable URLs, browser Back/Forward, reload-safe route guards, keyboard and focus management, semantic dialogs, responsive content containers, and browser zoom reflow.

The same user can complete every approved action on either platform: view/replay the intro, authenticate, resume first-track intent, create a DJ, create a track, respond to the post-track nudge, and edit all three effective preferences. Error recovery, offline explanation, visibility choice, identity fallback, and cancellation are not allowed to be platform-exclusive.

Shared components must own semantic content and state. A `.native` or `.web` component may own sheet versus dialog rendering, focus trapping, URL synchronization, keyboard avoidance, or safe-area placement, but it must expose the same typed selection/result contract. No platform-specific component may silently apply a different limit, default, validation rule, persistence behavior, or analytics event.

### Layout modes and environmental modifiers

Layout decisions use the effective content viewport after safe areas, browser chrome, and any persistent application rail. They use the existing 768 px and 1024 px boundaries as three bands rather than one desktop switch:

- **compact, below 768 px:** one content column, one active wizard editor, compact progress, actions in normal scroll flow;
- **medium, 768-1023 px:** centered readable content with more breathing room, compact or horizontal progress, and adaptive sheet/dialog width; do not force a desktop three-column form;
- **wide, 1024 px and above:** optional rail/editor/summary composition when the content container has sufficient width.

Width is not the only input. A viewport under 600 px high is a low-height environment: disable sticky review/action regions, remove vertical centering that can hide content, and keep all actions in scroll flow. Rotation and browser resizing recompute presentation without replacing the controller, clearing input, repeating accepted navigation, or issuing a duplicate identity request.

Canvas maximums remain authoritative. Wide screens center content instead of stretching cards or text to the full viewport. Compact screens never reduce horizontal page padding below safe readable/touch spacing. Forms and dialogs have no horizontal document overflow.

### Platform navigation and input behavior

On Android:

- safe-area insets protect headers, sheets, and the final action in portrait and landscape;
- an open sheet closes before hardware Back changes wizard step;
- hardware Back moves Review to Identity, Identity to Sound, and only then exits through the dirty-draft decision;
- opening the software keyboard scrolls the focused field and its validation into view without covering the active action;
- rotating or resizing preserves current selections, custom identity text, active step, and pending state;
- TalkBack receives the same step, selection, busy, error, and completion announcements as the visual UI.

On web:

- the public intro uses `/welcome?step=1|2|3`; replay adds `mode=replay`, and invalid query values canonicalize to the first valid step without creating intent;
- authentication remains `/login`, the post-auth resolver is `/first-track`, Create DJ is `/create-dj?returnIntent=first_track` when applicable, Create track remains `/create-track?djId=<owned-dj-id>` (plus its existing optional `sourceTrackId`), and preferences remain `/preferences`;
- reload restores the valid intro page, and Back/Forward traverses intro steps without duplicating completion, intent creation, or analytics;
- replay mode is represented in the URL but cannot create first-track intent;
- `FirstTrackGate`, Create DJ, Create track, and Preferences have stable URLs and replace/push history according to the flow rules in this specification;
- a direct or reloaded Create DJ URL that requests Identity or Review without valid route-local draft state safely returns to Sound instead of fabricating state;
- dialogs trap focus, restore it to the opener, close with Escape, and make background content inert while open;
- all actions work without hover and expose visible keyboard focus;
- browser zoom changes the effective CSS viewport and triggers normal reflow rather than a special scaled desktop view.

### Responsive acceptance matrix

Every new route and surface must pass the applicable rows below in English and in the longer Spanish copy. Dimensions are logical/CSS pixels.

| Surface | Verification viewport | Required presentation |
|---|---|---|
| Android compact phone, portrait | 320x640 and 360x800 | Compact single column; header, current step, errors, and CTA fit by vertical scroll; no horizontal clipping. |
| Android large phone, portrait | 390x844 and 430x932 | Compact single column with comfortable spacing; bottom chrome/safe area never covers the CTA. |
| Android phone, landscape | 640x320 and 844x390 | Low-height compact/medium reflow; no sticky region; keyboard and CTA remain reachable by scroll. |
| Android tablet, portrait | 768x1024 and 800x1280 | Medium readable column; controls do not stretch edge to edge; sheet width and height remain bounded. |
| Android tablet, landscape | 1024x768 and 1280x800 | Wide composition only when all regions meet minimum widths; otherwise medium reflow; rotation preserves state. |
| Web narrow | 320x640 and 390x844 | Compact document flow; no horizontal document scrollbar; dialog falls back to viewport-safe presentation. |
| Web medium/tablet-like | 768x1024 and 1023x768 | Medium readable layout; correct reflow on orientation-sized resize; no assumed mouse-only interaction. |
| Web desktop | 1024x768, 1440x900, and 1920x1080 | Wide layout where applicable, centered max-width canvas, bounded line length, one logical action and focus order. |
| Web low-height/zoomed | effective 720x422 and 512x384 | Compact/medium scroll flow, no sticky obstruction, dialog content scrolls, final action focusable and reachable. |
| Enlarged text | Android font scale 1.0, 1.5, and critical-flow smoke at 2.0; web page zoom 100%, 200% | Text wraps without overlap or loss; controls grow or reflow; no label is available only through truncation. |

For every row:

- `scrollWidth` must not exceed the viewport/content container except inside an explicitly horizontal media scroller; none of the flows in this specification requires such a scroller;
- headings, selected values, validation, and primary/secondary actions remain visible through reflow or reachable by ordinary scrolling;
- every interactive target remains at least 44 by 44 logical pixels and is not hidden under system UI, application chrome, keyboard, or another fixed element;
- the CTA occurs once in semantic/source order and can receive accessibility focus;
- content may become taller but may not be clipped, overlaid, or made unreachable;
- a layout/orientation change preserves controller state and does not submit, navigate, save, or contact a creative provider by itself.

## Phase 1: experience foundation and onboarding

### Public product introduction

The introduction is a full-screen public route, not a modal over authenticated Home. It has three ordered pages:

1. **From an emotion to a track.** Explain that an idea, emotion, or moment becomes an original track.
2. **Choose who shapes it.** Explain that the listener creates a DJ with its own sound and personality.
3. **Listen, save, and share.** Explain the immediate result without promising commercial rights, exclusivity, or a paid capability.

Pages one and two use a primary “Continue” action. Page three uses the exact primary action “Create my first track.” Every page also exposes a secondary “I already have an account” action. The secondary action marks the public introduction seen on that installation and goes to authentication without setting first-track intent.

All layout modes use the same page order, labels, and state. Phones show one centered card inside safe areas. Tablets and web keep one centered readable card rather than placing all three promises side by side. Landscape and low-height viewports use top-aligned scroll flow instead of vertical centering. This preserves the intentionally short sequence and prevents a large screen from becoming a denser, semantically different experience.

The user can go backward without losing the current page. The final CTA is the only action that establishes first-track intent. Swiping may supplement buttons on touch devices but cannot be the only navigation mechanism.

### First-time and replay rules

Before authentication, completion is installation-scoped because HiMu does not yet know the user. Store an intro record under a versioned device/browser key such as `himu:intro:v2` with the highest seen version and completion timestamp.

- A signed-out installation with no current-version record opens the public introduction.
- A signed-out installation with the record opens Login.
- A valid existing session continues to the authenticated app and is never forced through the public introduction.
- Replay mode ignores eligibility but never changes the stored completion record or creates first-track intent.
- Profile renames the existing replay action to “How HiMu works” and opens the same three pages in replay mode.

The current authenticated welcome and Home spotlight tour must stop auto-starting. Its `user_onboarding` rows, migrations, local records, and components remain intact for compatibility and rollback. This phase does not reinterpret, migrate, or delete them. Legacy contextual tips remain dormant unless a later Help design explicitly reintroduces them.

### Pending navigation intent

The final intro CTA stores this bounded record in secure storage before navigating to Login:

```ts
type PendingNavigationIntent = {
  version: 1;
  kind: "first_track";
  source: "public_intro_v2";
  createdAt: string;
};
```

The intent expires 24 hours after `createdAt`. This is long enough for OAuth interruption and ordinary retry but prevents a surprising redirect days later. Malformed, unsupported, or expired records are deleted and treated as no intent.

Authentication failure or cancellation keeps an unexpired intent. Explicitly choosing “I already have an account” never creates one. Explicit cancellation from the first-track flow clears it. A successful route resolution consumes it only after the destination is known; a transient DJ lookup failure retains it for retry.

### `FirstTrackGate`

`FirstTrackGate` is a protected route with no creative controls. It resolves one question using the current authenticated user and the owned-DJ query:

- while auth or DJs are unresolved, show a dedicated loading state;
- if loading fails with no cached answer, show a retryable `StateNotice` and retain the intent;
- if exactly one owned DJ exists, replace the gate with Create track for that DJ and clear the intent;
- if no owned DJ exists, replace the gate with Create DJ carrying `returnIntent=first_track` and clear the storage record only after Create DJ accepts ownership of that return intent;
- if data violates the one-DJ product invariant, query owned DJs in deterministic `created_at ASC, id ASC` order, select the earliest result, and record a non-content telemetry anomaly;
- if the user explicitly cancels, clear the intent and replace the route with Home.

The route never chooses a public or another user's DJ. It does not create a DJ, reserve generation quota, or generate a draft.

### Experience state

Add a separate authenticated table rather than overloading `user_onboarding`:

```sql
create table public.user_experience_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  intro_version_seen integer not null default 0 check (intro_version_seen >= 0),
  first_owned_track_id uuid references public.tracks(id) on delete set null,
  first_owned_track_ready_at timestamptz,
  preference_nudge_status text not null default 'ineligible'
    check (preference_nudge_status in
      ('ineligible', 'eligible', 'shown', 'dismissed', 'completed')),
  preference_nudge_track_id uuid references public.tracks(id) on delete set null,
  preference_nudge_shown_at timestamptz,
  preference_nudge_dismissed_at timestamptz,
  preference_nudge_completed_at timestamptz,
  updated_at timestamptz not null default now()
);
```

Enable RLS. Authenticated users may select only their own row. State-changing writes use bounded RPCs or an authenticated server path; clients do not receive general update permission. Service-role generation finalization may set first-track eligibility.

State is monotonic:

- `intro_version_seen` can only increase;
- the first track fields are first-writer-wins;
- nudge state may move `ineligible -> eligible -> shown -> dismissed`;
- `eligible` or `shown` may move directly to `completed`;
- `dismissed` may later move to `completed` after an explicit preference save;
- `completed` is terminal;
- timestamps are set only by their corresponding transition and never move backward.

Do not backfill existing generated tracks as new first tracks. Existing accounts with completed tracks remain `ineligible`. For a user with no earlier owned completed AI-generated track, successful finalization of the first new track atomically records the track and moves the nudge to `eligible`. This avoids surprising established accounts and makes the beta cohort measurable.

### First-party telemetry

Add one product analytics facade used by screens and controllers. Product code emits semantic events and does not depend on a storage vendor.

The initial sink is a HiMu-owned Edge collector and service-role-only `product_events` table. The collector accepts authenticated or anonymous calls, assigns or validates an idempotent event ID, derives authenticated user ID from the verified token rather than the body, bounds the payload to 4 KB, validates an event-specific property schema, and rate-limits repeated anonymous installation IDs. The table is not selectable or writable by ordinary clients.

Allowed initial events are:

- `intro_viewed`, `intro_step_viewed`, `intro_completed`;
- `auth_started`, `auth_succeeded`, `auth_failed`;
- `first_track_gate_resolved`, `first_track_intent_cancelled`;
- `dj_creation_started`, `dj_step_completed`, `dj_identity_draft_succeeded`, `dj_identity_draft_failed`, `dj_created`, `dj_creation_failed`;
- `track_generation_confirmed`, `track_generation_ready`, `track_generation_failed`;
- `preference_nudge_shown`, `preference_nudge_accepted`, `preference_nudge_dismissed`;
- `music_preferences_saved`.

Properties may include event/flow version, platform, locale, step identifier, elapsed milliseconds, selected-count buckets, route outcome, and stable error category. They must not include an idea, title, lyrics, creative direction, vibe text, DJ name, identity concept, mood comment, generated prompt, provider response, URL, email, or other free text.

Pre-auth events use a random installation ID and session ID stored locally. `auth_succeeded` may associate that installation funnel with the authenticated user; this linkage must be disclosed in the privacy notice. Analytics failures are non-blocking. The client keeps a small bounded retry queue, drops oldest events first, and never retries indefinitely.

## Phase 2: progressive Create DJ

### Wizard state

Create DJ becomes a real state machine:

```ts
type CreateDjStep = "sound" | "identity" | "review";

type CreateDjWizardState = {
  step: CreateDjStep;
  traits: DjTraits;
  intensityChoice: "calm" | "balanced" | "intense";
  identity: DjIdentityDraftValue;
  identityFingerprint: string | null;
  identityFreshness: "missing" | "fresh" | "stale";
  visibility: "private" | "public";
  returnIntent: "first_track" | null;
};
```

Only the active editing step renders in the compact editor. State remains mounted in the route controller while moving backward and forward. Review derives from that state and does not own duplicate editable values.

### Step 1: Sound

The first step asks only for traits that affect the DJ:

- one to three genres;
- one to three moods;
- intensity: Calm, Balanced, or Intense;
- Instrumental or Vocal;
- optional custom vibe text under “Add a personal detail.”

Genres and moods use a shared progressive catalog picker. The closed control shows selected chips, count, and “Choose” or “Edit.” Opening it presents a bottom sheet on Android and a dialog on web. It includes search, grouped accordions with at most one group open, a stable selected-items tray, the current count/limit, and an explicit Done action. Search filters canonical localized labels but stores canonical catalog values.

The DJ limits remain the server limits: one to three genres and one to three moods. Attempts beyond the limit announce the limit and leave the current selection unchanged.

Intensity maps to the unchanged numeric server contract:

| Choice | Submitted energy |
|---|---:|
| Calm | 3 |
| Balanced | 6 |
| Intense | 9 |

New creation defaults to Balanced. This mapping is product UI semantics, not a database migration. Instrumental remains the default sound mode. Vibe remains optional, bounded by the existing 140-character server validation, and is never sent to telemetry.

Continue is enabled only when genre and mood requirements are valid. Advancing freezes a trait fingerprint made from canonical genres, moods, submitted energy, mode, and normalized vibe.

### Step 2: Identity

Entering Identity with a valid fingerprint requests exactly three identity candidates when no fresh result exists for that fingerprint. Changing controls within Sound does not draft in the background. Returning to Identity without changing the fingerprint reuses current candidates and performs no provider request.

The initial presentation contains candidates first. Selecting a candidate fills the name and concept but does not create the DJ. Name and concept inputs appear only after “Edit” or “Write my own.” “Try new suggestions” replaces all three candidates through the existing bounded exclusion behavior.

Pressing Continue performs the explicit identity confirmation and advances to Review. It replaces the current redundant combination of candidate selection plus a separate confirm button. A custom or edited identity must satisfy the current name and concept validation before Continue is enabled.

If drafting fails, keep all Sound state and show a recoverable inline error with Retry and “Write my own.” Never substitute a silent generic identity. Preserve existing request-generation tokens, fingerprint checks, and late-response rejection.

If the user returns to Sound and changes any fingerprint trait:

- preserve current name and concept text;
- mark identity stale and unconfirmed;
- prevent final creation;
- request fresh candidates only when Identity is entered again;
- allow the user to continue with the preserved custom text only after explicitly reconfirming it against the new traits.

Visibility changes do not invalidate identity.

### Step 3: Review and creation

Review shows one compact summary of:

- confirmed DJ name and identity concept;
- localized genres and moods;
- intensity label, not only the numeric value;
- Instrumental or Vocal;
- optional personal detail when present;
- Private or Public visibility and its plain-language consequence.

Visibility is chosen here and defaults to Private. Each summary group has an Edit action that returns to the owning step. The one final primary CTA is “Bring my DJ to life.” No field blur, candidate selection, timer, route transition, or draft response can invoke creation.

While the create mutation is pending, editing and the final action are disabled, accessibility exposes busy state, and Back remains available. Leaving the route does not cancel an accepted server request; the existing Activity system reports success or failure once.

On success:

- an ordinary creation replaces the route with the DJ profile;
- a wizard carrying `returnIntent=first_track` replaces it with Create track using the new DJ ID;
- the return intent is consumed once and cannot cause another navigation after remount;
- an auth-scope change suppresses navigation for the previous user.

On error, remain on Review, retain all state, map stable quota/validation/provider categories to localized copy, and never display raw provider errors.

### Back and abandonment

- Back from Review returns to Identity.
- Back from Identity returns to Sound.
- Android hardware Back follows the same rule.
- Back from Sound exits. If the state differs from defaults, ask whether to discard the local DJ draft; Stay is the safe/default action.
- Explicit discard clears the route-local return intent and returns to the source. It does not clear a newly established authenticated session.
- No server mutation occurs before the final creation action.

### Responsive behavior

Compact and medium layouts show one active step, “Step n of 3,” an accessible progress indicator, and one bottom action in normal scroll flow with safe-area padding. Medium tablet layouts increase usable card width and spacing without revealing later editing steps. The action is reachable with the keyboard open and in phone/tablet landscape or small-height web viewports.

At 1024 px and above, keep the existing wide canvas when its measured regions can maintain their minimum widths. A real step rail appears on the left, the active editor occupies the center, and a compact derived summary may stay on the right. If a tablet landscape viewport or enlarged text cannot satisfy those minimums, reflow to medium instead of squeezing or overflowing. The rail reflects state and can navigate only to completed or current steps; it cannot skip validation. At effective 200% browser zoom the presentation resolves from the effective CSS viewport and retains source order.

The component tree and controller do not fork by platform. Platform-specific files may own only dialog/sheet presentation details.

### Train DJ compatibility

Extract reusable catalog picker, intensity choice, mode choice, and optional-detail controls instead of forking `DjTraitsForm` logic. Train DJ remains a single editing flow and keeps name and portrait behavior.

Existing saved energies from 1 to 10 display in the nearest band:

- 1-4: Calm;
- 5-7: Balanced;
- 8-10: Intense.

Training preserves the exact saved integer when the user edits another field. It submits 3, 6, or 9 only after the user explicitly changes the intensity band. This prevents an unrelated save from rewriting legacy DJ energy.

## Phase 3: truthful Music Preferences

### Information architecture

Music Preferences uses the readable canvas and one vertical column at every phone, tablet, and web width. Large screens center the column; they do not convert sections into a two-column settings grid. Low-height and enlarged-text environments extend vertical scroll instead of reducing card content. The page has three sections, in this order:

1. Favorite genres;
2. Usual atmosphere;
3. Moods to avoid.

The subtitle states that these are defaults for automatic suggestions and generated tracks, not hard constraints on an explicit request.

The screen remains accessible from Profile at all times. It is never part of the public introduction, authentication, Create DJ validation, or first generation gating.

### Favorite genres

The closed section shows current selected chips and “Choose genres” or “Edit genres.” The shared progressive picker supports up to five favorites. An empty selection means HiMu explores different genres without an explicit genre bonus.

Existing rows with more than five genres are loaded and displayed without truncation or reordering. The user may remove any selection, but adding remains disabled until the count is below five. Persistence never silently drops legacy values.

Favorite genres retain their current effects:

- a matching Home candidate receives the explicit-genre weight bonus;
- generated music may receive one compatible genre emphasis when that genre also belongs to the current DJ;
- recent listening top genre remains ahead of explicit genres when choosing that single generation emphasis.

### Atmosphere

Replace both `vibeMapping` sliders with one accessible radiogroup:

- **Calm:** favors lower-energy automatic recommendations and restrained generated dynamics;
- **Balanced:** applies no queue energy bias and requests a controlled, moderate dynamic arc for generated music;
- **Intense:** favors higher-energy automatic recommendations and more driving generated dynamics.

The value is a tendency. It never blocks a track, rewrites DJ traits, changes the selected model, or overrides explicit track direction.

Add an additive column:

```sql
alter table public.music_preferences
add column atmosphere text not null default 'balanced'
check (atmosphere in ('calm', 'balanced', 'intense'));
```

Existing rows receive Balanced. Do not infer atmosphere from `vibe_mapping` because that UI had no product consumer and its axes do not encode the new semantic choice. Older clients continue to work because the database supplies the default.

The new client preference type reads and writes `genres`, `moods`, and `atmosphere`. It stops selecting or updating `vibe_mapping`, `ai_frequency`, and `discovery_depth`. The database retains those columns, plus `bpm_range` and `focus_modes`, for rollback and old-client compatibility. Their removal is a separate future migration.

### Atmosphere queue behavior

Extend eligible Home track projections with `energy_level` and extend the current taste weights with atmosphere. Preserve the current weighted shuffle and inject its random source in tests.

For each eligible candidate:

```text
weight = 1
       + 2 when genre is an explicit favorite
       + 2 when genre is the recent listening top genre
       + 2 when atmosphere=calm and energy_level is 1-4
       + 2 when atmosphere=intense and energy_level is 7-10
```

Balanced adds no energy bonus. Missing energy adds no atmosphere bonus. Mood exclusion remains a hard pre-filter on known `mood_tags`; genre and atmosphere remain probabilistic ordering signals, not eligibility rules.

Apply this behavior to the time-contextual Home shelf and AI Mixes. Focus Mode continues its feature-specific calm ordering and uses only excluded moods from the global taste profile. Fresh tracks, On Air, direct playback, library, favorites, and Discover remain unchanged in this scope.

Daily Drop Audius candidate eligibility is also unchanged in this scope. Its generated-music fallback receives the atmosphere generation clause because it shares generation seasoning. Copy must therefore say “automatic recommendations” rather than promise that every Daily Drop or untagged item observes exclusions.

### Atmosphere generation behavior

The server, not the client, loads `music_preferences.atmosphere` alongside genres when building generation seasoning. It maps the canonical value to a bounded catalog-owned clause:

| Atmosphere | Generation clause |
|---|---|
| Calm | `listener preference: restrained dynamics, softer transients, and a gentle energy arc` |
| Balanced | `listener preference: balanced dynamics, controlled contrast, and a moderate energy arc` |
| Intense | `listener preference: driving dynamics, pronounced contrast, and a high-energy arc` |

The clause is framed as low-priority listener context. Prompt authority remains:

1. explicit confirmed per-track direction and lyrics;
2. authoritative saved DJ mode and traits;
3. global music preferences;
4. time-of-day seasoning.

The existing static `music_full` model selection and cost guard do not change. Manual generation and generated Daily Drop fallback receive the clause. Audius track selection does not.

An absent row or invalid legacy value resolves to Balanced. A preference read failure logs only the stage and continues with time-of-day context; it does not fail or retry the music job.

### Moods to avoid

The shared picker supports up to three excluded moods. An empty selection means no global mood exclusions. Existing rows with more than three values receive the same preserve-but-do-not-add behavior as over-limit genres.

Known excluded `mood_tags` are removed from the time-contextual Home shelf, AI Mixes, and Focus Mode before ranking. Tracks with no mood metadata remain eligible. Exclusions do not block direct playback, manual generation, library access, favorites, or Discover. Daily Drop selection is not expanded in this phase.

### Persistence and save behavior

Keep the current cumulative optimistic commit queue and per-user query key. Rapid changes serialize into cumulative snapshots. A failed save rolls back only the failed intent while preserving newer local intent; auth changes make late completions invisible.

The screen adds a compact, polite live status:

- “Saving” while a snapshot is in flight;
- “Saved” after the latest local intent is confirmed;
- the existing translated rollback toast and inline cached-data warning on failure.

Offline with cached data keeps selections readable and exposes the offline notice; new changes are not queued indefinitely and explain that reconnection is required. Offline without data shows the blocking offline state before skeletons. Initial loading uses three preference-section skeletons rather than track-row skeletons.

### Post-track preference nudge

`PostTrackExperience` is a result-adjacent controller rendered when the user opens the highlighted first owned track recorded in `user_experience_state`. In this phase it can render only one non-modal preference card.

The card says that preferences can make the next result feel closer to the listener. It offers:

- primary: “Choose my preferences”;
- secondary: “Not now.”

It never covers playback, save, or share actions. Claim `eligible -> shown` before displaying it so two devices do not both present it. If the claim cannot complete offline, do not block the track and retry eligibility on a later eligible result open.

Accepting records `preference_nudge_accepted`, navigates to Music Preferences, and leaves state `shown` until an explicit preference save moves it to `completed`. “Not now” atomically moves it to `dismissed`. Dismissed is not shown again, but a later manual preference save may move it to `completed`.

The controller owns no clip rendering, share media, feedback questions, or comments. A later HiMu Moment feature may add sibling cards or steps through this boundary without changing first-track eligibility or preference persistence.

## Component responsibilities

Names describe boundaries rather than mandatory filenames.

### `PublicProductIntro`

- Owns three-page navigation and installation eligibility.
- Runs signed out or in authenticated replay mode.
- Creates first-track intent only from the final creation CTA.
- Contains no auth implementation and no product data query.

### `PendingIntentStore`

- Validates, expires, reads, and consumes the versioned secure-storage record.
- Has no routing knowledge beyond the intent discriminant.
- Serializes writes so OAuth return and auth observers cannot consume twice.

### `FirstTrackGate`

- Resolves authenticated user plus owned-DJ state into one route outcome.
- Owns loading, retry, cancellation, and intent consumption.
- Never owns DJ or track creation.

### `ExperienceStateClient`

- Reads the current user's monotonic experience row.
- Calls narrow client-authorized transition RPCs for intro sync and nudge shown/dismissed/completed.
- The generation finalizer, not this client, invokes the server-only first-track transition after verified successful track completion.
- Rejects stale auth scope and never exposes another user's row.

### `CreateDjWizardController`

- Owns steps, route-local draft state, validation, freshness, visibility, and return intent.
- Requests identity only on valid Identity entry or explicit regeneration.
- Delegates final creation to the existing auth-scoped mutation and Activity system.

### `ProgressiveCatalogPicker`

- Presents canonical groups through search and one-open accordion disclosure.
- Supports caller-supplied min/max, selected values, localized labels, and legacy over-limit mode.
- Does not persist or infer preference semantics.

### `AtmosphereChoice`

- Presents the three canonical values as a radiogroup.
- Is shared by preferences and DJ intensity copy but uses caller-provided value mapping.
- Never writes a numeric DJ energy when used for global preferences.

### `MusicPreferencesController`

- Loads the current user's V2 preference projection.
- Owns the optimistic commit queue, save status, limits, rollback, and query invalidation.
- Does not decide recommendation or prompt behavior.

### `TasteProfile` and server seasoning

- `TasteProfile` derives client queue inputs from explicit preferences and recent listening.
- Pure queue utilities filter and weight candidates.
- Server seasoning independently reloads authoritative preferences for generation.
- Neither trusts a client-submitted atmosphere to control server generation.

### `PostTrackExperience`

- Reads/claims experience-state eligibility for the opened result.
- Renders non-blocking post-track modules in stable priority order.
- Contains only the preference nudge in this phase.

### `ProductAnalytics`

- Exposes typed event names and typed bounded properties.
- Owns installation/session IDs and bounded retry.
- Never accepts arbitrary free-form property objects from product screens.

## Accessibility requirements

- Every interactive target is at least 44 by 44 logical pixels.
- Genre and mood options use checkbox semantics with selected and disabled state.
- Atmosphere, DJ intensity, sound mode, identity candidates, and visibility use radiogroup/radio semantics.
- Group headers expose expanded/collapsed state. Dialog/sheet focus enters the title or search field and returns to the opener on close.
- Selection counts, maximum-limit rejections, save status, step changes, loading completion, and recoverable errors use polite live announcements; blocking errors use alert semantics.
- Step transitions move accessibility focus to the new step heading and announce “Step n of 3.”
- Selected controls use text/check/icon state in addition to color.
- Web supports Tab, Shift+Tab, Enter, Space, Escape, and arrow-key movement where the native control pattern requires it.
- Android hardware Back follows wizard semantics and closes a picker before changing a wizard step.
- Reduced-motion settings disable decorative page and disclosure transitions.
- Android font scaling through 1.5 is a full release contract; critical paths at 2.0 must remain operable even when they require more scrolling. Web page zoom at 200% must reflow without two-dimensional scrolling.
- Labels may wrap or allow the control to grow. Truncation may not be the only way to access a selected value, validation message, step title, or action label.
- Copy remains selectable where it communicates errors, identity concepts, or saved summaries.
- The final action remains in document order and reachable at effective 200% zoom.

## Error and recovery behavior

- Intro storage failure still permits authentication; it reports a non-blocking telemetry storage category and may show the intro again on a later launch.
- Pending-intent corruption or expiry clears the record and routes to ordinary Home after auth.
- A DJ query failure at the gate never routes to Create DJ based on absence; only a successful empty result may do so.
- Picker search and disclosure are local and work offline once catalog code is loaded.
- Identity drafting offline or provider failure retains traits and permits custom identity entry, but final DJ creation still requires connectivity.
- Changing traits invalidates identity confirmation without deleting user text.
- Duplicate create presses are prevented while the mutation is pending. An accepted request continues through Activity after navigation.
- Preference initial-load, cached-refetch, offline, rapid-save, rollback, and auth-scope behavior retain current semantics.
- Experience-state or analytics failure never blocks playback or a successfully completed track.
- A failure to read global preferences never blocks generation; it uses safe defaults and emits no user content in logs.

## Security and privacy

- RLS isolates `user_experience_state` by authenticated user.
- Experience transitions are narrow and monotonic; clients cannot assign another user's first track or regress completed state.
- Track ownership and successful finalization are verified server-side before first-track eligibility.
- First-track routing never uses a DJ not owned by the authenticated user.
- The server reloads atmosphere and genres; generation does not trust client-authored preference context.
- Catalog values are allowlisted on client and server. Free-text vibe retains existing sanitization and prompt framing.
- Product telemetry stores no creative content, contact data, provider bodies, media URLs, access tokens, or raw error messages.
- Anonymous event ingestion is schema-bounded, size-bounded, rate-limited, idempotent, and not queryable by anonymous clients.
- Privacy copy describes installation identifiers and their association after sign-in before public beta instrumentation is enabled.

## Test strategy

Implementation follows strict test-driven development. Each behavior begins with a failing test that exercises real state or a real contract; mocks are limited to network, storage, auth, time, and provider boundaries.

### Pure and state-machine tests

- Intro eligibility distinguishes unseen, completed, replay, malformed, and old-version records.
- Pending intent validates its discriminant, survives auth retry, expires at 24 hours, and consumes once.
- First-track routing distinguishes unresolved, failed, empty, one owned DJ, anomalous multiple DJs, cancellation, and auth-scope change.
- Experience-state transitions are monotonic, idempotent, and first-track first-writer-wins.
- DJ wizard validation, step navigation, dirty-exit behavior, intensity mapping, identity freshness, and return-intent consumption are deterministic.
- Existing Train DJ energy is preserved until intensity is explicitly changed.
- Preference parsing defaults missing atmosphere to Balanced and preserves over-limit legacy arrays.
- Queue weighting applies exact genre, top-genre, atmosphere, missing-energy, and excluded-mood rules with an injected random source.
- Generation seasoning maps each atmosphere to the exact bounded clause and preserves authority ordering.
- Telemetry contracts reject arbitrary events, unknown properties, oversized payloads, and any property intended for creative text.

### Component and hook tests

- Public intro renders localized three-step copy, button navigation, accessibility announcements, final intent, existing-user bypass, and authenticated replay.
- Login/auth integration preserves the pending intent on failure and invokes the gate after success on web and native.
- Catalog pickers support search, one-open disclosure, selection tray, caller limits, keyboard/sheet close, and legacy over-limit removal.
- Create DJ renders only the active editing step on compact, requests identity only upon Identity entry, reuses a fresh fingerprint, ignores stale responses, and preserves custom text after trait changes.
- Candidate selection or blur never submits. Continue confirms identity; the final action submits exactly once.
- Ordinary DJ creation and first-track-return creation choose their distinct success routes.
- Pending creation keeps Back available and Activity reports success/failure once after origin mount or unmount.
- Music Preferences renders exactly three effective sections and no legacy sliders or hidden controls.
- Rapid preference changes preserve cumulative optimistic state across navigation/remount, and failure rolls back only the failed intent.
- Cached offline/refetch error states retain values; initial offline precedes skeletons; save status is announced.
- The post-track preference card claims once, does not block track actions, accepts/dismisses correctly, and never reappears after dismissal/completion.

### Database and Edge contract tests

- Additive migrations apply to an existing schema and preserve old columns and rows.
- `music_preferences.atmosphere` accepts only the three values and defaults old/new rows to Balanced.
- `user_experience_state` RLS prevents cross-user reads and direct unrestricted mutation.
- First successful owned generated-track finalization marks only users with no earlier qualifying track.
- Competing finalizations cannot replace the recorded first track or present two nudges.
- Nudge transition RPCs are idempotent and reject invalid regressions.
- Product-event ingestion derives authenticated identity, validates anonymous payloads, deduplicates event IDs, enforces size/rate limits, and stores no disallowed properties.
- Generation reads authoritative atmosphere, keeps model selection unchanged, and degrades to defaults when preference lookup fails.
- Manual and Daily Drop fallback generation receive atmosphere context; Audius selection remains unchanged.

### Responsive and release tests

- Add pure layout-contract tests immediately below and above both responsive boundaries: 767/768 and 1023/1024 px, plus the low-height threshold at 599/600 px. Tests resolve compact, medium, wide, and low-height modifiers independently of a device label.
- Extend browser fixtures across every web row in the responsive acceptance matrix: 320x640, 390x844, 768x1024, 1023x768, 1024x768, 1440x900, 1920x1080, 720x422, and 512x384.
- Browser geometry assertions verify zero document horizontal overflow, one final CTA, CTA focusability/reachability, ordered focus, bounded dialogs, focus restoration, and no sticky obstruction. Back/Forward and reload tests verify intro step URLs, replay isolation, gate replacement, and invalid direct wizard-step recovery.
- Add Android component integration fixtures for 320x640, 360x800, 390x844, 430x932, 640x320, 844x390, 768x1024, 800x1280, 1024x768, and 1280x800. Inject safe-area and keyboard metrics rather than assuming zero insets.
- Android geometry/state assertions verify no clipped control, 44-pixel targets, safe-area clearance, keyboard reveal of focused inputs, sheet height/width bounds, sheet-first hardware Back, step Back, dirty-exit confirmation, rotation state retention, and no duplicate identity request or submit after resize.
- Run the complete matrix with English and Spanish resources. Run Android phone and tablet representatives at font scale 1.5, critical intro/DJ/preference paths at 2.0, and web at 100% and 200% page zoom.
- Add an Android emulator smoke flow for one compact phone and one tablet/orientation pair using the production navigation and native bottom sheet. The smoke check covers intro -> auth boundary stub -> gate -> DJ steps -> first-track continuation and Preferences; it is not replaced by web fixtures.
- At compact and medium widths only the active wizard editor is visible and the action remains reachable. Wide mode may show rail/editor/summary only when minimum region widths pass.
- At effective 200% browser zoom the layout resolves from the effective CSS viewport, focus order follows source order, dialogs remain inside the viewport, and all actions remain reachable.
- End-to-end activation covers: new installation -> intro -> auth -> no DJ -> Create DJ -> Create track -> ready result -> preference nudge.
- Additional end-to-end cases cover an existing owned DJ, returning signed-out installation, auth failure/retry, gate data failure, offline preference editing, custom identity fallback, generation failure, and nudge dismissal.
- Existing auth, activity, Create track, generation, DJ create/train, Home ranking, Focus Mode, RLS, i18n, full Jest, type-check, lint, web export, and Android build/static gates remain green.

## Delivery sequencing

### Phase 1: foundation and onboarding

1. Add pure intro/pending-intent contracts and tests.
2. Add `user_experience_state`, monotonic transition boundaries, and RLS tests.
3. Add the typed telemetry facade, collector, privacy-safe schema, and tests.
4. Add the public intro route, installation eligibility, authenticated replay, and localized copy.
5. Add post-auth `FirstTrackGate`, cancellation, and web/native auth continuation.
6. Disable automatic legacy tour startup without deleting legacy data or components.

### Phase 2: Create DJ

1. Extract progressive catalog and choice primitives behind existing canonical values.
2. Add the wizard controller and step-navigation tests.
3. Move identity drafting to Identity entry while preserving race protections and manual fallback.
4. Add compact review, visibility, final submission, and distinct success continuation.
5. Adapt Train DJ to the shared compact controls while preserving untouched energy.
6. Extend responsive and activity regression checks.

### Phase 3: Preferences

1. Add the atmosphere migration, generated types, parsing, and compatibility tests.
2. Replace the settings grid and legacy sliders with the three-section readable flow.
3. Add queue energy projections and atmosphere weighting.
4. Add authoritative generation atmosphere seasoning and fallback behavior.
5. Mark first-track eligibility during successful generation finalization.
6. Add `PostTrackExperience` with only the one-time preference nudge.
7. Complete responsive, accessibility, RLS, generation, and end-to-end regression gates.

Each phase must remain independently reviewable and must not partially expose a route whose required persistence or server contract is absent.

## Rollout and rollback

- Apply additive tables/columns and server readers before enabling the corresponding client UI.
- Old clients continue because existing columns and validation remain, and atmosphere has a database default.
- The intro version key allows a corrected intro to increment version without rewriting legacy onboarding.
- Enable first-track routing only after the gate handles cached, empty, failed, and expired-intent states.
- Enable atmosphere UI only after both queue and generation consumers are deployed; until then keep it hidden rather than decorative.
- Enable the post-track nudge only after server finalization and monotonic claims are active.
- A client rollback may return to the existing screens without schema rollback. Additive state and atmosphere values remain safe.
- A server rollback ignores the new preference column and experience state but never deletes or regresses them.
- Do not drop legacy preference or onboarding columns during the beta observation period.

## Success criteria

The work is complete when:

- a first-time signed-out installation sees exactly three public intro steps before Login;
- “Create my first track” survives web/native authentication and reaches the correct next creation step;
- a user with no DJ can create one and continue directly into Create track without returning to Home;
- Create DJ displays one editable step at a time, preserves all authoritative traits, requests identity only on Identity entry, and submits only from final Review;
- Android and web expose the same complete actions, validations, recovery, persistence, and telemetry semantics while using their native sheet/dialog, navigation, focus, keyboard, and safe-area patterns;
- compact and large phones, phone landscape, tablet portrait/landscape, narrow/medium/wide web, low-height web, 200% zoom, and enlarged Android text pass the responsive acceptance matrix with no clipped or unreachable content;
- Music Preferences displays only favorite genres, atmosphere, and moods to avoid;
- no visible preference control lacks a production consumer;
- atmosphere affects the declared Home queues and generated music without changing the model or overriding explicit track intent;
- legacy preference values and existing DJ energies are never silently truncated or rewritten;
- the first eligible completed track produces one non-blocking preference nudge and never blocks result actions;
- telemetry measures the declared funnel without creative text or third-party analytics;
- legacy onboarding and preference storage remain rollback-compatible;
- all new behavior is covered by TDD and existing release gates remain green.

## Deferred extension: HiMu Moment

The later HiMu Moment may use `PostTrackExperience` to add a shareable card or clip and brief feedback such as “Did it surprise you?” and “Would you share it?” That work requires its own approved design for media rendering, sharing, consent, retention, moderation, and analytics. This specification neither renders those assets nor stores feedback, and it does not reserve database columns or event payloads for free-form comments.
