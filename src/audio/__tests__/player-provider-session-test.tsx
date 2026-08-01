import { act, render } from "@testing-library/react-native";
import { View } from "react-native";

import { PlayerProvider } from "@/src/audio/player-provider";
import { usePlayer } from "@/src/audio/use-player";
import { usePlayerStore } from "@/src/stores/player-store";

let mockSession = session("user-a", "token-a");
let mockStatus = audioStatus(0);
let mockFlushListeningStats: (() => Promise<void>) | null = null;
const mockRpc = jest.fn();
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

function session(userId: string, accessToken: string) {
  return { access_token: accessToken, user: { id: userId } };
}

function audioStatus(currentTime: number) {
  return {
    currentTime,
    didJustFinish: false,
    duration: 180,
    isLoaded: true,
    playing: true,
  };
}

jest.mock("@/src/stores/auth-store", () => {
  const useAuthStore = (selector: (state: object) => unknown) =>
    selector({ session: mockSession });
  useAuthStore.getState = () => ({ session: mockSession });
  return { useAuthStore };
});

jest.mock("@/src/api/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

function CaptureControls() {
  mockFlushListeningStats = usePlayer().flushListeningStats;
  return <View />;
}

function setTrack() {
  usePlayerStore.getState().setNowPlaying(
    {
      id: "audius:track-a",
      title: "Track A",
      artist: "Artist A",
      audio_url: "https://example.com/a.mp3",
      album_art_url: null,
      duration: 180,
    },
    [],
    0,
  );
}

describe("PlayerProvider session ownership", () => {
  beforeEach(() => {
    mockSession = session("user-a", "token-a");
    mockStatus = audioStatus(0);
    mockFlushListeningStats = null;
    mockRpc.mockReset();
    Object.values(mockPlayer).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) value.mockClear();
    });
    usePlayerStore.getState().reset();
    setTrack();
  });

  it("preserves playback for a same-user token refresh and clears it for A to B", async () => {
    const screen = await render(
      <PlayerProvider>
        <CaptureControls />
      </PlayerProvider>,
    );
    mockPlayer.pause.mockClear();
    mockPlayer.replace.mockClear();
    mockPlayer.clearLockScreenControls.mockClear();

    mockSession = session("user-a", "token-b");
    await screen.rerender(
      <PlayerProvider>
        <CaptureControls />
      </PlayerProvider>,
    );

    expect(usePlayerStore.getState().currentTrack?.id).toBe("audius:track-a");
    expect(mockPlayer.pause).not.toHaveBeenCalled();

    mockSession = session("user-b", "token-c");
    await screen.rerender(
      <PlayerProvider>
        <CaptureControls />
      </PlayerProvider>,
    );

    expect(usePlayerStore.getState().currentTrack).toBeNull();
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockPlayer.replace).toHaveBeenCalledWith(null);
    expect(mockPlayer.clearLockScreenControls).toHaveBeenCalledTimes(1);
  });

  it("does not restore failed A counters after B takes ownership", async () => {
    let resolveRpc: ((result: { error: Error }) => void) | null = null;
    mockRpc.mockImplementation(
      () =>
        new Promise<{ error: Error }>((resolve) => {
          resolveRpc = resolve;
        }),
    );
    const screen = await render(
      <PlayerProvider>
        <CaptureControls />
      </PlayerProvider>,
    );

    for (let second = 1; second <= 30; second += 1) {
      mockStatus = audioStatus(second);
      await screen.rerender(
        <PlayerProvider>
          <CaptureControls />
        </PlayerProvider>,
      );
    }

    const pendingFlush = mockFlushListeningStats?.();
    expect(pendingFlush).toBeDefined();
    expect(mockRpc).toHaveBeenCalledTimes(1);

    mockSession = session("user-b", "token-b");
    await screen.rerender(
      <PlayerProvider>
        <CaptureControls />
      </PlayerProvider>,
    );
    await act(async () => {
      resolveRpc?.({ error: new Error("offline") });
      await pendingFlush;
    });

    void mockFlushListeningStats?.();

    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
