import {
  handleTrackMomentRequest,
  type TrackMomentDependencies,
} from "./handler.ts";
import {
  parseOwnedTrackPromotion,
  trackMomentPublicKey,
} from "../_shared/media-reference.ts";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_ID = "10000000-0000-4000-8000-000000000002";
const TRACK_ID = "30000000-0000-4000-8000-000000000001";
const PRIVATE_REF = "r2-private://tracks/generated/job-1/attempt.mp3";
const PUBLIC_REF =
  "https://media.example/tracks/generated/job-1/attempt.moment-50000000-0000-4000-8000-000000000001.mp3";
const PUBLIC_KEY =
  "tracks/generated/job-1/attempt.moment-50000000-0000-4000-8000-000000000001.mp3";

function assertEquals(actual: unknown, expected: unknown, message = "values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

function baseDependencies(
  overrides: Partial<TrackMomentDependencies> = {},
): TrackMomentDependencies & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    createOperationToken: () => "50000000-0000-4000-8000-000000000001",
    publicBase: "https://media.example",
    loadTrack: async () => ({
      id: TRACK_ID,
      ownerId: OWNER_ID,
      isPublic: false,
      isAiGenerated: true,
      isReady: true,
      audioRef: PRIVATE_REF,
      albumArtRef: "https://images.example/cover.jpg",
    }),
    claimPublish: async () => {
      calls.push("claim");
      return { outcome: "claimed" };
    },
    copyPrivateTrack: async () => {
      calls.push("copy");
      return {
        operationToken: "50000000-0000-4000-8000-000000000001",
        sourceKey: "tracks/generated/job-1/attempt.mp3",
        publicKey: PUBLIC_KEY,
        publicRef: PUBLIC_REF,
        contentLength: 42,
      };
    },
    verifyPublicTrack: async () => {
      calls.push("verify");
      return true;
    },
    finalizePublish: async () => {
      calls.push("finalize");
      return true;
    },
    abortPublish: async () => {
      calls.push("abort");
      return true;
    },
    unpublish: async () => ({
      outcome: "unpublished",
      privateAudioRef: PRIVATE_REF,
      publicAudioUrl: PUBLIC_REF,
      publicObjectKey: PUBLIC_KEY,
    }),
    deleteOwnedPromotion: async () => {
      calls.push("delete-owned");
    },
    deleteValidatedPublic: async () => {
      calls.push("delete-public");
    },
    ...overrides,
  };
}

Deno.test("derives and recognizes only an operation-owned generated public key", () => {
  const token = "50000000-0000-4000-8000-000000000001";
  assertEquals(
    trackMomentPublicKey(PRIVATE_REF, token),
    `tracks/generated/job-1/attempt.moment-${token}.mp3`,
  );
  assertEquals(
    parseOwnedTrackPromotion(PUBLIC_REF, "https://media.example", token),
    { key: PUBLIC_KEY, kind: "track" },
  );
  assertEquals(
    parseOwnedTrackPromotion(
      "https://media.example/tracks/generated/job-1/attempt.mp3",
      "https://media.example",
      token,
    ),
    null,
  );
});

Deno.test("rejects missing auth and an exact-shape violation", async () => {
  const deps = baseDependencies();
  assertEquals(
    await handleTrackMomentRequest(
      { action: "set_visibility", trackId: TRACK_ID, visibility: "public" },
      null,
      deps,
    ),
    { status: 401, body: { error: "unauthorized", code: "unauthorized" } },
  );
  assertEquals(
    await handleTrackMomentRequest(
      {
        action: "set_visibility",
        trackId: TRACK_ID,
        visibility: "public",
        ownerId: OWNER_ID,
      },
      OWNER_ID,
      deps,
    ),
    { status: 400, body: { error: "invalid_input", code: "invalid_input" } },
  );
});

