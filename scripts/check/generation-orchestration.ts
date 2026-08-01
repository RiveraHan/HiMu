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
    mapFinalizedGeneratedMix,
    mapManualJobReservation,
    mapUpdatedRow,
    runGeneration,
  } = module;
  assert.equal(typeof downloadProviderMedia, "function");
  assert.equal(typeof handleGenerateMixRequest, "function");
  assert.equal(typeof mapFinalizedGeneratedMix, "function");
  assert.equal(typeof mapManualJobReservation, "function");
  assert.equal(typeof mapUpdatedRow, "function");
  assert.equal(typeof runGeneration, "function");

  const databaseError = new Error("database failed");
  assert.throws(
    () => mapManualJobReservation(null, databaseError),
    /database failed/,
  );
  assert.deepEqual(
    mapManualJobReservation(
      [{ outcome: "created", job_id: "job-1", daily_limit: 10 }],
      null,
    ),
    { outcome: "created", jobId: "job-1", dailyLimit: 10 },
  );
  for (const malformed of [
    [],
    [
      { outcome: "created", job_id: "job-1", daily_limit: 10 },
      { outcome: "quota", job_id: null, daily_limit: 10 },
    ],
    [{ outcome: "unknown", job_id: "job-1", daily_limit: 10 }],
    [{ outcome: "created", job_id: null, daily_limit: 10 }],
  ]) {
    assert.throws(
      () => mapManualJobReservation(malformed, null),
      /reservation/i,
    );
  }
  assert.throws(() => mapUpdatedRow(null, databaseError), /database failed/);
  assert.equal(mapUpdatedRow({ id: "job-1" }, null), true);
  assert.equal(mapUpdatedRow(null, null), false);
  assert.throws(
    () =>
      mapFinalizedGeneratedMix(
        null,
        databaseError,
        "job-1",
        "track-1",
      ),
    /database failed/,
  );
  assert.deepEqual(
    mapFinalizedGeneratedMix(
      { job_id: "job-1", track_id: "track-1", track_title: "Title" },
      null,
      "job-1",
      "track-1",
    ),
    { id: "track-1", title: "Title" },
  );
  assert.throws(
    () =>
      mapFinalizedGeneratedMix(
        { job_id: "other", track_id: "track-1", track_title: "Title" },
        null,
        "job-1",
        "track-1",
      ),
    /finalization/i,
  );

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
      findActiveManualJob: async () => {
        calls.push({ name: "findActiveManualJob" });
        return null;
      },
      failStaleManualJob: async (
        jobId: string,
        observedUpdatedAt: string,
        failedAt: string,
      ) => {
        calls.push({
          name: "failStaleManualJob",
          value: { jobId, observedUpdatedAt, failedAt },
        });
        return true;
      },
      reserveManualJob: async (input: unknown) => {
        calls.push({ name: "reserveManualJob", value: input });
        return { outcome: "created", jobId: "manual-new", dailyLimit: 10 };
      },
      runGeneration: async (input: unknown) => {
        calls.push({ name: "runGeneration", value: input });
      },
      waitUntil: (promise: Promise<void>) => {
        calls.push({ name: "waitUntil" });
        void promise;
      },
      now: () => "2026-07-29T12:00:00.000Z",
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
    assert.deepEqual(
      calls
        .filter(({ name }) =>
          ["reserveManualJob", "buildSeasoning", "runGeneration"].includes(name)
        )
        .map(({ name }) => name),
      ["reserveManualJob", "buildSeasoning", "runGeneration"],
    );
  }

  {
    const { calls, deps } = requestDeps({
      findActiveManualJob: async () => {
        calls.push({ name: "findActiveManualJob" });
        return {
          id: "manual-active",
          status: "generating",
          updatedAt: "2026-07-29T11:59:00.000Z",
        };
      },
      now: () => "2026-07-29T12:00:00.000Z",
    });
    const response = await handleGenerateMixRequest(
      { djId: "dj-1", language: "en" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 200,
      body: { jobId: "manual-active" },
    });
    assert.equal(calls.some(({ name }) => name === "reserveManualJob"), false);
    assert.equal(calls.some(({ name }) => name === "runGeneration"), false);
    assert.equal(calls.some(({ name }) => name === "buildSeasoning"), false);
  }

  await assert.rejects(
    () => {
      const { deps } = requestDeps({
        findActiveManualJob: async () => {
          throw new Error("active lookup failed");
        },
      });
      return handleGenerateMixRequest(
        { djId: "dj-1", language: "en" },
        "user-1",
        deps,
      );
    },
    /active lookup failed/,
  );

  {
    let lookup = 0;
    const { calls, deps } = requestDeps({
      findActiveManualJob: async () => {
        calls.push({ name: "findActiveManualJob" });
        lookup += 1;
        return lookup === 1
          ? {
            id: "manual-stale",
            status: "queued",
            updatedAt: "2026-07-29T11:44:00.000Z",
          }
          : null;
      },
      now: () => "2026-07-29T12:00:00.000Z",
    });
    const response = await handleGenerateMixRequest(
      { djId: "dj-1", language: "en" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, { status: 200, body: { jobId: "manual-new" } });
    assert.deepEqual(
      calls.find(({ name }) => name === "failStaleManualJob")?.value,
      {
        jobId: "manual-stale",
        observedUpdatedAt: "2026-07-29T11:44:00.000Z",
        failedAt: "2026-07-29T12:00:00.000Z",
      },
    );
    assert.equal(
      calls.filter(({ name }) => name === "reserveManualJob").length,
      1,
    );
    assert.equal(calls.filter(({ name }) => name === "runGeneration").length, 1);
  }

  {
    let lookup = 0;
    const { calls, deps } = requestDeps({
      findActiveManualJob: async () => {
        calls.push({ name: "findActiveManualJob" });
        lookup += 1;
        return lookup === 1
          ? {
            id: "manual-stale",
            status: "queued",
            updatedAt: "2026-07-29T11:44:00.000Z",
          }
          : {
            id: "manual-refreshed",
            status: "generating",
            updatedAt: "2026-07-29T11:59:30.000Z",
          };
      },
      failStaleManualJob: async () => {
        calls.push({ name: "failStaleManualJob" });
        return false;
      },
    });
    const response = await handleGenerateMixRequest(
      { djId: "dj-1", language: "en" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 200,
      body: { jobId: "manual-refreshed" },
    });
    assert.equal(
      calls.filter(({ name }) => name === "findActiveManualJob").length,
      2,
    );
    assert.equal(calls.some(({ name }) => name === "reserveManualJob"), false);
    assert.equal(calls.some(({ name }) => name === "runGeneration"), false);
  }

  {
    const { calls, deps } = requestDeps({
      reserveManualJob: async () => ({
        outcome: "quota",
        jobId: null,
        dailyLimit: 10,
      }),
    });
    const response = await handleGenerateMixRequest(
      { djId: "dj-1", language: "en" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 429,
      body: {
        error: "daily limit of 10 mixes reached",
        code: "daily_quota_reached",
      },
    });
    assert.equal(calls.some(({ name }) => name === "buildSeasoning"), false);
    assert.equal(calls.some(({ name }) => name === "runGeneration"), false);
  }

  {
    const { calls, deps } = requestDeps({
      reserveManualJob: async () => ({
        outcome: "existing",
        jobId: "manual-race-winner",
        dailyLimit: 10,
      }),
    });
    const response = await handleGenerateMixRequest(
      { djId: "dj-1", language: "en" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 200,
      body: { jobId: "manual-race-winner" },
    });
    assert.equal(calls.some(({ name }) => name === "runGeneration"), false);
    assert.equal(calls.some(({ name }) => name === "buildSeasoning"), false);
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
    const marks: Array<{ jobId: string; startedAt: string }> = [];
    const finalizations: Array<Record<string, unknown>> = [];
    const failures: Array<{ jobId: string; error: string; failedAt: string }> = [];
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
      markJobGenerating: async (jobId: string, startedAt: string) => {
        marks.push({ jobId, startedAt });
        return true;
      },
      finalizeGeneratedMix: async (input: Record<string, unknown>) => {
        finalizations.push(input);
        return { id: String(input.trackId), title: String(input.title) };
      },
      failJobIfActive: async (jobId: string, error: string, failedAt: string) => {
        failures.push({ jobId, error, failedAt });
        return true;
      },
      findAudiusTrack: async () => null,
      insertAudiusTrack: async (track: Record<string, unknown>) => {
        insertedAudius.push(track);
        return { id: "audius-track" };
      },
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
      randomId: () => "generated-track",
      random: () => 0,
      ...overrides,
    };
    return {
      deletes,
      deps,
      errorEvents,
      failures,
      finalizations,
      insertedAudius,
      marks,
      modelEvents,
      puts,
      replicateInputs,
      updates,
    };
  }

  {
    const state = runDeps({
      markJobGenerating: async () => false,
    });
    await runGeneration(
      {
        jobId: "job-cas-lost",
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.deepEqual(state.replicateInputs, []);
    assert.deepEqual(state.puts, []);
    assert.deepEqual(state.finalizations, []);
    assert.deepEqual(state.failures, []);
    assert.deepEqual(state.deletes, []);
  }

  {
    const state = runDeps({
      finalizeGeneratedMix: async () => {
        throw new Error("finalize failed");
      },
    });
    await runGeneration(
      {
        jobId: "job-finalize-failure",
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.equal(state.failures.length, 1);
    assert.deepEqual(state.deletes, [[
      "tracks/generated/job-finalize-failure.mp3",
      "covers/generated/job-finalize-failure.jpg",
      "captions/generated/job-finalize-failure.mp3",
    ]]);
  }

  for (const failJobIfActive of [
    async () => false,
    async () => {
      throw new Error("failure transition failed");
    },
  ]) {
    const state = runDeps({
      finalizeGeneratedMix: async () => {
        throw new Error("finalize failed");
      },
      failJobIfActive,
    });
    await runGeneration(
      {
        jobId: "job-terminal-ambiguous",
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.deepEqual(state.deletes, []);
    assert.ok(
      state.errorEvents.some(([event]) =>
        ["terminal_ambiguous", "job_failure_persist"].includes(
          String((event as { stage?: string })?.stage),
        )
      ),
    );
  }

  {
    const state = runDeps({
      markJobGenerating: async () => {
        throw new Error("generating transition failed");
      },
    });
    await assert.rejects(
      () =>
        runGeneration(
          {
            jobId: "job-generating-error",
            cfg,
            lyrics: null,
            seasoning: [],
            language: "en",
          },
          state.deps,
        ),
      /generating transition failed/,
    );
    assert.deepEqual(state.failures, []);
    assert.deepEqual(state.deletes, []);
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
    assert.equal(state.failures.length, 1);
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
    const ready = state.finalizations.at(-1);
    assert.equal(ready?.caption, "Turn it up [scream], then [laugh].");
    assert.equal(ready?.captionAudioUrl, null);
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
