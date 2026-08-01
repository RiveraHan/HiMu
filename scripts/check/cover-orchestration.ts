import assert from "node:assert/strict";

async function main() {
  const module = await import(
    "../../supabase/functions/regenerate-cover/cover-orchestration"
  ).catch(() => null);
  assert.ok(module, "cover orchestration module must be executable outside Deno");

  const {
    handleRegenerateCoverRequest,
    mapCoverFinalization,
    mapCoverReservation,
    mapCoverReservationFailure,
  } = module;
  assert.equal(typeof handleRegenerateCoverRequest, "function");
  assert.equal(typeof mapCoverFinalization, "function");
  assert.equal(typeof mapCoverReservation, "function");
  assert.equal(typeof mapCoverReservationFailure, "function");

  const databaseError = new Error("cover database failed");
  assert.throws(
    () => mapCoverReservation(null, databaseError),
    /cover database failed/,
  );
  assert.deepEqual(
    mapCoverReservation(
      [{ outcome: "reserved", reservation_id: "reservation-1", daily_limit: 10 }],
      null,
    ),
    { outcome: "reserved", reservationId: "reservation-1", dailyLimit: 10 },
  );
  for (const malformed of [
    [],
    [
      { outcome: "reserved", reservation_id: "one", daily_limit: 10 },
      { outcome: "quota", reservation_id: null, daily_limit: 10 },
    ],
    [{ outcome: "unknown", reservation_id: "reservation-1", daily_limit: 10 }],
    [{ outcome: "reserved", reservation_id: null, daily_limit: 10 }],
  ]) {
    assert.throws(() => mapCoverReservation(malformed, null), /reservation/i);
  }
  assert.throws(
    () => mapCoverFinalization(null, databaseError),
    /cover database failed/,
  );
  assert.equal(mapCoverFinalization(null, null), null);
  assert.equal(
    mapCoverFinalization("https://r2.test/covers/generated/old.jpg", null),
    "https://r2.test/covers/generated/old.jpg",
  );
  assert.throws(() => mapCoverFinalization({ bad: true }, null), /finalization/i);
  assert.throws(
    () => mapCoverReservationFailure(null, databaseError),
    /cover database failed/,
  );
  assert.equal(mapCoverReservationFailure(true, null), true);
  assert.equal(mapCoverReservationFailure(false, null), false);
  assert.throws(
    () => mapCoverReservationFailure(null, null),
    /failure result/i,
  );

  const ownedTrack = {
    id: "track-1",
    genre: "Pop",
    moodTags: ["bright"],
    djId: "dj-1",
    source: null,
    ownerId: "user-1",
  };

  function fixture(overrides: Record<string, unknown> = {}) {
    const calls: Array<{ name: string; value?: unknown }> = [];
    const deps = {
      getTrack: async (trackId: string) => {
        calls.push({ name: "getTrack", value: trackId });
        return ownedTrack;
      },
      getDjConfig: async (djId: string) => {
        calls.push({ name: "getDjConfig", value: djId });
        return { isInstrumental: false };
      },
      reserveCover: async (input: unknown) => {
        calls.push({ name: "reserveCover", value: input });
        return {
          outcome: "reserved",
          reservationId: "reservation-1",
          dailyLimit: 10,
        };
      },
      generateCover: async (key: string, input: unknown) => {
        calls.push({ name: "generateCover", value: { key, input } });
        return `https://r2.test/${key}`;
      },
      finalizeCover: async (input: unknown) => {
        calls.push({ name: "finalizeCover", value: input });
        return "https://r2.test/covers/generated/old.jpg";
      },
      failReservation: async (input: unknown) => {
        calls.push({ name: "failReservation", value: input });
        return true;
      },
      keyFromPublicUrl: (url: string) =>
        url.startsWith("https://r2.test/covers/generated/")
          ? url.slice("https://r2.test/".length)
          : null,
      r2Delete: async (keys: string[]) => {
        calls.push({ name: "r2Delete", value: keys });
      },
      now: () => "2026-07-29T12:00:00.000Z",
      logError: (event: unknown) => calls.push({ name: "logError", value: event }),
      ...overrides,
    };
    return { calls, deps };
  }

  for (const getTrack of [
    async () => null,
    async () => ({ ...ownedTrack, ownerId: "user-2" }),
  ]) {
    const { calls, deps } = fixture({ getTrack });
    const response = await handleRegenerateCoverRequest(
      { trackId: "track-1" },
      "user-1",
      deps,
    );
    assert.ok([403, 404].includes(response.status));
    assert.equal(calls.some(({ name }) => name === "reserveCover"), false);
  }

  {
    const { calls, deps } = fixture({
      getTrack: async () => ({ ...ownedTrack, source: "audius" }),
    });
    const response = await handleRegenerateCoverRequest(
      { trackId: "track-1" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 403,
      body: {
        error: "this track's cover can't be regenerated",
        code: "external_track",
      },
    });
    assert.equal(calls.some(({ name }) => name === "reserveCover"), false);
  }

  {
    const { calls, deps } = fixture({
      reserveCover: async () => ({
        outcome: "quota",
        reservationId: null,
        dailyLimit: 10,
      }),
    });
    const response = await handleRegenerateCoverRequest(
      { trackId: "track-1" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 429,
      body: {
        error: "daily limit of 10 generations reached",
        code: "daily_quota_reached",
      },
    });
    assert.deepEqual(
      calls.map(({ name }) => name),
      ["getTrack", "getDjConfig"],
      "quota must stop before provider and R2 work",
    );
  }

  {
    const { calls, deps } = fixture({
      reserveCover: async () => {
        throw new Error("reservation database failed");
      },
    });
    await assert.rejects(
      () =>
        handleRegenerateCoverRequest(
          { trackId: "track-1" },
          "user-1",
          deps,
        ),
      /reservation database failed/,
    );
    assert.equal(calls.some(({ name }) => name === "generateCover"), false);
  }

  for (const malformed of [
    null,
    [],
    { outcome: "reserved", reservationId: null, dailyLimit: 10 },
    { outcome: "surprise", reservationId: "reservation-1", dailyLimit: 10 },
  ]) {
    const { calls, deps } = fixture({
      reserveCover: async () => malformed,
    });
    await assert.rejects(
      () =>
        handleRegenerateCoverRequest(
          { trackId: "track-1" },
          "user-1",
          deps,
        ),
      /reservation/i,
    );
    assert.equal(calls.some(({ name }) => name === "generateCover"), false);
  }

  {
    const { calls, deps } = fixture({
      r2Delete: async (keys: string[]) => {
        calls.push({ name: "r2Delete", value: keys });
        throw new Error("old cover delete failed");
      },
    });
    const response = await handleRegenerateCoverRequest(
      { trackId: "track-1" },
      "user-1",
      deps,
    );
    assert.deepEqual(response, {
      status: 200,
      body: {
        album_art_url:
          "https://r2.test/covers/generated/track-1-reservation-1.jpg",
      },
    });
    assert.deepEqual(calls.map(({ name }) => name), [
      "getTrack",
      "getDjConfig",
      "reserveCover",
      "generateCover",
      "finalizeCover",
      "r2Delete",
      "logError",
    ]);
    assert.deepEqual(
      calls.find(({ name }) => name === "r2Delete")?.value,
      ["covers/generated/old.jpg"],
    );
  }

  {
    const { calls, deps } = fixture({
      finalizeCover: async (input: unknown) => {
        calls.push({ name: "finalizeCover", value: input });
        return null;
      },
    });
    const response = await handleRegenerateCoverRequest(
      { trackId: "track-1" },
      "user-1",
      deps,
    );
    assert.equal(response.status, 200);
    assert.equal(calls.some(({ name }) => name === "r2Delete"), false);
  }

  for (const failure of ["provider", "upload", "finalize"] as const) {
    const overrides: Record<string, unknown> = {};
    if (failure === "provider" || failure === "upload") {
      overrides.generateCover = async () => {
        throw new Error(`${failure} failed`);
      };
    } else {
      overrides.finalizeCover = async () => {
        throw new Error("finalize failed");
      };
    }
    const { calls, deps } = fixture(overrides);
    await assert.rejects(
      () =>
        handleRegenerateCoverRequest(
          { trackId: "track-1" },
          "user-1",
          deps,
        ),
      new RegExp(`${failure} failed`),
    );
    assert.deepEqual(
      calls.find(({ name }) => name === "r2Delete")?.value,
      ["covers/generated/track-1-reservation-1.jpg"],
    );
    assert.ok(calls.some(({ name }) => name === "failReservation"));
  }

  for (const failReservation of [
    async () => false,
    async () => {
      throw new Error("failure reservation database failed");
    },
  ]) {
    const { calls, deps } = fixture({
      finalizeCover: async () => {
        throw new Error("finalize failed");
      },
      failReservation,
    });
    await assert.rejects(
      () =>
        handleRegenerateCoverRequest(
          { trackId: "track-1" },
          "user-1",
          deps,
        ),
      /finalize failed/,
    );
    assert.equal(calls.some(({ name }) => name === "r2Delete"), false);
    assert.ok(calls.some(({ name }) => name === "logError"));
  }

  console.log("cover orchestration checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
