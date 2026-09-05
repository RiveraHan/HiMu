import {
  fetchPublicTrackMoment,
  PublicTrackUnavailableError,
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
      headers: { Accept: "application/json", apikey: "public-key" },
    });
    expect(JSON.stringify(init)).not.toContain("Authorization");
  });

  it("maps missing, private and malformed public responses to one unavailable error", async () => {
    const cases = [
      new Response(JSON.stringify({ code: "not_found" }), { status: 404 }),
      new Response(JSON.stringify({ id: TRACK_ID, title: "partial" }), { status: 200 }),
      new Response(JSON.stringify({
        id: TRACK_ID,
        title: " Shared song",
        artist: "HiMu DJ",
        albumArtUrl: null,
        audioUrl: AUDIO_URL,
        duration: 142,
        genre: null,
        moods: [],
      }), { status: 200 }),
      new Response(JSON.stringify({
        id: TRACK_ID,
        title: "Shared song",
        artist: "HiMu DJ",
        albumArtUrl: null,
        audioUrl: "https://",
        duration: 142,
        genre: null,
        moods: [],
      }), { status: 200 }),
      new Response("not-json", { status: 200 }),
    ];

    for (const response of cases) {
      await expect(fetchPublicTrackMoment(TRACK_ID, {
        supabaseUrl: "https://project.example",
        publishableKey: "public-key",
        request: async () => response,
      })).rejects.toBeInstanceOf(PublicTrackUnavailableError);
    }
  });
});
