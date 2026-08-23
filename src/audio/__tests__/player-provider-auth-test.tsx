import { act, render } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { PlayerProvider } from "../player-provider";
import { usePlayer } from "../use-player";
import { QueryProvider } from "@/src/api/query-provider";
import { useAuthStore } from "@/src/stores/auth-store";
import { usePlayerStore } from "@/src/stores/player-store";
import { useToastStore } from "@/src/stores/toast-store";
import { useConfirmStore } from "@/src/stores/confirm-store";

let mockStatus = audioStatus(0, false);
const committed: string[] = [];
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockInvoke = jest.fn();
const mockPlayer = {
  playing: false,
  pause: jest.fn(),
  play: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn(),
  setActiveForLockScreen: jest.fn(),
  updateLockScreenMetadata: jest.fn(),
  clearLockScreenControls: jest.fn(),
};

jest.mock("@/src/api/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}));
jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

function authSession(userId: string, token: string) {
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

function audioStatus(currentTime: number, playing = true) {
  return {
    currentTime,
    didJustFinish: false,
    duration: 180,
    isLoaded: true,
    playing,
  };
}

function track(id: string) {
  return {
    id,
    title: id,
    artist: "Artist",
    audio_url: `${id}.mp3`,
    album_art_url: null,
    duration: 180,
  };
}

function deferredBuilder<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  const builder: Record<string, jest.Mock | ((...args: unknown[]) => unknown)> = {};
  for (const method of ["select", "eq", "maybeSingle", "insert", "upsert"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.setHeader = jest.fn(() => builder);
  builder.then = (onFulfilled: unknown, onRejected: unknown) =>
    promise.then(onFulfilled as never, onRejected as never);
  return { builder, resolve };
}

let mockControls: ReturnType<typeof usePlayer> | null = null;

function CaptureControls() {
  mockControls = usePlayer();
  return <View />;
}

function Probe() {
  const owner = useAuthStore((state) => state.session?.user.id ?? "none");
  const track = usePlayerStore((state) => state.currentTrack?.id ?? "none");
  committed.push(`${owner}:${track}`);
  return <Text>{`${owner}:${track}`}</Text>;
}

beforeEach(() => {
  committed.splice(0);
  useAuthStore.setState({ session: authSession("A", "token-a") as never });
  mockStatus = audioStatus(0, false);
  mockControls = null;
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockInvoke.mockReset();
  usePlayerStore.getState().reset();
  usePlayerStore.getState().setNowPlaying(
    track("track-a"),
    [track("track-a")],
    0,
  );
  useToastStore.getState().dismiss();
  useConfirmStore.getState().resolve(false);
  jest.clearAllMocks();
});

test("discards a deferred private URL when auth changes before playback", async () => {
  let resolve!: (value: unknown) => void;
  mockInvoke.mockReturnValue(new Promise((next) => { resolve = next; }));
  await render(
    <PlayerProvider>
      <QueryProvider>
        <CaptureControls />
      </QueryProvider>
    </PlayerProvider>,
  );
  mockPlayer.replace.mockClear();
  mockPlayer.play.mockClear();

  const privateTrack = {
    ...track("11111111-1111-4111-8111-111111111111"),
    audio_url: "r2-private://tracks/generated/job-1/attempt.mp3",
  };
  const pending = mockControls!.load(privateTrack, [privateTrack], 0);

  await act(() =>
    useAuthStore.setState({ session: authSession("B", "token-b") as never })
  );
  await act(async () => {
    resolve({
      data: { url: "https://signed.example/private.mp3", expiresIn: 300 },
      error: null,
    });
    await pending;
  });

  expect(mockPlayer.replace).not.toHaveBeenCalledWith({
    uri: "https://signed.example/private.mp3",
  });
  expect(mockPlayer.play).not.toHaveBeenCalled();
  expect(usePlayerStore.getState().currentTrack).toBeNull();
});
test("direct A to B hides A playback and transient UI before B children render", async () => {
  useToastStore.getState().show("error", "A toast");
  const confirmation = useConfirmStore.getState().request({ title: "A confirm" });
  const view = await render(
    <PlayerProvider>
      <QueryProvider>
        <Probe />
      </QueryProvider>
    </PlayerProvider>,
  );
  expect(view.getByText("A:track-a")).toBeTruthy();

  await act(() =>
    useAuthStore.setState({ session: authSession("B", "token-b") as never }),
  );

  expect(committed).not.toContain("B:track-a");
  expect(view.getByText("B:none")).toBeTruthy();
  expect(useToastStore.getState().current).toBeNull();
  expect(useConfirmStore.getState().pending).toBeNull();
  await expect(confirmation).resolves.toBe(false);
  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(mockPlayer.clearLockScreenControls).toHaveBeenCalled();
});

test("pins a deferred stats flush to A and discards its failed counters after B owns playback", async () => {
  usePlayerStore.getState().setNowPlaying(
    track("audius:track-a"),
    [track("audius:track-a")],
    0,
  );
  const rpc = deferredBuilder<{ error: Error | null }>();
  mockRpc.mockReturnValue(rpc.builder);
  const view = await render(
    <PlayerProvider>
      <QueryProvider>
        <CaptureControls />
      </QueryProvider>
    </PlayerProvider>,
  );

  for (let second = 1; second <= 30; second += 1) {
    mockStatus = audioStatus(second);
    await view.rerender(
      <PlayerProvider>
        <QueryProvider>
          <CaptureControls />
        </QueryProvider>
      </PlayerProvider>,
    );
  }

  const pendingFlush = mockControls!.flushListeningStats();
  expect(mockRpc).toHaveBeenCalledWith("record_listening_stats", {
    p_minutes: 1,
    p_tracks: 1,
    p_top_genre: undefined,
  });
  expect(rpc.builder.setHeader).toHaveBeenCalledWith(
    "Authorization",
    "Bearer token-a",
  );

  await act(() =>
    useAuthStore.setState({ session: authSession("B", "token-b") as never }),
  );
  await act(async () => {
    rpc.resolve({ error: new Error("offline") });
    await pendingFlush;
  });

  await mockControls!.flushListeningStats();
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

test("pins deferred DJ-listen and completed/skipped events to A headers", async () => {
  const trackRead = deferredBuilder<{ data: { dj_id: string } }>();
  const djUpsert = deferredBuilder<{ error: null }>();
  const skippedInsert = deferredBuilder<{ error: null }>();
  const completedInsert = deferredBuilder<{ error: null }>();
  let eventCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "tracks") return trackRead.builder;
    if (table === "dj_listens") return djUpsert.builder;
    if (table === "listening_events") {
      eventCount += 1;
      return eventCount === 1 ? skippedInsert.builder : completedInsert.builder;
    }
    throw new Error(`unexpected table ${table}`);
  });
  const view = await render(
    <PlayerProvider>
      <QueryProvider>
        <CaptureControls />
      </QueryProvider>
    </PlayerProvider>,
  );

  for (let second = 1; second <= 30; second += 1) {
    mockStatus = audioStatus(second);
    await view.rerender(
      <PlayerProvider>
        <QueryProvider>
          <CaptureControls />
        </QueryProvider>
      </PlayerProvider>,
    );
  }
  void mockControls!.load(track("track-b"), [track("track-b")], 0);
  await act(async () => {
    await Promise.resolve();
  });
  expect(skippedInsert.builder.insert).toHaveBeenCalledWith({
    user_id: "A",
    track_id: "track-a",
    event: "skipped",
  });
  expect(skippedInsert.builder.setHeader).toHaveBeenCalledWith(
    "Authorization",
    "Bearer token-a",
  );
  skippedInsert.resolve({ error: null });
  trackRead.resolve({ data: { dj_id: "dj-a" } });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(djUpsert.builder.upsert).toHaveBeenCalledWith(
    { user_id: "A", dj_id: "dj-a" },
    { onConflict: "user_id,dj_id", ignoreDuplicates: true },
  );
  expect(djUpsert.builder.setHeader).toHaveBeenCalledWith(
    "Authorization",
    "Bearer token-a",
  );

  mockStatus = {
    ...audioStatus(180),
    didJustFinish: true,
  };
  await view.rerender(
    <PlayerProvider>
      <QueryProvider>
        <CaptureControls />
      </QueryProvider>
    </PlayerProvider>,
  );
  expect(completedInsert.builder.insert).toHaveBeenCalledWith({
    user_id: "A",
    track_id: "track-b",
    event: "completed",
  });
  expect(completedInsert.builder.setHeader).toHaveBeenCalledWith(
    "Authorization",
    "Bearer token-a",
  );

  await act(() =>
    useAuthStore.setState({ session: authSession("B", "token-b") as never }),
  );
  djUpsert.resolve({ error: null });
  completedInsert.resolve({ error: null });
  expect(usePlayerStore.getState().currentTrack).toBeNull();
});
