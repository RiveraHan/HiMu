# Language-Aware Generation and Model Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each new generation use the app's effective English or Spanish language while moving music to Lyria 3 Pro, text to Llama 4 Scout Instruct, and spoken drops to Inworld Realtime TTS 2.

**Architecture:** The Expo hooks capture `resolvedLanguage` when invoking the Edge Function. Pure Edge helpers validate the language and build localized, bounded model prompts; `index.ts` retains orchestration, authorization, quota, job, R2, and fallback ownership. Model endpoints and payloads are explicit constants so future price/quality upgrades remain reviewable.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript 5.9, TanStack Query, Supabase Edge Functions/Deno, Replicate HTTP API, Jest, Testing Library, Node/tsx assertions.

## Global Constraints

- Supported generation languages are exactly `"en" | "es"`; Spanish means neutral Latin American Spanish.
- Missing request language defaults to `en` for legacy clients; any supplied invalid value returns HTTP 400 before quota consumption or job creation.
- Accepted user lyrics must preserve exact punctuation, spacing, and line breaks; reject prohibited control characters or input over 1,000 UTF-16 code units instead of modifying or truncating it.
- Existing daily drops remain idempotent by user and local date and are not regenerated after a language change.
- Audius remains first choice for daily drops; Lyria remains the fallback when no playable Audius result succeeds.
- Do not add an ElevenLabs or Stable Audio fallback.
- Do not modify Flux cover/avatar generation, quotas, authorization, database schema, or existing generated content.
- Do not run paid Replicate predictions as part of automated verification.

---

### Task 1: Send the effective language from client generation hooks

**Files:**
- Create: `src/hooks/__tests__/generation-language-test.tsx`
- Modify: `src/hooks/use-generate-mix.ts`
- Modify: `src/hooks/use-daily-drop.ts`

**Interfaces:**
- Consumes: `useLocale(): LocaleContextValue`, especially `resolvedLanguage: "en" | "es"`.
- Produces: both `generate-mix` invocation bodies include `language: resolvedLanguage`.

- [ ] **Step 1: Write the failing hook tests**

Create a Testing Library harness with a fresh `QueryClient`, mock `supabase.functions.invoke`, `useCurrentUser`, and `useDJs`, and provide the locale context. The assertions must include both languages and must inspect the full invocation body:

```tsx
expect(invoke).toHaveBeenCalledWith("generate-mix", {
  body: expect.objectContaining({
    djId: "dj-1",
    language: "es",
    lyrics: "[Verso 1]\nSigo aquí",
  }),
});

expect(invoke).toHaveBeenCalledWith("generate-mix", {
  body: expect.objectContaining({
    djId: "dj-1",
    dropDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    language: "en",
  }),
});
```

The daily-drop test must rerender with `resolvedLanguage="es"` after the first invocation and assert that the existing `triggered` guard prevents a second invocation during the same mount.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --runInBand src/hooks/__tests__/generation-language-test.tsx`

Expected: FAIL because invocation bodies do not contain `language`.

- [ ] **Step 3: Capture locale in both hooks**

Add the import and value in each hook:

```ts
import { useLocale } from "@/src/i18n/use-locale";

