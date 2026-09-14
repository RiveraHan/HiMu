import {
  createPublicTrackDependencies,
  handlePublicTrackHttpRequest,
  handlePublicTrackRequest,
  type PublicTrackDependencies,
} from "./handler.ts";

const TRACK_ID = "30000000-0000-4000-8000-000000000001";
const AUDIO_URL =
  "https://media.example/tracks/generated/job-1/attempt.moment-50000000-0000-4000-8000-000000000001.mp3";

function assertEquals(actual: unknown, expected: unknown, message = "values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

function publicRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TRACK_ID,
    title: "Shared song",
    artist: "HiMu DJ",
    album_art_url: "https://images.example/cover.jpg",
    audio_url: AUDIO_URL,
    duration: 142,
    genre: "Ambient",
    mood_tags: ["Dreamy", "Focus"],
    is_public: true,
    ...overrides,
  };
}

function dependencies(
  row: Record<string, unknown> | null,
): PublicTrackDependencies {
  return {
    publicBase: "https://media.example",
    loadTrack: async () => row,
  };
}

Deno.test("queries only the literal public track whitelist and returns its safe projection", async () => {
  const calls: Array<{ table: string; fields: string; column: string; value: string }> = [];
  const client = {
    from(table: string) {
      return {
        select(fields: string) {
          return {
            eq(column: string, value: string) {
              calls.push({ table, fields, column, value });
              return {
                maybeSingle: async () => ({ data: publicRow(), error: null }),
              };
            },
          };
        },
      };
    },
  };

  const result = await handlePublicTrackRequest(
    TRACK_ID,
    createPublicTrackDependencies(client, "https://media.example"),
  );

  assertEquals(calls, [{
    table: "tracks",
    fields: "id,title,artist,album_art_url,audio_url,duration,genre,mood_tags,is_public",
    column: "id",
    value: TRACK_ID,
  }]);
  const emittedQuery = JSON.stringify(calls);
  for (const forbidden of [
    "track_private_details",
    "confirmed_lyrics",
    "prompt",
    "brief",
    "owner_id",
    "user_id",
    "feedback",
    "provider",
    "internal",
  ]) {
    if (emittedQuery.includes(forbidden)) {
      throw new Error(`public query leaked forbidden field: ${forbidden}`);
    }
  }
  assertEquals(result, {
    status: 200,
    body: {
      id: TRACK_ID,
      title: "Shared song",
      artist: "HiMu DJ",
      albumArtUrl: "https://images.example/cover.jpg",
      audioUrl: AUDIO_URL,
      duration: 142,
      genre: "Ambient",
      moods: ["Dreamy", "Focus"],
    },
  });
  assertEquals(Object.keys(result.body).sort(), [
    "albumArtUrl",
    "artist",
    "audioUrl",
    "duration",
    "genre",
    "id",
    "moods",
    "title",
  ]);
});

Deno.test("private, missing, malformed, unplayable and unsafe records are indistinguishable", async () => {
  const unavailable = { status: 404, body: { code: "not_found" } };
  const cases: Array<[unknown, PublicTrackDependencies]> = [
    ["not-a-uuid", dependencies(publicRow())],
    [TRACK_ID, dependencies(null)],
    [TRACK_ID, dependencies(publicRow({ is_public: false }))],
    [TRACK_ID, dependencies(publicRow({ audio_url: null }))],
    [TRACK_ID, dependencies(publicRow({ audio_url: "r2-private://tracks/generated/job-1/a.mp3" }))],
    [TRACK_ID, dependencies(publicRow({ audio_url: "https://external.example/a.mp3" }))],
    [TRACK_ID, dependencies(publicRow({ audio_url: " https://media.example/tracks/generated/job-1/a.mp3" }))],
    [TRACK_ID, dependencies(publicRow({ duration: -1 }))],
    [TRACK_ID, dependencies(publicRow({ mood_tags: ["Focus", 3] }))],
  ];

  for (const [id, deps] of cases) {
    assertEquals(await handlePublicTrackRequest(id, deps), unavailable);
  }
});

Deno.test("drops an unsafe cover without rejecting otherwise playable public audio", async () => {
  const result = await handlePublicTrackRequest(
    TRACK_ID,
    dependencies(publicRow({ album_art_url: "javascript:alert(1)" })),
  );
  assertEquals(result.status, 200);
  assertEquals(result.body.albumArtUrl, null);
});

Deno.test("normalizes an absent mood list to an empty public projection", async () => {
  const result = await handlePublicTrackRequest(
    TRACK_ID,
    dependencies(publicRow({ mood_tags: null })),
  );
  assertEquals(result.status, 200);
  assertEquals(result.body.moods, []);
});

Deno.test("database failures are retryable and never leak their details", async () => {
  const result = await handlePublicTrackRequest(TRACK_ID, {
    publicBase: "https://media.example",
    loadTrack: async () => {
      throw new Error("private database details");
    },
  });
  assertEquals(result, { status: 503, body: { code: "unavailable" } });
  if (JSON.stringify(result).includes("database")) {
    throw new Error("private database details leaked");
  }
});

Deno.test("the anonymous HTTP boundary accepts one GET id and reveals no invalid-id distinction", async () => {
  const deps = dependencies(publicRow());
  assertEquals(
    await handlePublicTrackHttpRequest(
      new Request(`https://edge.example/public-track?id=${TRACK_ID}`),
      deps,
    ),
    await handlePublicTrackRequest(TRACK_ID, deps),
  );
  for (const request of [
    new Request("https://edge.example/public-track"),
    new Request(`https://edge.example/public-track?id=${TRACK_ID}&id=${TRACK_ID}`),
    new Request(`https://edge.example/public-track?id=bad`),
  ]) {
    assertEquals(await handlePublicTrackHttpRequest(request, deps), {
      status: 404,
      body: { code: "not_found" },
    });
  }
  assertEquals(
    await handlePublicTrackHttpRequest(
      new Request(`https://edge.example/public-track?id=${TRACK_ID}`, { method: "POST" }),
      deps,
    ),
    { status: 405, body: { code: "method_not_allowed" } },
  );
});
