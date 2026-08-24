import { useAuthStore } from "@/src/stores/auth-store";
import { resolveTrackPlaybackUrl } from "../private-media";

function session(userId: string, token: string) {
  return {
    access_token: token,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

const scope = { userId: "user-a", authorization: "Bearer token-a" };
const privateTrack = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Private",
  artist: "Artist",
  audio_url: "r2-private://tracks/generated/job-1/attempt.mp3",
  album_art_url: null,
};

beforeEach(() => {
  useAuthStore.setState({ session: session("user-a", "token-a") as never });
});

test("public and Audius URLs bypass private resolution", async () => {
  const functions = { invoke: jest.fn() };
  await expect(resolveTrackPlaybackUrl(
    { ...privateTrack, audio_url: "https://media.example/public.mp3" },
    scope,
    functions,
  )).resolves.toBe("https://media.example/public.mp3");
  await expect(resolveTrackPlaybackUrl(
    { ...privateTrack, id: "audius:1", audio_url: "https://stream.example/1" },
    scope,
    functions,
  )).resolves.toBe("https://stream.example/1");
  expect(functions.invoke).not.toHaveBeenCalled();
});

test("private references resolve with the captured authorization scope", async () => {
  const functions = {
    invoke: jest.fn(async () => ({
      data: { url: "https://signed.example/private.mp3", expiresIn: 300 },
      error: null,
    })),
  };
  await expect(resolveTrackPlaybackUrl(privateTrack, scope, functions)).resolves.toBe(
    "https://signed.example/private.mp3",
  );
  expect(functions.invoke).toHaveBeenCalledWith("private-media-url", {
    body: { kind: "track", trackId: privateTrack.id },
    headers: { Authorization: "Bearer token-a" },
  });
});

test("malformed private references and malformed responses fail closed", async () => {
  const functions = { invoke: jest.fn() };
  await expect(resolveTrackPlaybackUrl(
    { ...privateTrack, audio_url: "r2-private://avatars/generated/a.jpg" },
    scope,
    functions,
  )).rejects.toThrow(/private media/i);
  expect(functions.invoke).not.toHaveBeenCalled();

  functions.invoke.mockResolvedValueOnce({
    data: { url: "http://signed.example/private.mp3", expiresIn: 300 },
    error: null,
  } as never);
  await expect(resolveTrackPlaybackUrl(privateTrack, scope, functions)).rejects.toThrow(
    /private media/i,
  );
});

test("an auth change while signing discards the URL", async () => {
  let resolve!: (value: unknown) => void;
  const functions = {
    invoke: jest.fn(() => new Promise((next) => { resolve = next; })),
  };
  const pending = resolveTrackPlaybackUrl(privateTrack, scope, functions);
  useAuthStore.setState({ session: session("user-b", "token-b") as never });
  resolve({
    data: { url: "https://signed.example/private.mp3", expiresIn: 300 },
    error: null,
  });
  await expect(pending).rejects.toThrow(/authentication scope changed/i);
});