const { resolvedLanguage } = useLocale();
```

Add the captured value to each Edge Function body:

```ts
body: {
  djId,
  language: resolvedLanguage,
  localHour: new Date().getHours(),
  ...(lyrics ? { lyrics } : {}),
}
```

```ts
body: {
  djId,
  language: resolvedLanguage,
  dropDate: localDateStr(),
  localHour: new Date().getHours(),
}
```

Ensure `resolvedLanguage` is part of the relevant mutation closure/dependency lifecycle so a new mutation after a language change uses the latest render value.

- [ ] **Step 4: Run focused and related tests**

Run: `npm test -- --runInBand src/hooks/__tests__/generation-language-test.tsx app/dj/__tests__/dj-profile-test.tsx 'app/(app)/__tests__/home-test.tsx'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-generate-mix.ts src/hooks/use-daily-drop.ts src/hooks/__tests__/generation-language-test.tsx
git commit -m "feat: send app language with generation requests"
```

### Task 2: Add pure generation-language, lyrics, prompt, and payload helpers

**Files:**
- Create: `supabase/functions/generate-mix/generation-models.ts`
- Create: `scripts/check/generation-models.ts`

**Interfaces:**
- Produces: `GenerationLanguage`, `parseGenerationLanguage`, `validateLyrics`, `boundedDefaultLyrics`, `buildMusicInput`, `creativeTitle`, `captionTimePhrase`, `fallbackAudiusCaption`, `buildCaptionInput`, `buildCaptionTtsInput`, and endpoint constants.
- Consumed by: Tasks 3 and 4.

- [ ] **Step 1: Write a failing pure-helper check**

Create `scripts/check/generation-models.ts` with `node:assert/strict`. Cover absent/valid/invalid language, exact multiline lyrics, oversized/control-character rejection, both music modes, localized captions/titles, stable Llama markers, and Inworld language/format:

```ts
assert.equal(parseGenerationLanguage(undefined), "en");
assert.equal(parseGenerationLanguage("es"), "es");
assert.throws(() => parseGenerationLanguage("fr"), /language must be en or es/);

const lyrics = "[Verso 1]\n  Sigo aquí...\n\n[Coro]\n¡Sin cambiar!";
assert.equal(validateLyrics(lyrics), lyrics);
assert.throws(() => validateLyrics("x".repeat(1001)), /1000/);
assert.throws(() => validateLyrics("hola\u0000mundo"), /control/);

const vocal = buildMusicInput({
  basePrompt: "dream pop",
  seasoning: ["late night atmosphere"],
  instrumental: false,
  durationSeconds: 120,
  language: "es",
  lyrics,
});
assert.equal(vocal.endpoint, LYRIA_ENDPOINT);
assert.deepEqual(Object.keys(vocal.body.input).sort(), ["prompt"]);
assert.match(vocal.body.input.prompt, /español latinoamericano neutro/i);
assert.ok(vocal.body.input.prompt.includes(lyrics));

const instrumental = buildMusicInput({
  basePrompt: "ambient piano",
  seasoning: [],
  instrumental: true,
  durationSeconds: 90,
  language: "en",
  lyrics: null,
});
assert.match(instrumental.body.input.prompt, /instrumental only/i);
assert.match(instrumental.body.input.prompt, /no vocals/i);

assert.match(creativeTitle("es", () => 0), /\S+ \S+/);
assert.equal(captionTimePhrase(9, "es"), "esta mañana");

const tts = buildCaptionTtsInput("es", "feminine", ["energetic"], "Hoy subimos el ritmo");
assert.equal(tts.endpoint, INWORLD_TTS_ENDPOINT);
assert.equal(tts.body.input.language, "es");
assert.equal(tts.body.input.audio_format, "mp3");
assert.equal(tts.body.input.sample_rate, 48000);
```

- [ ] **Step 2: Run the helper check and verify failure**

Run: `npx tsx scripts/check/generation-models.ts`

Expected: FAIL with `Cannot find module .../generation-models.ts`.

- [ ] **Step 3: Implement types, validation, endpoints, and localized copy**

Create `generation-models.ts` with these public types/constants:

```ts
export type GenerationLanguage = "en" | "es";

export const LYRIA_ENDPOINT =
  "https://api.replicate.com/v1/models/google/lyria-3-pro/predictions";
export const LLAMA_ENDPOINT =
  "https://api.replicate.com/v1/models/meta/llama-4-scout-instruct/predictions";
export const INWORLD_TTS_ENDPOINT =
  "https://api.replicate.com/v1/models/inworld/realtime-tts-2/predictions";
export const MAX_LYRIA_PROMPT_CHARS = 4000;

export function parseGenerationLanguage(value: unknown): GenerationLanguage {
  if (value == null) return "en";
  if (value === "en" || value === "es") return value;
  throw new Error("language must be en or es");
}

