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
      [{
        outcome: "created",
        job_id: "job-1",
        daily_limit: 10,
        queued_at: "2026-07-29T12:00:00.000Z",
      }],
      null,
    ),
    {
      outcome: "created",
      jobId: "job-1",
      dailyLimit: 10,
      queuedAt: "2026-07-29T12:00:00.000Z",
    },
  );
  for (const malformed of [
    [],
    [
      {
        outcome: "created",
        job_id: "job-1",
        daily_limit: 10,
        queued_at: "2026-07-29T12:00:00.000Z",
      },
      { outcome: "quota", job_id: null, daily_limit: 10 },
    ],
    [{ outcome: "unknown", job_id: "job-1", daily_limit: 10 }],
    [{ outcome: "created", job_id: null, daily_limit: 10 }],
    [{ outcome: "created", job_id: "job-1", daily_limit: 10 }],
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
  const persistedCfg = {
    ...cfg,
    dj_id: "dj-persisted",
    djs: { ...cfg.djs, name: "Persisted DJ" },
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
      requeueDailyJob: async (
        jobId: string,
        observedStatus: string,
        observedUpdatedAt: string,
        requeuedAt: string,
      ) => {
        calls.push({
          name: "requeueDailyJob",
          value: { jobId, observedStatus, observedUpdatedAt, requeuedAt },
        });
        return true;
      },
      createDailyJob: async () => {
        calls.push({ name: "createDailyJob" });
        return {
          job: {
            id: "daily-new",
            status: "queued",
            djId: "dj-1",
            updatedAt: "2026-07-29T12:00:00.000Z",
          },
          error: null,
        };
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
        return {
          outcome: "created",
          jobId: "manual-new",
          dailyLimit: 10,
          queuedAt: "2026-07-29T12:00:00.000Z",
        };
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
        return {
          id: "daily-ready",
          status: "ready",
          djId: "dj-1",
          updatedAt: "2026-07-22T11:00:00.000Z",
        };
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
        return {
          id: "daily-fresh",
          status: "generating",
          djId: "dj-1",
          updatedAt: "2026-07-29T11:45:00.000Z",
        };
      },
    });
    const response = await handleGenerateMixRequest(
      {
        djId: "dj-1",
        language: "en",
        dropDate: "2026-07-29",
        localHour: 12,
      },
      "user-1",
      deps,
    );
    assert.deepEqual(response, { status: 200, body: { jobId: "daily-fresh" } });
    assert.equal(calls.some(({ name }) => name === "requeueDailyJob"), false);
    assert.equal(calls.some(({ name }) => name === "runGeneration"), false);
  }

  {
    const { calls, deps } = requestDeps({
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        return {
          id: "daily-stale",
          status: "queued",
          djId: "dj-1",
          updatedAt: "2026-07-29T11:44:59.000Z",
        };
      },
    });
    const response = await handleGenerateMixRequest(
      {
        djId: "dj-1",
        language: "en",
        dropDate: "2026-07-29",
        localHour: 12,
      },
      "user-1",
      deps,
    );
    assert.deepEqual(response, { status: 200, body: { jobId: "daily-stale" } });
    assert.deepEqual(
      calls.find(({ name }) => name === "requeueDailyJob")?.value,
      {
        jobId: "daily-stale",
        observedStatus: "queued",
        observedUpdatedAt: "2026-07-29T11:44:59.000Z",
        requeuedAt: "2026-07-29T12:00:00.000Z",
      },
    );
    assert.equal(calls.filter(({ name }) => name === "runGeneration").length, 1);
    assert.equal(calls.filter(({ name }) => name === "waitUntil").length, 1);
  }

  {
    let lookup = 0;
    const { calls, deps } = requestDeps({
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        lookup += 1;
        return lookup === 1
          ? {
            id: "daily-stale",
            status: "generating",
            djId: "dj-1",
            updatedAt: "2026-07-29T11:44:00.000Z",
          }
          : {
            id: "daily-race-winner",
            status: "queued",
            djId: "dj-1",
            updatedAt: "2026-07-29T12:00:00.000Z",
          };
      },
      requeueDailyJob: async () => {
        calls.push({ name: "requeueDailyJob" });
        return false;
      },
    });
    const response = await handleGenerateMixRequest(
      {
        djId: "dj-1",
        language: "en",
        dropDate: "2026-07-29",
        localHour: 12,
      },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 200,
      body: { jobId: "daily-race-winner" },
    });
    assert.equal(calls.filter(({ name }) => name === "findDailyJob").length, 2);
    assert.equal(calls.some(({ name }) => name === "runGeneration"), false);
    assert.equal(calls.some(({ name }) => name === "waitUntil"), false);
  }

  {
    const { calls, deps } = requestDeps({
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        return {
          id: "daily-persisted-dj",
          status: "generating",
          djId: "dj-persisted",
          updatedAt: "2026-07-29T11:44:00.000Z",
        };
      },
      getDjConfig: async (djId: string) => {
        calls.push({ name: "getDjConfig", value: djId });
        return djId === "dj-persisted" ? persistedCfg : cfg;
      },
      buildSeasoning: async (_userId: string, dj: { name?: string }) => {
        calls.push({ name: "buildSeasoning", value: dj.name });
        return ["persisted seasoning"];
      },
    });
    const response = await handleGenerateMixRequest(
      {
        djId: "dj-request",
        language: "en",
        dropDate: "2026-07-29",
        localHour: 12,
      },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 200,
      body: { jobId: "daily-persisted-dj" },
    });
    assert.deepEqual(
      calls.filter(({ name }) => name === "getDjConfig").map(({ value }) => value),
      ["dj-persisted"],
    );
    assert.equal(
      calls.find(({ name }) => name === "buildSeasoning")?.value,
      "Persisted DJ",
    );
    const scheduled = calls.find(({ name }) => name === "runGeneration")
      ?.value as { cfg?: { dj_id?: string }; queuedAt?: string } | undefined;
    assert.equal(scheduled?.cfg?.dj_id, "dj-persisted");
    assert.equal(scheduled?.queuedAt, "2026-07-29T12:00:00.000Z");
  }

  {
    const { calls, deps } = requestDeps({
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        return {
          id: "daily-failed",
          status: "failed",
          djId: "dj-1",
          updatedAt: "2026-07-29T11:00:00.000Z",
        };
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
    assert.deepEqual(
      calls.find((call) => call.name === "requeueDailyJob")?.value,
      {
        jobId: "daily-failed",
        observedStatus: "failed",
        observedUpdatedAt: "2026-07-29T11:00:00.000Z",
        requeuedAt: "2026-07-29T12:00:00.000Z",
      },
    );
  }

  {
    let lookup = 0;
    const { calls, deps } = requestDeps({
      findDailyJob: async () => {
        calls.push({ name: "findDailyJob" });
        lookup += 1;
        return lookup === 1
          ? null
          : {
            id: "daily-create-race-winner",
            status: "queued",
            djId: "dj-1",
            updatedAt: "2026-07-29T12:00:00.000Z",
          };
      },
      createDailyJob: async () => {
        calls.push({ name: "createDailyJob" });
        return { job: null, error: new Error("unique violation") };
      },
    });
    const response = await handleGenerateMixRequest(
      {
        djId: "dj-1",
        language: "en",
        dropDate: "2026-07-29",
        localHour: 12,
      },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 200,
      body: { jobId: "daily-create-race-winner" },
    });
    assert.equal(calls.filter(({ name }) => name === "findDailyJob").length, 2);
    assert.equal(calls.some(({ name }) => name === "runGeneration"), false);
    assert.equal(calls.some(({ name }) => name === "waitUntil"), false);
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
  const defaultQueuedAt = "2026-07-22T11:59:00.000Z";
  function runDeps(overrides: Record<string, unknown> = {}) {
    const updates: Array<{
      jobId: string;
      attemptStartedAt: string;
      patch: Record<string, unknown>;
    }> = [];
    const marks: Array<{
      jobId: string;
      queuedAt: string;
      startedAt: string;
    }> = [];
    const finalizations: Array<Record<string, unknown>> = [];
    const failures: Array<{
      jobId: string;
      error: string;
      failedAt: string;
      fence?: { queuedAt?: string; generatingAt: string };
    }> = [];
    const puts: Array<{ key: string; bytes: number[]; contentType: string }> = [];
    const coverInputs: string[] = [];
    const deletes: string[][] = [];
    const modelEvents: ModelEvent[] = [];
    const errorEvents: unknown[][] = [];
    const replicateInputs: Array<{ endpoint: string; body: any }> = [];
    const insertedAudius: Array<Record<string, unknown>> = [];
    const deps = {
      updateJob: async (
        jobId: string,
        attemptStartedAt: string,
        patch: Record<string, unknown>,
      ) => {
        updates.push({ jobId, attemptStartedAt, patch });
        return true;
      },
      markJobGenerating: async (
        jobId: string,
        queuedAt: string,
        startedAt: string,
      ) => {
        marks.push({ jobId, queuedAt, startedAt });
        return true;
      },
      finalizeGeneratedMix: async (input: Record<string, unknown>) => {
        finalizations.push(input);
        return { id: String(input.trackId), title: String(input.title) };
      },
      failJobIfActive: async (
        jobId: string,
        error: string,
        failedAt: string,
        fence?: { queuedAt?: string; generatingAt: string },
      ) => {
        failures.push({ jobId, error, failedAt, fence });
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
      generateCover: async (objectKey: string) => {
        coverInputs.push(objectKey);
        return `https://r2.test/${objectKey}`;
      },
      streamUrl: (trackId: string) => `https://stream.test/${trackId}`,
      logModel: (event: ModelEvent) => modelEvents.push(event),
      logError: (...args: unknown[]) => errorEvents.push(args),
      now: () => "2026-07-22T12:00:00.000Z",
      randomId: () => "generated-track",
      random: () => 0,
      ...overrides,
    };
    return {
      coverInputs,
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
    const claims: Array<{
      jobId: string;
      queuedAt: string;
      startedAt: string;
    }> = [];
    const state = runDeps({
      markJobGenerating: async (
        jobId: string,
        queuedAt: string,
        startedAt: string,
      ) => {
        claims.push({ jobId, queuedAt, startedAt });
        return false;
      },
    });
    await runGeneration(
      {
        jobId: "job-cas-lost",
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.deepEqual(claims, [{
      jobId: "job-cas-lost",
      queuedAt: defaultQueuedAt,
      startedAt: "2026-07-22T12:00:00.000Z",
    }]);
    assert.deepEqual(state.replicateInputs, []);
    assert.deepEqual(state.puts, []);
    assert.deepEqual(state.finalizations, []);
    assert.deepEqual(state.failures, []);
    assert.deepEqual(state.deletes, []);
  }

  {
    const state = runDeps({
      pickAudiusDrop: async () => ({
        pick: {
          id: "persisted-dj-audius",
          title: "Persisted pick",
          user: { name: "Persisted artist" },
          duration: 180,
        },
        caption: "Persisted caption",
      }),
    });
    await runGeneration(
      {
        jobId: "job-persisted-dj-audius",
        queuedAt: defaultQueuedAt,
        cfg: persistedCfg,
        lyrics: null,
        seasoning: ["persisted seasoning"],
        language: "en",
        drop: { localHour: 12 },
      },
      state.deps,
    );
    assert.equal(state.insertedAudius[0]?.dj_id, "dj-persisted");
    assert.equal(state.updates[0]?.jobId, "job-persisted-dj-audius");
  }

  {
    const state = runDeps();
    await runGeneration(
      {
        jobId: "job-persisted-dj-generated",
        queuedAt: defaultQueuedAt,
        cfg: persistedCfg,
        lyrics: null,
        seasoning: ["persisted seasoning"],
        language: "en",
      },
      state.deps,
    );
    assert.equal(state.finalizations[0]?.djId, "dj-persisted");
  }

  {
    const firstStartedAt = "2026-07-22T12:00:00.000Z";
    const secondStartedAt = "2026-07-22T12:16:00.000Z";
    const first = runDeps({ now: () => firstStartedAt });
    const second = runDeps({ now: () => secondStartedAt });
    const input = {
      jobId: "job-recovered-attempt",
      queuedAt: defaultQueuedAt,
      cfg,
      lyrics: null,
      seasoning: [],
      language: "en" as const,
      drop: { localHour: 12 },
    };

    await runGeneration(input, first.deps);
    await runGeneration(input, second.deps);

    assert.equal(first.finalizations[0]?.attemptStartedAt, firstStartedAt);
    assert.equal(second.finalizations[0]?.attemptStartedAt, secondStartedAt);
    assert.equal(first.puts.length, second.puts.length);
    for (let index = 0; index < first.puts.length; index += 1) {
      assert.notEqual(
        first.puts[index]?.key,
        second.puts[index]?.key,
        "recovered attempts must not share writable media keys",
      );
    }
    assert.notEqual(first.coverInputs[0], second.coverInputs[0]);
  }

  {
    const staleStartedAt = "2026-07-22T12:00:00.000Z";
    const recoveredStartedAt = "2026-07-22T12:16:00.000Z";
    let activeAttempt = staleStartedAt;
    let releaseProvider!: () => void;
    let providerReached!: () => void;
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const reachedProvider = new Promise<void>((resolve) => {
      providerReached = resolve;
    });
    const failureFences: Array<{
      queuedAt?: string;
      generatingAt: string;
    }> = [];
    const state = runDeps({
      now: () => staleStartedAt,
      replicateRun: async () => {
        providerReached();
        await providerGate;
        return "https://media.test/music";
      },
      finalizeGeneratedMix: async (input: Record<string, unknown>) => {
        state.finalizations.push(input);
        if (input.attemptStartedAt !== activeAttempt) {
          throw new Error("stale generation attempt");
        }
        return { id: String(input.trackId), title: String(input.title) };
      },
      failJobIfActive: async (
        _jobId: string,
        _error: string,
        _failedAt: string,
        fence: { queuedAt?: string; generatingAt: string },
      ) => {
        failureFences.push(fence);
        return fence.generatingAt === activeAttempt;
      },
    });

    const staleRun = runGeneration(
      {
        jobId: "job-paused-stale-attempt",
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    await reachedProvider;
    activeAttempt = recoveredStartedAt;
    releaseProvider();
    await staleRun;

    assert.equal(state.finalizations[0]?.attemptStartedAt, staleStartedAt);
    assert.deepEqual(failureFences, [{ generatingAt: staleStartedAt }]);
    assert.deepEqual(
      state.deletes,
      [],
      "a resumed stale attempt must not delete the recovered attempt's media",
    );
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
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.equal(state.failures.length, 1);
    assert.deepEqual(
      state.failures[0]?.fence,
      { generatingAt: "2026-07-22T12:00:00.000Z" },
    );
    assert.deepEqual(state.deletes, [[
      "tracks/generated/job-finalize-failure/2026-07-22T12%3A00%3A00.000Z.mp3",
      "covers/generated/job-finalize-failure/2026-07-22T12%3A00%3A00.000Z.jpg",
      "captions/generated/job-finalize-failure/2026-07-22T12%3A00%3A00.000Z.mp3",
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
        queuedAt: defaultQueuedAt,
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
    const queuedAt = "2026-07-22T11:59:00.000Z";
    const replacementStartedAt = "2026-07-22T12:16:00.000Z";
    let status = "queued";
    let updatedAt = queuedAt;
    const fences: unknown[] = [];
    const state = runDeps({
      markJobGenerating: async () => {
        status = "generating";
        updatedAt = replacementStartedAt;
        throw new Error("claim response arrived after replacement");
      },
      failJobIfActive: async (
        _jobId: string,
        _error: string,
        _failedAt: string,
        fence: {
          queuedAt?: string;
          generatingAt: string;
        },
      ) => {
        fences.push(fence);
        const matchesQueued = status === "queued" &&
          updatedAt === fence?.queuedAt;
        const matchesGenerating = status === "generating" &&
          updatedAt === fence?.generatingAt;
        if (!matchesQueued && !matchesGenerating) return false;
        status = "failed";
        return true;
      },
    });
    await runGeneration(
      {
        jobId: "job-claim-replacement-race",
        queuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.deepEqual(fences, [{
      queuedAt,
      generatingAt: "2026-07-22T12:00:00.000Z",
    }]);
    assert.equal(status, "generating");
    assert.equal(updatedAt, replacementStartedAt);
    assert.deepEqual(state.deletes, []);
  }

  {
    let status = "queued";
    let updatedAt = defaultQueuedAt;
    const state = runDeps({
      markJobGenerating: async () => {
        throw new Error("generating transition failed");
      },
      failJobIfActive: async (
        jobId: string,
        error: string,
        failedAt: string,
        fence: { queuedAt?: string; generatingAt: string },
      ) => {
        state.failures.push({ jobId, error, failedAt, fence });
        const matchesQueued = status === "queued" &&
          updatedAt === fence.queuedAt;
        const matchesGenerating = status === "generating" &&
          updatedAt === fence.generatingAt;
        if (!matchesQueued && !matchesGenerating) return false;
        status = "failed";
        updatedAt = failedAt;
        return true;
      },
    });
    await runGeneration(
      {
        jobId: "job-generating-error",
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.equal(state.failures.length, 1);
    assert.equal(state.failures[0]?.jobId, "job-generating-error");
    assert.deepEqual(state.failures[0]?.fence, {
      queuedAt: defaultQueuedAt,
      generatingAt: "2026-07-22T12:00:00.000Z",
    });
    assert.equal(status, "failed");
    assert.match(state.failures[0]?.error ?? "", /generating transition failed/);
    assert.deepEqual(state.modelEvents, []);
    assert.deepEqual(state.replicateInputs, []);
    assert.deepEqual(state.puts, []);
    assert.deepEqual(state.finalizations, []);
    assert.deepEqual(state.deletes, [[
      "tracks/generated/job-generating-error/2026-07-22T12%3A00%3A00.000Z.mp3",
      "covers/generated/job-generating-error/2026-07-22T12%3A00%3A00.000Z.jpg",
      "captions/generated/job-generating-error/2026-07-22T12%3A00%3A00.000Z.mp3",
    ]]);
  }

  {
    let status = "queued";
    let updatedAt = defaultQueuedAt;
    const state = runDeps({
      markJobGenerating: async (
        _jobId: string,
        _queuedAt: string,
        startedAt: string,
      ) => {
        status = "generating";
        updatedAt = startedAt;
        throw new Error("ambiguous generating response");
      },
      failJobIfActive: async (
        jobId: string,
        error: string,
        failedAt: string,
        fence: { queuedAt?: string; generatingAt: string },
      ) => {
        state.failures.push({ jobId, error, failedAt, fence });
        if (jobId !== "job-ambiguous-generating") return false;
        const matchesQueued = status === "queued" &&
          updatedAt === fence.queuedAt;
        const matchesGenerating = status === "generating" &&
          updatedAt === fence.generatingAt;
        if (!matchesQueued && !matchesGenerating) return false;
        status = "failed";
        return true;
      },
    });
    await runGeneration(
      {
        jobId: "job-ambiguous-generating",
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.equal(status, "failed");
    assert.equal(state.failures.length, 1);
    assert.equal(state.failures[0]?.jobId, "job-ambiguous-generating");
    assert.deepEqual(state.failures[0]?.fence, {
      queuedAt: defaultQueuedAt,
      generatingAt: "2026-07-22T12:00:00.000Z",
    });
    assert.deepEqual(state.modelEvents, []);
    assert.deepEqual(state.replicateInputs, []);
    assert.deepEqual(state.deletes, [[
      "tracks/generated/job-ambiguous-generating/2026-07-22T12%3A00%3A00.000Z.mp3",
      "covers/generated/job-ambiguous-generating/2026-07-22T12%3A00%3A00.000Z.jpg",
      "captions/generated/job-ambiguous-generating/2026-07-22T12%3A00%3A00.000Z.mp3",
    ]]);
  }

  {
    const state = runDeps({
      markJobGenerating: async () => {
        throw new Error("generating transition failed");
      },
      failJobIfActive: async () => {
        throw new Error("failure transition failed");
      },
    });
    await runGeneration(
      {
        jobId: "job-claim-compensation-failed",
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.deepEqual(state.modelEvents, []);
    assert.deepEqual(state.replicateInputs, []);
    assert.deepEqual(state.deletes, []);
    assert.deepEqual(state.errorEvents, [[{ stage: "job_failure_persist" }]]);
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
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
      },
      state.deps,
    );
    assert.equal(state.failures.length, 1);
    assert.deepEqual(state.deletes, [[
      "tracks/generated/job-music-failure/2026-07-22T12%3A00%3A00.000Z.mp3",
      "covers/generated/job-music-failure/2026-07-22T12%3A00%3A00.000Z.jpg",
      "captions/generated/job-music-failure/2026-07-22T12%3A00%3A00.000Z.mp3",
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
        queuedAt: defaultQueuedAt,
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
    const updateAttempts: string[] = [];
    const state = runDeps({
      pickAudiusDrop: async () => ({
        pick: {
          id: "audius-stale",
          title: "Stale pick",
          user: { name: "Stale artist" },
          duration: 180,
        },
        caption: "Stale caption",
      }),
      updateJob: async (
        _jobId: string,
        attemptStartedAt: string,
      ) => {
        updateAttempts.push(attemptStartedAt);
        return false;
      },
    });
    await runGeneration(
      {
        jobId: "job-stale-audius-attempt",
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "en",
        drop: { localHour: 21 },
      },
      state.deps,
    );
    assert.deepEqual(updateAttempts, ["2026-07-22T12:00:00.000Z"]);
    assert.deepEqual(state.finalizations, []);
    assert.equal(
      state.modelEvents.some(({ role }) => role === "music"),
      false,
      "a stale Audius attempt must stop instead of falling back to generation",
    );
    assert.deepEqual(state.deletes, []);
    assert.ok(
      state.errorEvents.some(([event]) =>
        (event as { stage?: string })?.stage === "terminal_ambiguous"
      ),
    );
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
        queuedAt: defaultQueuedAt,
        cfg,
        lyrics: null,
        seasoning: [],
        language: "es",
        drop: { localHour: 21 },
      },
      state.deps,
    );
    const ready = state.updates.at(-1);
    assert.equal(ready?.jobId, "job-audius-caption");
    assert.equal(ready?.attemptStartedAt, "2026-07-22T12:00:00.000Z");
    assert.equal(ready?.patch.status, "ready");
    assert.equal(ready?.patch.caption, displayCaption);
    assert.equal(
      ready?.patch.caption_audio_url,
      "https://r2.test/captions/generated/job-audius-caption/2026-07-22T12%3A00%3A00.000Z.mp3",
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
        queuedAt: defaultQueuedAt,
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
        queuedAt: defaultQueuedAt,
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
