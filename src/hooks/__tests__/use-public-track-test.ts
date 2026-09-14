import {
  fetchPublicTrackMoment,
} from "@/src/hooks/use-public-track";

const TRACK_ID = "30000000-0000-4000-8000-000000000001";
const AUDIO_URL =
  "https://media.example/tracks/generated/job-1/attempt.moment-50000000-0000-4000-8000-000000000001.mp3";

describe("fetchPublicTrackMoment", () => {
  it("uses only the anonymous apikey boundary and accepts the exact public projection", async () => {
    const request = jest.fn(async (_input: string, _init: RequestInit) => new Response(JSON.stringify({
      id: TRACK_ID,
      title: "Shared song",
      artist: "HiMu DJ",
      albumArtUrl: "https://images.example/cover.jpg",
      audioUrl: AUDIO_URL,
      duration: 142,
      genre: "Ambient",
      moods: ["Dreamy"],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(fetchPublicTrackMoment(TRACK_ID, {
      supabaseUrl: "https://project.example",
      publishableKey: "public-key",
      request,
    })).resolves.toEqual({
      id: TRACK_ID,
      title: "Shared song",
      artist: "HiMu DJ",
      albumArtUrl: "https://images.example/cover.jpg",
      audioUrl: AUDIO_URL,
      duration: 142,
      genre: "Ambient",
      moods: ["Dreamy"],
    });

    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe(`https://project.example/functions/v1/public-track?id=${TRACK_ID}`);
    expect(init).toEqual({
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json", apikey: "public-key" },
    });
    expect(JSON.stringify(init)).not.toContain("Authorization");
  });

  it("uses the production anonymous boundary and exposes one unavailable result for private, missing, and no-media tracks", async () => {
    const cases: readonly (readonly [string, Response])[] = [
      ["private", new Response(JSON.stringify({ code: "not_found" }), { status: 404 })],
      ["missing", new Response(JSON.stringify({ code: "not_found" }), { status: 404 })],
      ["no-media", new Response(JSON.stringify({ code: "not_found" }), { status: 404 })],
      ["malformed", new Response(JSON.stringify({ id: TRACK_ID, title: "partial" }), { status: 200 })],
      ["invalid-title", new Response(JSON.stringify({
        id: TRACK_ID,
        title: " Shared song",
        artist: "HiMu DJ",
        albumArtUrl: null,
        audioUrl: AUDIO_URL,
        duration: 142,
        genre: null,
        moods: [],
      }), { status: 200 })],
      ["invalid-audio", new Response(JSON.stringify({
        id: TRACK_ID,
        title: "Shared song",
        artist: "HiMu DJ",
        albumArtUrl: null,
        audioUrl: "https://",
        duration: 142,
        genre: null,
        moods: [],
      }), { status: 200 })],
      ["invalid-json", new Response("not-json", { status: 200 })],
    ];

    for (const [kind, response] of cases) {
      expect(kind).toMatch(/^(private|missing|no-media|malformed|invalid-title|invalid-audio|invalid-json)$/);
      const request = jest.fn(async (_input: string, _init: RequestInit) => response);
      await expect(fetchPublicTrackMoment(TRACK_ID, {
        supabaseUrl: "https://project.example",
        publishableKey: "public-key",
        request,
      })).rejects.toEqual(expect.objectContaining({ name: "PublicTrackUnavailableError", message: "public_track_unavailable" }));
      const [, init] = request.mock.calls[0]!;
      expect(init).toEqual({
        method: "GET",
        credentials: "omit",
        headers: { Accept: "application/json", apikey: "public-key" },
      });
      expect(JSON.stringify(init)).not.toMatch(/authorization|cookie/i);
    }
  });
});
