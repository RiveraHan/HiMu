# Language-Aware Generation and Model Cost Optimization Design

## Goal

Make every new HiMu generation use the app's effective language (`en` or `es`) at the moment the request starts, while replacing the current generation models with a higher-value Replicate portfolio:

- Google Lyria 3 Pro for generated music.
- Meta Llama 4 Scout Instruct for DJ curation and captions.
- Inworld Realtime TTS 2 for spoken DJ drops.
- Flux 1.1 Pro remains unchanged for covers and avatars in this iteration.

The result must generate natural English or neutral Latin American Spanish, preserve user-authored lyrics exactly, and materially reduce music cost without weakening the existing job, quota, authorization, Audius, R2, or fallback behavior.

## Scope

This iteration covers:

- Passing the effective app language on manual mix and daily-drop requests.
- Validating and normalizing generation language on the Edge Function.
- Language-aware generated lyrics, generated-track titles, time-of-day phrasing, Audius selection captions, fallback captions, and caption speech.
- Replacing ElevenLabs Music and Stable Audio 2.5 with Google Lyria 3 Pro for both vocal and instrumental tracks.
- Replacing Meta Llama 3 8B Instruct with Meta Llama 4 Scout Instruct for text and curation.
- Replacing Kokoro with Inworld Realtime TTS 2.
- Automated coverage for language propagation, prompt construction, fallbacks, model payloads, and daily-drop idempotency.

This iteration does not:

- Translate user-provided lyrics, DJ names, DJ persona fields, Audius titles, artist names, existing tracks, captions, or drops.
- Add a language property to a DJ.
- Regenerate an already-created daily drop when the user changes language.
- Change Flux, cover generation, avatar generation, quotas, database schema, or the Audius catalog.
- Run paid model benchmarks or automatically choose models at runtime.

## Language contract

The client sends the resolved app language, not the stored preference. The request contract becomes:

```ts
type GenerationLanguage = "en" | "es";

type GenerateMixBody = {
  djId: string;
  language: GenerationLanguage;
  localHour: number;
  lyrics?: string;
  dropDate?: string;
};
```

`useGenerateMix` and `useDailyDrop` read `resolvedLanguage` from the existing locale controller at request time. A user whose preference is `system` therefore sends the currently resolved device language. Language is captured per request; changing the app language affects the next generation only.

The server accepts only `en` and `es`. For compatibility with already-deployed clients during rollout, an absent language defaults to `en`. Any present but unsupported or malformed value returns HTTP 400 rather than silently generating in an unexpected language.

The validated language is threaded explicitly through all background-generation functions. It is not inferred from lyrics, DJ fields, local time, or user profile data.

## Daily-drop semantics

The existing `(user, local date)` idempotency remains authoritative. If today's job is already queued, generating, or ready, the server returns that job even if a later request uses another app language. A language switch never creates a second daily drop and never mutates existing caption text or audio.

If a failed daily job is explicitly retried through the existing path, the retry uses the language of the retrying request because the failed job has no usable finished content. This does not affect successful drops.

## Music generation with Lyria 3 Pro

Both vocal and instrumental branches call the official model endpoint:

```text
https://api.replicate.com/v1/models/google/lyria-3-pro/predictions
```

Lyria 3 Pro accepts `prompt`, optional `images`, and optional `seed`; it does not accept the current ElevenLabs or Stable Audio duration parameters. HiMu therefore constructs one bounded prompt containing:

- The DJ base prompt and safe catalog-derived seasoning.
- Instrumental or vocal direction.
- A target-duration instruction derived from the DJ generation configuration.
- The required output language for vocals.
- User/default lyrics when present.
- A request for original lyrics in the target language when lyrics are absent.
- A prohibition against reproducing existing copyrighted songs.

For instrumental DJs, the prompt explicitly says `instrumental only` and `no vocals`. For vocal DJs:

- User-provided lyrics are validated without using the existing generic `sanitize` helper, because that helper collapses whitespace and removes the song's line structure. Accepted lyrics preserve their exact text, punctuation, spaces, and line breaks. Inputs containing prohibited control characters or exceeding the length limit are rejected with HTTP 400 instead of being silently modified or truncated.
- Configured default lyrics are bounded and included without translation or creative rewriting.
- The app language controls only lyrics that the model is asked to invent.
- Prompt instructions surrounding supplied lyrics use the generation language, but clearly delimit the lyrics so the model sings only that supplied content.

