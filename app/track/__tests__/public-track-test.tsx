/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import PublicTrackScreen from "@/app/track/[id]";
import i18n from "@/src/i18n";

const TRACK_ID = "30000000-0000-4000-8000-000000000001";
const AUDIO_URL =
  "https://media.example/tracks/generated/job-1/attempt.moment-50000000-0000-4000-8000-000000000001.mp3";
const mockUsePublicTrack = jest.fn();
const mockPlay = jest.fn();
const mockPause = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: TRACK_ID }),
  router: { canGoBack: () => false, back: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/src/hooks/use-public-track", () => ({
  usePublicTrack: (...args: unknown[]) => mockUsePublicTrack(...args),
}));

jest.mock("expo-audio", () => ({
  useAudioPlayer: jest.fn((source: unknown) => ({
    source,
    play: (...args: unknown[]) => mockPlay(...args),
    pause: (...args: unknown[]) => mockPause(...args),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    playing: false,
    isBuffering: false,
    isLoaded: true,
    playbackState: "ready",
  })),
}));

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("anonymous public track route", () => {
  beforeEach(async () => {
    mockUsePublicTrack.mockReset();
    mockPlay.mockReset();
    mockPause.mockReset();
    await i18n.changeLanguage("en");
  });

  it("renders and plays the safe projection without a session or owner player", async () => {
    mockUsePublicTrack.mockReturnValue({
      data: {
        id: TRACK_ID,
        title: "Shared song",
        artist: "HiMu DJ",
        albumArtUrl: "https://images.example/cover.jpg",
        audioUrl: AUDIO_URL,
        duration: 142,
        genre: "Ambient",
        moods: ["Dreamy"],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    const screen = await render(<PublicTrackScreen />);
    expect(screen.getByText("Shared song")).toBeTruthy();
    expect(screen.getByText("HiMu DJ")).toBeTruthy();
    expect(screen.queryByText(/lyrics|prompt|owner|feedback/i)).toBeNull();
    expect(mockUsePublicTrack).toHaveBeenCalledWith(TRACK_ID);

    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("keeps loading, unavailable and playback failures locally recoverable", async () => {
    mockUsePublicTrack.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    });
    const screen = await render(<PublicTrackScreen />);
    expect(screen.getByText("Loading shared track…")).toBeTruthy();

    const refetch = jest.fn();
    mockUsePublicTrack.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    await screen.rerender(<PublicTrackScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);

    mockUsePublicTrack.mockReturnValue({
      data: {
        id: TRACK_ID,
        title: "Shared song",
        artist: "HiMu DJ",
        albumArtUrl: null,
        audioUrl: AUDIO_URL,
        duration: 142,
        genre: null,
        moods: [],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockPlay.mockImplementationOnce(() => {
      throw new Error("media failure");
    });
    await screen.rerender(<PublicTrackScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByText("This track couldn't be played.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try playback again" })).toBeTruthy();
  });
});