Deno.test("rejects malformed, missing, wrong-owner, non-AI, non-ready and unsafe media", async () => {
  const cases: Array<[unknown, Partial<TrackMomentDependencies>, number, string]> = [
    [{ action: "set_visibility", trackId: "bad", visibility: "public" }, {}, 400, "invalid_input"],
    [{ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, { loadTrack: async () => null }, 404, "not_found"],
    [{ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, {
      loadTrack: async () => ({ id: TRACK_ID, ownerId: OTHER_ID, isPublic: false, isAiGenerated: true, isReady: true, audioRef: PRIVATE_REF, albumArtRef: null }),
    }, 403, "not_owner"],
    [{ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, {
      loadTrack: async () => ({ id: TRACK_ID, ownerId: OWNER_ID, isPublic: false, isAiGenerated: false, isReady: true, audioRef: PRIVATE_REF, albumArtRef: null }),
    }, 409, "track_ineligible"],
    [{ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, {
      loadTrack: async () => ({ id: TRACK_ID, ownerId: OWNER_ID, isPublic: false, isAiGenerated: true, isReady: false, audioRef: PRIVATE_REF, albumArtRef: null }),
    }, 409, "track_not_ready"],
    [{ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, {
      loadTrack: async () => ({ id: TRACK_ID, ownerId: OWNER_ID, isPublic: false, isAiGenerated: true, isReady: true, audioRef: "https://external.example/song.mp3", albumArtRef: null }),
    }, 409, "invalid_media_reference"],
    [{ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, {
      loadTrack: async () => ({ id: TRACK_ID, ownerId: OWNER_ID, isPublic: false, isAiGenerated: true, isReady: true, audioRef: null, albumArtRef: null }),
    }, 409, "invalid_media_reference"],
  ];

  for (const [payload, overrides, status, code] of cases) {
    const result = await handleTrackMomentRequest(payload, OWNER_ID, baseDependencies(overrides));
    assertEquals(result, { status, body: { error: code, code } }, code);
  }
});

Deno.test("publishes only after copy, verification, and durable finalization", async () => {
  const deps = baseDependencies();
  const result = await handleTrackMomentRequest(
    { action: "set_visibility", trackId: TRACK_ID, visibility: "public" },
    OWNER_ID,
    deps,
  );
  assertEquals(result, {
    status: 200,
    body: {
      trackId: TRACK_ID,
      visibility: "public",
      audioUrl: PUBLIC_REF,
      albumArtUrl: "https://images.example/cover.jpg",
    },
  });
  assertEquals(deps.calls, ["claim", "copy", "verify", "finalize"]);
});

Deno.test("keeps the row private and compensates its own object on copy, verify, and finalize failures", async () => {
  const copyFailure = baseDependencies({
    copyPrivateTrack: async () => {
      throw new Error("provider secret");
    },
  });
  assertEquals(
    await handleTrackMomentRequest({ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, OWNER_ID, copyFailure),
    { status: 503, body: { error: "promotion_failed", code: "promotion_failed" } },
  );
  assertEquals(copyFailure.calls, ["claim", "abort", "delete-public"]);

  const verifyFailure = baseDependencies({ verifyPublicTrack: async () => false });
  assertEquals(
    await handleTrackMomentRequest({ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, OWNER_ID, verifyFailure),
    { status: 503, body: { error: "promotion_failed", code: "promotion_failed" } },
  );
  assertEquals(verifyFailure.calls, ["claim", "copy", "abort", "delete-owned"]);

  const finalizeFailure = baseDependencies({ finalizePublish: async () => false });
  assertEquals(
    await handleTrackMomentRequest({ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, OWNER_ID, finalizeFailure),
    { status: 503, body: { error: "finalize_failed", code: "finalize_failed" } },
  );
  assertEquals(finalizeFailure.calls, ["claim", "copy", "verify", "abort", "delete-owned"]);
});

Deno.test("an ambiguous finalize never deletes media without an atomic private abort", async () => {
  let reads = 0;
  const deps = baseDependencies({
    finalizePublish: async () => {
      deps.calls.push("finalize");
      throw new Error("response lost after commit may have happened");
    },
    loadTrack: async () => {
      reads += 1;
      if (reads > 1) throw new Error("authoritative reread unavailable");
      return {
        id: TRACK_ID,
        ownerId: OWNER_ID,
        isPublic: false,
        isAiGenerated: true,
        isReady: true,
        audioRef: PRIVATE_REF,
        albumArtRef: null,
      };
    },
    abortPublish: async () => {
      deps.calls.push("abort");
      return false;
    },
  });
  assertEquals(
    await handleTrackMomentRequest(
      { action: "set_visibility", trackId: TRACK_ID, visibility: "public" },
      OWNER_ID,
      deps,
    ),
    { status: 503, body: { error: "finalize_failed", code: "finalize_failed" } },
  );
  assertEquals(deps.calls, ["claim", "copy", "verify", "finalize", "abort"]);
});

Deno.test("a concurrent loser never deletes the winner object", async () => {
  const deps = baseDependencies({ claimPublish: async () => ({ outcome: "busy" }) });
  assertEquals(
    await handleTrackMomentRequest({ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, OWNER_ID, deps),
    { status: 409, body: { error: "visibility_conflict", code: "visibility_conflict" } },
  );
  assertEquals(deps.calls, []);
});

Deno.test("a stale concurrent loser compensates only its unique object after a winner finalizes", async () => {
  const winnerToken = "50000000-0000-4000-8000-000000000002";
  const winnerRef =
    `https://media.example/tracks/generated/job-1/attempt.moment-${winnerToken}.mp3`;
  let reads = 0;
  const deps = baseDependencies({
    loadTrack: async () => {
      reads += 1;
      return reads === 1
        ? { id: TRACK_ID, ownerId: OWNER_ID, isPublic: false, isAiGenerated: true, isReady: true, audioRef: PRIVATE_REF, albumArtRef: null }
        : { id: TRACK_ID, ownerId: OWNER_ID, isPublic: true, isAiGenerated: true, isReady: true, audioRef: winnerRef, albumArtRef: null };
    },
    finalizePublish: async () => false,
  });
  assertEquals(
    await handleTrackMomentRequest(
      { action: "set_visibility", trackId: TRACK_ID, visibility: "public" },
      OWNER_ID,
      deps,
    ),
    { status: 200, body: { trackId: TRACK_ID, visibility: "public", audioUrl: winnerRef, albumArtUrl: null } },
  );
  assertEquals(deps.calls, ["claim", "copy", "verify", "delete-owned"]);
});

Deno.test("publish retry is idempotent after durable public state", async () => {
  const deps = baseDependencies({
    loadTrack: async () => ({
      id: TRACK_ID,
      ownerId: OWNER_ID,
      isPublic: true,
      isAiGenerated: true,
      isReady: true,
      audioRef: PUBLIC_REF,
      albumArtRef: null,
    }),
  });
  assertEquals(
    await handleTrackMomentRequest({ action: "set_visibility", trackId: TRACK_ID, visibility: "public" }, OWNER_ID, deps),
    { status: 200, body: { trackId: TRACK_ID, visibility: "public", audioUrl: PUBLIC_REF, albumArtUrl: null } },
  );
  assertEquals(deps.calls, []);
});

Deno.test("unpublish restores private playback before best-effort public cleanup", async () => {
  const deps = baseDependencies({
    loadTrack: async () => ({
      id: TRACK_ID,
      ownerId: OWNER_ID,
      isPublic: true,
      isAiGenerated: true,
      isReady: true,
      audioRef: PUBLIC_REF,
      albumArtRef: "javascript:bad",
    }),
    deleteValidatedPublic: async () => {
      deps.calls.push("delete-public");
      throw new Error("cleanup unavailable");
    },
  });
  const result = await handleTrackMomentRequest(
    { action: "set_visibility", trackId: TRACK_ID, visibility: "private" },
    OWNER_ID,
    deps,
  );
  assertEquals(result, {
    status: 200,
    body: { trackId: TRACK_ID, visibility: "private", audioUrl: PRIVATE_REF, albumArtUrl: null },
  });
  assertEquals(deps.calls, ["delete-public"]);
});

Deno.test("rejects unsafe legacy public-only unpublish and accepts already-private retry", async () => {
  const publicTrack = async () => ({
    id: TRACK_ID,
    ownerId: OWNER_ID,
    isPublic: true,
    isAiGenerated: true,
    isReady: true,
    audioRef: PUBLIC_REF,
    albumArtRef: null,
  });
  assertEquals(
    await handleTrackMomentRequest(
      { action: "set_visibility", trackId: TRACK_ID, visibility: "private" },
      OWNER_ID,
      baseDependencies({ loadTrack: publicTrack, unpublish: async () => ({ outcome: "legacy_unsafe" }) }),
    ),
    { status: 409, body: { error: "private_source_unavailable", code: "private_source_unavailable" } },
  );

  const privateDeps = baseDependencies({
    unpublish: async () => {
      privateDeps.calls.push("unpublish");
      return { outcome: "already_private", privateAudioRef: PRIVATE_REF };
    },
  });
  assertEquals(
    await handleTrackMomentRequest(
      { action: "set_visibility", trackId: TRACK_ID, visibility: "private" },
      OWNER_ID,
      privateDeps,
    ),
    { status: 200, body: { trackId: TRACK_ID, visibility: "private", audioUrl: PRIVATE_REF, albumArtUrl: "https://images.example/cover.jpg" } },
  );
  assertEquals(privateDeps.calls, ["unpublish"]);
});

Deno.test("an already-private retry re-attempts only its retained validated public cleanup", async () => {
  const deps = baseDependencies({
    unpublish: async () => ({
      outcome: "already_private",
      privateAudioRef: PRIVATE_REF,
      publicAudioUrl: PUBLIC_REF,
      publicObjectKey: PUBLIC_KEY,
    }),
  });
  assertEquals(
    await handleTrackMomentRequest(
      { action: "set_visibility", trackId: TRACK_ID, visibility: "private" },
      OWNER_ID,
      deps,
    ),
    { status: 200, body: { trackId: TRACK_ID, visibility: "private", audioUrl: PRIVATE_REF, albumArtUrl: "https://images.example/cover.jpg" } },
  );
  assertEquals(deps.calls, ["delete-public"]);
});