Lyria's exact duration can vary. The existing configured duration becomes a target expressed in the prompt and remains the stored duration estimate unless reliable output metadata is introduced later. HiMu keeps the current maximum boundary and does not promise sample-exact duration.

Prompt assembly uses explicit section and size budgets. Supplied lyrics have priority and are never accidentally removed by truncating the combined prompt; musical direction and optional seasoning are shortened first. The final prompt stays within the provider's accepted limit, and section delimiters cannot be supplied by untrusted fields.

The generated MP3 continues through the existing Replicate download, R2 upload, track insertion, cover generation, cleanup, and job-state flow.

## Titles and language-specific deterministic copy

Generated tracks need titles matching the request language. Replace the single English title vocabulary with language-specific adjective and noun catalogs. The title helper receives `GenerationLanguage` and draws only from the selected catalog.

Time-of-day phrases, default DJ labels, unknown-artist labels, and Audius fallback captions also become language-aware. These are local deterministic dictionaries, not extra LLM calls. Proper nouns such as track titles and artist names remain untouched.

Neutral Spanish examples use wording such as `esta mañana`, `esta tarde`, `esta noche`, `en estas horas de la madrugada`, `Tu DJ`, and `artista desconocido`. Spanish prompts explicitly request neutral Latin American Spanish and avoid regional slang unless it is already part of the DJ persona supplied by the user.

## Text and curation with Llama 4 Scout

Both current Llama call sites move to:

```text
https://api.replicate.com/v1/models/meta/llama-4-scout-instruct/predictions
```

The model retains the existing `system_prompt`, `prompt`, token cap, and temperature pattern. Prompt builders receive the validated language and set all of the following consistently:

- The response language.
- The localized time-of-day phrase.
- The output shape and word limit.
- Neutral Latin American Spanish for `es`.
- Plain text with no quotes, emoji, hashtags, or preamble.

For Audius curation, shortlist metadata stays in its original form. The model may use those titles and artist names but must write the introduction in the selected language. Parsing remains based on the stable machine markers `PICK:` and `CAPTION:` in both languages so the parser does not require locale-specific branches.

If the Llama call fails or returns an unparsable caption, selection still falls back to the first playable candidate and uses a local caption template in the requested language. The drop therefore remains available independently of text-model health.

## Spoken drops with Inworld Realtime TTS 2

Kokoro and its pinned version, English-only voice mapping, and numeric speed-only direction are replaced by the official endpoint:

```text
https://api.replicate.com/v1/models/inworld/realtime-tts-2/predictions
```

The request includes:

- `text`: the bounded generated caption.
- `language`: the explicit `en` or `es` request language, never `auto`.
- `voice_id`: a stable preset selected from the DJ's existing `voice_style` mapping.
- `speaking_rate`: the existing mood-based pace mapped into Inworld's accepted range.
- `audio_format`: `mp3`.
- `sample_rate`: `48000`.
- `text_normalization`: `auto`.

Natural-language steering is prepended conservatively to the TTS text to reflect high-energy, calm, or neutral DJ delivery. Steering instructions are implementation-owned and bounded; untrusted DJ persona text is not inserted as an unrestricted TTS command.

The downloaded result is uploaded to R2 using an `.mp3` key and `audio/mpeg`, replacing the current `.wav`/`audio/wav` assumption. Cleanup uses the matching MP3 caption key. Caption audio remains best-effort: a TTS or upload failure logs the error and leaves a usable text caption and track.

Preset voices must be verified against the live Inworld schema during implementation. The mapping uses only accepted built-in IDs and has a deterministic default. If a style cannot be mapped, the default voice is used; generation does not fail because of an unknown style string.

## Cost profile

The cost objective is dominated by generated music:

- ElevenLabs Music currently costs about $8.30 per 1,000 output seconds, or roughly $0.996 for a 120-second track.
- Stable Audio 2.5 costs $0.20 per output file.
- Lyria 3 Pro costs $0.08 per output file for either vocal or instrumental generation.
- Inworld Realtime TTS 2 costs $0.025 per 1,000 input characters, or roughly $0.0025 for a 100-character drop.
- Llama text calls remain negligible relative to music because captions are short and tightly token-capped.