export function validateLyrics(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("lyrics must be text");
  if (value.length > 1000) throw new Error("lyrics must be 1000 characters or fewer");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error("lyrics contain prohibited control characters");
  }
  return value.trim().length === 0 ? null : value;
}

export function boundedDefaultLyrics(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, 1000);
}
```

Use separate English and Spanish dictionaries for time phrases, title words, default DJ/artist labels, language instructions, and fallback-caption templates. `creativeTitle(language, random = Math.random)` accepts injected randomness so the check is deterministic.

- [ ] **Step 4: Implement bounded Lyria, Llama, and Inworld input builders**

Expose exact signatures:

```ts
export function buildMusicInput(args: {
  basePrompt: string;
  seasoning: string[];
  instrumental: boolean;
  durationSeconds: number;
  language: GenerationLanguage;
  lyrics: string | null;
}): { endpoint: string; body: { input: { prompt: string } } };

export function buildCaptionInput(args: {
  dj: unknown;
  localHour: unknown;
  trackTitle: string;
  language: GenerationLanguage;
}): { endpoint: string; body: { input: {
  system_prompt: string;
  prompt: string;
  max_tokens: number;
  temperature: number;
} } };

export function buildCaptionTtsInput(
  language: GenerationLanguage,
  voiceStyle: unknown,
  moodTags: unknown,
  caption: string,
): { endpoint: string; body: { input: {
  text: string;
  language: GenerationLanguage;
  voice_id: string;
  speaking_rate: number;
  audio_format: "mp3";
  sample_rate: 48000;
  text_normalization: "auto";
} } };
```

For Lyria, cap the final prompt at `MAX_LYRIA_PROMPT_CHARS` (4,000), reserve the accepted lyrics first, place them between implementation-owned `[LYRICS_START]` and `[LYRICS_END]` delimiters, and shorten base prompt/seasoning before lyrics. Automatic Spanish lyrics must request `original lyrics in neutral Latin American Spanish`; English uses `original lyrics in English`. Instrumental prompts must state `Instrumental only. No vocals.` and all prompts state the target duration.

Also expose the deterministic localized fallback used by Task 3:

```ts
export function fallbackAudiusCaption(
  language: GenerationLanguage,
  trackTitle: string,
  artistName?: string | null,
): string;
```

For Inworld, use only schema-confirmed built-in presets (`Ashley`, `Dennis`, `Alex`, `Darlene`) with `Ashley` as deterministic default. Prepend only implementation-owned bracketed steering: `[say with upbeat radio energy]`, `[say calmly with warm, measured pacing]`, or `[say with a warm, confident radio presence]`.

- [ ] **Step 5: Run pure checks**

Run: `npx tsx scripts/check/generation-models.ts`

Expected: exits 0 and prints `generation model checks passed`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-mix/generation-models.ts scripts/check/generation-models.ts
git commit -m "feat: add language-aware generation model inputs"
```

### Task 3: Localize Audius curation and move it to Llama 4 Scout

**Files:**
- Modify: `supabase/functions/generate-mix/audius-drop.ts`
- Modify: `scripts/check/audius-drop.ts`

**Interfaces:**
- Consumes: `GenerationLanguage`, `LLAMA_ENDPOINT`, `captionTimePhrase`, and localized fallback helper from `generation-models.ts`.
- Produces: `buildAudiusPickInput(dj, localHour, candidates, language)` and `pickAudiusDrop(dj, localHour, language): Promise<AudiusPick | null>`.

```ts
export function buildAudiusPickInput(
  dj: any,
  localHour: unknown,
  candidates: AudiusTrack[],
  language: GenerationLanguage,
): {
  endpoint: string;
  body: { input: {
    system_prompt: string;
    prompt: string;
    max_tokens: 80;
    temperature: 0.8;
  } };
};
```

- [ ] **Step 1: Extend the Audius check with bilingual prompt/fallback assertions**

Export a pure `buildAudiusPickInput` helper and make the check assert:

