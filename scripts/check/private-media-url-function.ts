import assert from "node:assert/strict";
import { handlePrivateMediaUrlRequest } from "../../supabase/functions/private-media-url/handler";

const TRACK_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const TRACK_REF = "r2-private://tracks/generated/job-1/attempt.mp3";
const CAPTION_REF = "r2-private://captions/generated/job-1/attempt.mp3";

function dependencies(overrides: Record<string, unknown> = {}) {
  const signedKeys: string[] = [];
  return {
    signedKeys,
    deps: {
      loadTrack: async () => ({
        ownerId: "owner",
        isPublic: false,
        audioRef: TRACK_REF,
      }),
      loadCaption: async () => ({ userId: "owner", audioRef: CAPTION_REF }),
      signPrivateGet: async (key: string, expiresSeconds: number) => {
        signedKeys.push(key);
        assert.equal(expiresSeconds, 300);
        return "https://signed.example/object";
      },
      ...overrides,
    },
  };
}

async function main() {
  {
    const { deps } = dependencies();
    assert.deepEqual(
      await handlePrivateMediaUrlRequest({ kind: "track", trackId: "bad" }, "owner", deps),
      { status: 400, body: { error: "invalid_input", code: "invalid_input" } },
    );
  }
  {
    const { deps } = dependencies({ loadTrack: async () => null });
    assert.deepEqual(
      await handlePrivateMediaUrlRequest({ kind: "track", trackId: TRACK_ID }, "owner", deps),
      { status: 404, body: { error: "not_found", code: "not_found" } },
    );
  }
  {
    const { deps, signedKeys } = dependencies();
    assert.deepEqual(
      await handlePrivateMediaUrlRequest({ kind: "track", trackId: TRACK_ID }, "other", deps),
      { status: 403, body: { error: "not_owner", code: "not_owner" } },
    );
    assert.deepEqual(signedKeys, []);
  }
  {
    const { deps, signedKeys } = dependencies();
    assert.deepEqual(
      await handlePrivateMediaUrlRequest({ kind: "track", trackId: TRACK_ID }, "owner", deps),
      {
        status: 200,
        body: { url: "https://signed.example/object", expiresIn: 300 },
      },
    );
    assert.deepEqual(signedKeys, ["tracks/generated/job-1/attempt.mp3"]);
  }
  {
    const { deps } = dependencies({
      loadTrack: async () => ({ ownerId: "owner", isPublic: true, audioRef: "https://media.example/a.mp3" }),
    });
    assert.deepEqual(
      await handlePrivateMediaUrlRequest({ kind: "track", trackId: TRACK_ID }, "owner", deps),
      { status: 409, body: { error: "public_media_direct", code: "public_media_direct" } },
    );
  }
  {
    const { deps, signedKeys } = dependencies();
    assert.equal(
      (await handlePrivateMediaUrlRequest({ kind: "caption", jobId: JOB_ID }, "owner", deps)).status,
      200,
    );
    assert.deepEqual(signedKeys, ["captions/generated/job-1/attempt.mp3"]);
  }
  {
    const { deps } = dependencies();
    assert.deepEqual(
      await handlePrivateMediaUrlRequest({ kind: "caption", jobId: JOB_ID }, "other", deps),
      { status: 403, body: { error: "not_owner", code: "not_owner" } },
    );
  }
  {
    const { deps, signedKeys } = dependencies({
      loadTrack: async () => ({ ownerId: "owner", isPublic: false, audioRef: "r2-private://tracks/generated/../secret.mp3" }),
    });
    assert.deepEqual(
      await handlePrivateMediaUrlRequest({ kind: "track", trackId: TRACK_ID }, "owner", deps),
      { status: 409, body: { error: "invalid_media_reference", code: "invalid_media_reference" } },
    );
    assert.deepEqual(signedKeys, []);
  }
  {
    const { deps } = dependencies({
      signPrivateGet: async () => {
        throw new Error("secret upstream details");
      },
    });
    const result = await handlePrivateMediaUrlRequest(
      { kind: "track", trackId: TRACK_ID },
      "owner",
      deps,
    );
    assert.deepEqual(result, {
      status: 503,
      body: { error: "media_unavailable", code: "media_unavailable" },
    });
    assert.doesNotMatch(JSON.stringify(result), /secret/);
  }

  console.log("private media URL function checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