With the unchanged $0.04 cover estimate, a generated vocal track falls from approximately $1.04 to $0.12, an estimated 88% reduction. An instrumental track falls from approximately $0.24 to $0.12, an estimated 50% reduction. These estimates exclude retries and are operational guidance rather than billing guarantees.

No automatic fallback to ElevenLabs is introduced because a successful fallback would recreate the cost problem. A Lyria model failure follows the existing failed-job path and cleanup behavior. Audius remains the first choice for daily drops and avoids music-generation cost whenever a playable candidate is available.

## Component boundaries

- The locale controller remains the source of `resolvedLanguage` on the client.
- Generation hooks own capturing and transmitting language at mutation time.
- The Edge Function owns request validation and backward-compatible defaulting.
- Pure language helpers own local phrases, title vocabularies, and prompt language instructions.
- Music, caption, Audius-selection, and TTS functions require an explicit `GenerationLanguage` parameter.
- The shared Replicate runner continues to own prediction creation and polling; model-specific payload construction stays at the call site or in focused helpers.
- Existing storage, authorization, quota, and job-state modules remain unchanged.

## Error handling and observability

- Missing language defaults to English only for legacy-client compatibility.
- Invalid supplied language returns HTTP 400 before quota consumption or job creation.
- Lyria safety rejection, timeout, malformed output, or download failure marks the job failed and runs existing R2 cleanup.
- Llama failure degrades to localized deterministic copy where a fallback exists.
- Inworld failure removes only spoken audio from the result; the text caption remains.
- Logs include the model role and language but never full user lyrics, full prompts, API tokens, or caption audio.
- Model identifiers are named constants so upgrades remain reviewable and do not become scattered string changes.

## Testing and verification

Automated coverage includes:

- Manual generation sends the effective `en` or `es` language.
- Daily-drop creation sends the effective language and still triggers once per mount.
- The server accepts `en` and `es`, defaults an absent language to `en`, and rejects other values before creating work.
- Language is preserved through manual generation, generated-drop fallback, Audius selection, caption generation, and TTS.
- Accepted user lyrics remain exactly unchanged in both app languages, including punctuation, spacing, and line breaks; invalid or oversized input is rejected rather than rewritten or truncated.
- Automatic vocal prompts request original English or neutral Spanish lyrics as appropriate.
- Instrumental prompts prohibit vocals in both languages.
- Lyria payloads use only supported inputs and the official model endpoint.
- Llama 4 payloads request the correct language while retaining stable parse markers.
- English and Spanish fallback captions preserve track and artist proper nouns.
- Inworld payloads set explicit language, valid voice defaults, MP3 format, and bounded steering.
- Caption upload and cleanup paths use `.mp3` and `audio/mpeg` consistently.
- Existing daily-drop jobs are returned after a language switch without regeneration.
- Failures retain the current graceful-degradation and cleanup semantics.

Verification runs Jest, TypeScript checking, ESLint, and any focused Deno tests introduced for Edge Function helpers. No paid Replicate prediction is required for the automated suite; network boundaries are mocked. A separate opt-in smoke test with real credentials may generate one English and one Spanish sample per model after implementation, with its expected spend disclosed before execution.

## Acceptance criteria

- Every new manual mix and new daily drop uses the app's effective language at request time.
- Existing daily drops do not change or duplicate after a language switch.
- Automatically generated lyrics, titles, captions, fallback copy, and speech are English for `en` and neutral Latin American Spanish for `es`.
- Accepted user-provided lyrics are sent to the model exactly as written, with no translation, correction, whitespace collapsing, or silent truncation, and with an explicit instruction to sing only that supplied content.
- Vocal and instrumental music both use Google Lyria 3 Pro.
- Caption and Audius curation text use Meta Llama 4 Scout Instruct.
- Caption speech uses Inworld Realtime TTS 2 with explicit language and MP3 storage.
- Flux-based image generation remains unchanged.
- Existing authorization, quotas, Audius-first daily drops, job polling, R2 cleanup, and graceful fallbacks keep working.
- The expected generated-track cost is substantially lower, with no ElevenLabs Music fallback silently restoring the former expense.