```ts
const spanish = buildAudiusPickInput(dj, 21, candidates, "es");
assert.equal(spanish.endpoint, LLAMA_ENDPOINT);
assert.match(spanish.body.input.system_prompt, /español latinoamericano neutro/i);
assert.match(spanish.body.input.prompt, /PICK: <number>\nCAPTION:/);
assert.match(spanish.body.input.prompt, /esta noche/i);
assert.equal(
  fallbackAudiusCaption("es", "Luz Azul", "Mara"),
  "Un descubrimiento fresco: Luz Azul de Mara.",
);
```

- [ ] **Step 2: Run the Audius check and verify failure**

Run: `npx tsx scripts/check/audius-drop.ts`

Expected: FAIL because `buildAudiusPickInput` and the language argument do not exist.

- [ ] **Step 3: Implement the localized Llama 4 input**

Change the public signature and use the shared endpoint:

```ts
export async function pickAudiusDrop(
  dj: any,
  localHour: unknown,
  language: GenerationLanguage,
): Promise<AudiusPick | null>
```

Move prompt construction to exported `buildAudiusPickInput(dj, localHour, candidates, language)`. Keep `PICK:` and `CAPTION:` literal in both languages, retain the 80-token limit and temperature `0.8`, and instruct neutral Latin American Spanish for `es`. Use `fallbackAudiusCaption(language, pick.title, pick.user?.name)` instead of the fixed English string.

- [ ] **Step 4: Run Audius and generation helper checks**

