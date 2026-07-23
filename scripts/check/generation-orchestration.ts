import assert from "node:assert/strict";
import {
  fallbackAudiusCaption,
  INWORLD_TTS_ENDPOINT,
  LYRIA_ENDPOINT,
} from "../../supabase/functions/generate-mix/generation-models";

async function main() {
  const module = await import(
    "../../supabase/functions/generate-mix/generation-orchestration"
  ).catch(() => null);
  assert.ok(module, "generation orchestration module must be executable outside Deno");

  const {
    downloadProviderMedia,
    handleGenerateMixRequest,
    runGeneration,
  } = module;
  assert.equal(typeof downloadProviderMedia, "function");
  assert.equal(typeof handleGenerateMixRequest, "function");
  assert.equal(typeof runGeneration, "function");

  const cfg = {
    dj_id: "dj-1",
    base_prompt: "dream pop",
    is_instrumental: false,
    default_lyrics: null,
    max_duration: 120,
    djs: {
      name: "Sol",
      character: "warm",
      voice_style: "feminine",
      genre_specialties: ["Pop"],
      mood_tags: ["energetic"],
      avatar_url: "https://images.test/avatar.jpg",
      owner_id: "user-1",
    },
  };

  function requestDeps(overrides: Record<string, unknown> = {}) {
    const calls: Array<{ name: string; value?: unknown }> = [];
    const deps = {
      getDjConfig: async (djId: string) => {
        calls.push({ name: "getDjConfig", value: djId });
        return cfg;
      },
      buildSeasoning: async () => {
        calls.push({ name: "buildSeasoning" });
        return ["evening warmth"];
      },
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        return null;
      },
      requeueDailyJob: async (jobId: string) => {
        calls.push({ name: "requeueDailyJob", value: jobId });
      },
      createDailyJob: async () => {
        calls.push({ name: "createDailyJob" });
        return { job: { id: "daily-new", status: "queued" }, error: null };
      },
      countDailyGenerations: async () => {
        calls.push({ name: "countDailyGenerations" });
        return 0;
      },
      createManualJob: async (input: unknown) => {
        calls.push({ name: "createManualJob", value: input });
        return { job: { id: "manual-new", status: "queued" }, error: null };
      },
      runGeneration: async (input: unknown) => {
        calls.push({ name: "runGeneration", value: input });
      },
      waitUntil: (promise: Promise<void>) => {
        calls.push({ name: "waitUntil" });
        void promise;
      },
      now: () => "2026-07-22T12:00:00.000Z",
      ...overrides,
    };
    return { calls, deps };
  }

  {
    const { calls, deps } = requestDeps();
    const response = await handleGenerateMixRequest(
      { djId: "dj-1", language: "fr" },
      "user-1",
      deps,
    );
    assert.equal(response.status, 400);
    assert.deepEqual(
      calls,
      [],
      "invalid language must be rejected before database/runtime side effects",
    );
  }

  {
    const { calls, deps } = requestDeps();
    const response = await handleGenerateMixRequest(
      { djId: "dj-1" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, { status: 200, body: { jobId: "manual-new" } });
    const scheduled = calls.find((call) => call.name === "runGeneration");
    assert.equal((scheduled?.value as { language?: string })?.language, "en");
  }

  {
    const { calls, deps } = requestDeps({
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        return { id: "daily-ready", status: "ready" };
      },
    });
    const response = await handleGenerateMixRequest(
      {
        djId: "dj-1",
        language: "es",
        dropDate: "2026-07-22",
        localHour: 21,
      },
      "user-1",
      deps,
    );
    assert.deepEqual(response, { status: 200, body: { jobId: "daily-ready" } });
    assert.equal(
      calls.some((call) => call.name === "runGeneration"),
      false,
      "a successful daily job remains authoritative after a language switch",
    );
  }

  {
    const { calls, deps } = requestDeps({
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        return { id: "daily-failed", status: "failed" };
      },
    });
    const response = await handleGenerateMixRequest(
      {
        djId: "dj-1",
        language: "es",
        dropDate: "2026-07-22",
        localHour: 21,
      },
      "user-1",
      deps,
    );
    assert.deepEqual(response, { status: 200, body: { jobId: "daily-failed" } });
    const scheduled = calls.find((call) => call.name === "runGeneration");
    assert.equal((scheduled?.value as { language?: string })?.language, "es");
    assert.ok(calls.some((call) => call.name === "requeueDailyJob"));
  }

  function mediaResponse(
    status: number,
    bytes: number[],
  ): { ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> } {
    const body = Uint8Array.from(bytes);
    return {
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () =>
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  }

  await assert.rejects(
    () => downloadProviderMedia("https://media.test/fail", async () => mediaResponse(503, [1])),
    /503/,
  );
  await assert.rejects(
    () => downloadProviderMedia("https://media.test/empty", async () => mediaResponse(200, [])),
    /empty/i,
  );

  type ModelEvent = { role: string; language: string };
  function runDeps(overrides: Record<string, unknown> = {}) {
    const updates: Array<Record<string, unknown>> = [];
    const puts: Array<{ key: string; bytes: number[]; contentType: string }> = [];
    const deletes: string[][] = [];
    const modelEvents: ModelEvent[] = [];
    const errorEvents: unknown[][] = [];
    const replicateInputs: Array<{ endpoint: string; body: any }> = [];
    const insertedAudius: Array<Record<string, unknown>> = [];
    const deps = {
      updateJob: async (_jobId: string, patch: Record<string, unknown>) => {
        updates.push(patch);
      },
      findAudiusTrack: async () => null,
      insertAudiusTrack: async (track: Record<string, unknown>) => {
        insertedAudius.push(track);
        return { id: "audius-track" };
      },
      insertGeneratedTrack: async (track: Record<string, unknown>) => ({
        id: "generated-track",
        ...track,
      }),
      pickAudiusDrop: async () => null,
      replicateRun: async (endpoint: string, body: any) => {
        replicateInputs.push({ endpoint, body });
        return endpoint === LYRIA_ENDPOINT
          ? "https://media.test/music"
          : "https://media.test/tts";
      },
      replicateText: async () =>
        "[CAPTION_START]\nTurn it up [scream], then [laugh].\n[CAPTION_END]",
      fetchMedia: async (url: string) =>
        mediaResponse(200, url.endsWith("/music") ? [1, 2, 3] : [4, 5]),
      r2Put: async (key: string, bytes: Uint8Array, contentType: string) => {
        puts.push({ key, bytes: [...bytes], contentType });
        return `https://r2.test/${key}`;
      },
      r2Delete: async (keys: string[]) => {
        deletes.push(keys);
      },
      generateCover: async () => "https://r2.test/cover.jpg",
      streamUrl: (trackId: string) => `https://stream.test/${trackId}`,
      logModel: (event: ModelEvent) => modelEvents.push(event),
      logError: (...args: unknown[]) => errorEvents.push(args),
      now: () => "2026-07-22T12:00:00.000Z",
      random: () => 0,
      ...overrides,
    };
    return {
      deletes,
      deps,
      errorEvents,
      insertedAudius,
      modelEvents,
      puts,
      replicateInputs,
      updates,
    };
  }

  for (const badMusicResponse of [
    mediaResponse(502, [1]),
    mediaResponse(200, []),
  ]) {
    const state = runDeps({
      fetchMedia: async () => badMusicResponse,
    });
    await runGeneration(
      {
        jobId: "job-music-failure",
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.equal(state.updates.at(-1)?.status, "failed");
    assert.deepEqual(state.deletes, [[
      "tracks/generated/job-music-failure.mp3",
      "covers/generated/job-music-failure.jpg",
      "captions/generated/job-music-failure.mp3",
    ]]);
    assert.equal(state.puts.length, 0);
  }

  for (const badTtsResponse of [
    mediaResponse(503, [1]),
    mediaResponse(200, []),
  ]) {
    const state = runDeps({
      fetchMedia: async (url: string) =>
        url.endsWith("/music") ? mediaResponse(200, [1, 2, 3]) : badTtsResponse,
    });
    await runGeneration(
      {
        jobId: "job-generated-caption",
        cfg,
        lyrics: null,
        seasoning: [],
        language: "es",
        drop: { localHour: 21 },
      },
      state.deps,
    );
    const ready = state.updates.at(-1);
    assert.equal(ready?.status, "ready");
    assert.equal(ready?.caption, "Turn it up [scream], then [laugh].");
    assert.equal(ready?.caption_audio_url, null);
    assert.deepEqual(state.deletes, []);
    assert.deepEqual(
      state.errorEvents,
      [[{ stage: "caption_audio" }]],
      "best-effort logs must not receive provider errors or sensitive inputs",
    );
    const tts = state.replicateInputs.find(
      (input) => input.endpoint === INWORLD_TTS_ENDPOINT,
    );
    assert.ok(tts);
    assert.doesNotMatch(tts.body.input.text, /\[(?:scream|laugh)\]/i);
  }

  {
    const hostileTitle = "Luz [scream]";
    const hostileArtist = "Mara [laugh]";
    const displayCaption = fallbackAudiusCaption(
      "es",
      hostileTitle,
      hostileArtist,
    );
    const state = runDeps({
      pickAudiusDrop: async () => ({
        pick: {
          id: "audius-1",
          title: hostileTitle,
          user: { name: hostileArtist },
          duration: 180,
        },
        caption: displayCaption,
      }),
    });
    await runGeneration(
      {
        jobId: "job-audius-caption",
        cfg,
        lyrics: null,
        seasoning: [],
        language: "es",
        drop: { localHour: 21 },
      },
      state.deps,
    );
    const ready = state.updates.at(-1);
    assert.equal(ready?.status, "ready");
    assert.equal(ready?.caption, displayCaption);
    assert.equal(
      ready?.caption_audio_url,
      "https://r2.test/captions/generated/job-audius-caption.mp3",
    );
    const tts = state.replicateInputs.find(
      (input) => input.endpoint === INWORLD_TTS_ENDPOINT,
    );
    assert.ok(tts);
    assert.doesNotMatch(tts.body.input.text, /\[(?:scream|laugh)\]/i);
    assert.equal(state.insertedAudius[0]?.artist, hostileArtist);
  }

  for (const language of ["en", "es"] as const) {
    const state = runDeps({
      pickAudiusDrop: async () => ({
        pick: { id: `missing-${language}`, title: "Untitled", user: undefined },
        caption: fallbackAudiusCaption(language, "Untitled", null),
      }),
    });
    await runGeneration(
      {
        jobId: `job-missing-${language}`,
        cfg,
        lyrics: null,
        seasoning: [],
        language,
        drop: { localHour: 21 },
      },
      state.deps,
    );
    assert.equal(
      state.insertedAudius[0]?.artist,
      "—",
      "missing Audius artist persistence must not depend on request language",
    );
  }

  {
    const state = runDeps();
    await runGeneration(
      {
        jobId: "job-observability",
        cfg,
        lyrics: null,
        seasoning: [],
        language: "es",
        drop: { localHour: 21 },
      },
      state.deps,
    );
    assert.deepEqual(state.modelEvents, [
      { role: "audius", language: "es" },
      { role: "music", language: "es" },
      { role: "cover", language: "es" },
      { role: "caption", language: "es" },
      { role: "tts", language: "es" },
    ]);
    for (const event of state.modelEvents) {
      assert.deepEqual(
        Object.keys(event).sort(),
        ["language", "role"],
        "model observability must stay bounded to role and language",
      );
    }
  }

  console.log("generation orchestration checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