Run: `npx tsx scripts/check/audius-drop.ts && npx tsx scripts/check/generation-models.ts`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generate-mix/audius-drop.ts scripts/check/audius-drop.ts
git commit -m "feat: localize Audius DJ curation with Llama 4"
```

### Task 4: Integrate validation, Lyria, Llama 4 captions, and Inworld TTS

**Files:**
- Modify: `supabase/functions/generate-mix/index.ts`
- Modify: `scripts/check/generation-models.ts`

**Interfaces:**
- Consumes: all helpers and constants from `generation-models.ts`; `pickAudiusDrop(dj, localHour, language)` from Task 3.
- Produces: the complete language-aware `generate-mix` Edge Function.

- [ ] **Step 1: Add orchestration-focused source assertions**

Extend `scripts/check/generation-models.ts` to read `index.ts` and assert removal of the old model identifiers and propagation into every call path:

```ts
const indexSource = await readFile(
  new URL("../../supabase/functions/generate-mix/index.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(indexSource, /elevenlabs\/music|STABLE_AUDIO_VERSION|KOKORO_VERSION/);
assert.match(indexSource, /parseGenerationLanguage/);
assert.match(indexSource, /pickAudiusDrop\(dj, localHour, language\)/);
assert.match(indexSource, /buildCaptionAudio\(jobId, dj, caption, language\)/);
assert.match(indexSource, /captions\/generated\/\$\{jobId\}\.mp3/);
```

- [ ] **Step 2: Run checks and verify failure**

Run: `npx tsx scripts/check/generation-models.ts`

Expected: FAIL because the old endpoints/constants remain and language is not threaded.

- [ ] **Step 3: Validate request language and exact lyrics before side effects**

Destructure `language: rawLanguage`, then validate before DJ lookup, quota work, or job creation:

```ts
let language: GenerationLanguage;
let requestedLyrics: string | null;
try {
  language = parseGenerationLanguage(rawLanguage);
  requestedLyrics = validateLyrics(rawLyrics);
} catch (error) {
  return invalid(error instanceof Error ? error.message : "invalid generation input");
}
```

Retain authorization rules: only apply `requestedLyrics` to the user's own vocal DJ and never to a drop. Do not call the generic whitespace-collapsing `sanitize` helper for lyrics.

- [ ] **Step 4: Replace both music branches with the Lyria builder**

Replace the ElevenLabs/Stable Audio conditional with:

```ts
const request = buildMusicInput({
  basePrompt: String(cfg.base_prompt),
  seasoning,
  instrumental: cfg.is_instrumental ?? true,
  durationSeconds: trackSeconds(cfg),
  language,
  lyrics: lyrics ?? boundedDefaultLyrics(cfg.default_lyrics),
});
return replicateRun(request.endpoint, request.body);
```

Make `generateMusic` accept `language`. Remove `STABLE_AUDIO_VERSION`, the ElevenLabs endpoint, Stable Audio payload, and their model-specific duration fields.

- [ ] **Step 5: Integrate localized captions and titles**

Make `buildCaption`, `tryAudiusDrop`, and `runGeneration` require `GenerationLanguage`. Build the generated caption request with `buildCaptionInput`, pass language into `pickAudiusDrop`, and insert `creativeTitle(language)` for generated tracks. Every `EdgeRuntime.waitUntil(runGeneration(...))` call must carry the validated language, including failed daily-drop retries.

- [ ] **Step 6: Replace Kokoro audio with Inworld MP3**

Replace the Kokoro payload with:

```ts
const request = buildCaptionTtsInput(
  language,
  dj?.voice_style,
  dj?.mood_tags,
  caption.slice(0, 300),
);
const tempUrl = await replicateRun(request.endpoint, request.body);
const bytes = new Uint8Array(await (await fetch(tempUrl)).arrayBuffer());
return await r2Put(
  `captions/generated/${jobId}.mp3`,
  bytes,
  "audio/mpeg",
);
```

Change all `buildCaptionAudio` calls to pass language. Change failed-job cleanup from the caption `.wav` key to `.mp3`. Keep TTS failures best-effort so text captions survive.

- [ ] **Step 7: Run all focused checks**

Run: `npx tsx scripts/check/generation-models.ts && npx tsx scripts/check/audius-drop.ts`

Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/generate-mix/index.ts scripts/check/generation-models.ts
git commit -m "feat: use Lyria and Inworld for bilingual generation"
```

### Task 5: Full regression verification and documentation checkpoint

**Files:**
- Modify only if verification exposes an in-scope defect: files already listed in Tasks 1–4.
- Force-add: `docs/superpowers/specs/2026-07-22-generation-language-and-models-design.md`
- Force-add: `docs/superpowers/plans/2026-07-22-generation-language-and-models.md`

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: a clean, review-ready feature branch with reproducible verification evidence.

- [ ] **Step 1: Run generation checks and the complete Jest suite**

Run: `npx tsx scripts/check/generation-models.ts && npx tsx scripts/check/audius-drop.ts && npm test -- --runInBand`

Expected: helper checks exit 0; 50 or more Jest suites pass with no failures.

- [ ] **Step 2: Run static checks**

Run: `npx tsc --noEmit && npm run lint`

Expected: TypeScript exits 0; ESLint has zero errors. The two preexisting `no-empty-object-type` warnings in `src/theme/index.ts` may remain.

- [ ] **Step 3: Audit model and language wiring**

Run:

```bash
rg -n "elevenlabs/music|STABLE_AUDIO_VERSION|KOKORO_VERSION|meta-llama-3-8b" supabase/functions/generate-mix
rg -n "lyria-3-pro|llama-4-scout-instruct|realtime-tts-2" supabase/functions/generate-mix
rg -n "language: resolvedLanguage" src/hooks/use-generate-mix.ts src/hooks/use-daily-drop.ts
```

Expected: the first search returns no matches; the second shows all three approved models; the third shows both hooks.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check && git status --short && git log --oneline --decorate -5`

Expected: no whitespace errors; only the intended feature files and ignored documentation await the final documentation commit.

- [ ] **Step 5: Commit the approved spec and plan**

The repository ignores `docs/`, so force-add only these two approved files:

```bash
git add -f docs/superpowers/specs/2026-07-22-generation-language-and-models-design.md docs/superpowers/plans/2026-07-22-generation-language-and-models.md
git commit -m "docs: record bilingual generation model design"
```

- [ ] **Step 6: Optional paid smoke test remains opt-in**

Do not invoke Replicate automatically. If the user later authorizes real predictions, disclose the expected maximum first and generate one English and one Spanish sample for Lyria, Llama, and Inworld. Record qualitative findings separately; no smoke-test credential or generated media enters Git.
