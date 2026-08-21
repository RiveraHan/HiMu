/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import * as mockReact from "react";
import { StyleSheet, View as mockNativeView } from "react-native";
import PlayerScreen from "@/app/player";
import i18n from "@/src/i18n";

const track = {
  id: "track-one",
  title: "Signal Bloom",
  artist: "DJ One",
  audio_url: "https://example.com/track.mp3",
  album_art_url: "https://media.overinn.com/covers/signal-bloom.webp",
  duration: 180,
  genre: "House",
};
let mockTrack = track;
let mockShuffle = false;
let mockRepeatMode: "off" | "all" | "one" = "off";
const mockRegenerate = jest.fn();
const mockRouterPush = jest.fn();
let mockOwnership = true;
let mockPrivateDetails: null | { trackId: string; confirmedLyrics: string; djId: string } = {
  trackId: "track-one",
  confirmedLyrics: "[Verse]\nPrivate words\n[Chorus]\nOnly mine",
  djId: "dj-one",
};
const mockToastError = jest.fn();
let mockEdgePayload = {
  code: null as string | null,
  dailyLimit: null as number | null,
  limit: null as number | null,
};

jest.mock("expo-image", () => ({
  Image: ({ onLoad, onDisplay, onError, ...props }: Record<string, unknown>) =>
    mockReact.createElement(
      mockNativeView,
      { ...props, onLoad, onDisplay, onError } as never,
    ),
}));

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text: NativeText, View } = require("react-native");

  return {
    IconButton: ({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel, accessibilityRole: "button", onPress }),
    SeekBar: () => React.createElement(View),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
  };
});
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) => selector({
    currentTrack: mockTrack,
    positionSec: 30,
    durationSec: 180,
    isPlaying: true,
    shuffle: mockShuffle,
    repeatMode: mockRepeatMode,
    toggleShuffle: jest.fn(),
    cycleRepeat: jest.fn(),
  }),
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ seek: jest.fn(), prev: jest.fn(), toggle: jest.fn(), next: jest.fn() }),
}));
jest.mock("@/src/hooks/use-home", () => ({
  useRegenerateCover: () => ({ mutate: mockRegenerate, isPending: false }),
  useTrackOwnership: () => ({ data: mockOwnership }),
}));
jest.mock("@/src/hooks/use-track-private-details", () => ({
  useTrackPrivateDetails: () => ({ data: mockPrivateDetails }),
}));
jest.mock("@/src/hooks/use-favorites", () => ({
  useIsFavorited: () => ({ data: false }),
  useToggleFavorite: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ error: mockToastError }),
}));
jest.mock("@/src/api/edge-errors", () => ({
  getEdgeErrorPayload: jest.fn(async () => mockEdgePayload),
}));
jest.mock("expo-router", () => ({
  router: {
    canDismiss: () => true,
    dismiss: jest.fn(),
    replace: jest.fn(),
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("PlayerScreen localization", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
    mockRegenerate.mockClear();
    mockToastError.mockClear();
    mockEdgePayload = { code: null, dailyLimit: null, limit: null };
    mockShuffle = false;
    mockRepeatMode = "off";
    mockOwnership = true;
    mockPrivateDetails = {
      trackId: "track-one",
      confirmedLyrics: "[Verse]\nPrivate words\n[Chorus]\nOnly mine",
      djId: "dj-one",
    };
    mockTrack = track;
    mockRouterPush.mockReset();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("submits the current track ID and title for cover activity", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Regenerate cover" }));
    expect(mockRegenerate).toHaveBeenCalledWith(
      {
        trackId: "track-one",
        title: "Signal Bloom",
      },
      expect.any(Object),
    );
  });

  test.each([
    [3, "Daily creation limit reached (3). Try again tomorrow."],
    [null, "Daily creation limit reached (3). Try again tomorrow."],
  ])("shows localized cover quota feedback with server limit %s", async (dailyLimit, message) => {
    await i18n.changeLanguage("en");
    mockEdgePayload = {
      code: "daily_quota_reached",
      dailyLimit,
      limit: null,
    };
    const screen = await render(<PlayerScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Regenerate cover" }));
    const options = mockRegenerate.mock.calls[0][1];
    await options.onError(new Error("quota"));

    expect(mockToastError).toHaveBeenCalledWith("Cover", message);
  });

  test("renders Spanish player actions and transport controls", async () => {
    await i18n.changeLanguage("es");
    const screen = await render(<PlayerScreen />);

    for (const name of [
      "Cerrar reproductor",
      "Regenerar portada",
      "Guardar en favoritos",
      "Aleatorio",
      "Pista anterior",
      "Pausar",
      "Siguiente",
      "Repetir",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }

    expect(screen.getByText("Signal Bloom")).toBeTruthy();
    expect(screen.getByText("DJ One")).toBeTruthy();
  });

  test("keeps one compact-ordered stage while CSS maps it to a desktop two-column landmark", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);

    const stage = screen.getByTestId("player-desktop-stage");
    expect(StyleSheet.flatten(stage.props.style)).toEqual(
      expect.objectContaining({ flexDirection: { xs: "column", xl: "row" } }),
    );
    expect(screen.getByTestId("player-desktop-stage").children).toEqual([
      screen.getByTestId("player-desktop-artwork"),
      screen.getByTestId("player-desktop-playback"),
    ]);
    expect(screen.getAllByRole("button", { name: "Pause" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Next" })).toHaveLength(1);
  });

  test("uses source attribution rather than an unconditional audio-quality claim", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);

    expect(screen.getByText("IN HIMU")).toBeTruthy();
    expect(screen.queryByText("HIGH-FIDELITY AUDIO")).toBeNull();
  });

  test("keeps a local artwork retry separate from the owner cover regeneration action", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);

    await fireEvent(screen.getByTestId("himu-image-native"), "error");
    await fireEvent.press(screen.getByRole("button", { name: "Retry artwork" }));

    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  test("activates the cover atmosphere only after HimuImage displays the current artwork", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);
    const artwork = screen.getByTestId("himu-image-native");

    await fireEvent(artwork, "load");
    expect(screen.queryByTestId("player-artwork-atmosphere")).toBeNull();

    await fireEvent(artwork, "display");
    expect(screen.getByTestId("player-artwork-atmosphere")).toBeTruthy();
  });

  test("keeps the atmosphere absent across A-to-B-to-A until the new A generation displays", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);
    const firstArtwork = screen.getByTestId("himu-image-native");

    await fireEvent(firstArtwork, "display");
    expect(screen.getByTestId("player-artwork-atmosphere")).toBeTruthy();

    mockTrack = { ...track, album_art_url: "https://media.overinn.com/covers/second.webp" };
    await screen.rerender(<PlayerScreen />);
    const secondArtwork = screen.getByTestId("himu-image-native");
    expect(screen.queryByTestId("player-artwork-atmosphere")).toBeNull();

    mockTrack = track;
    await screen.rerender(<PlayerScreen />);
    const newFirstArtwork = screen.getByTestId("himu-image-native");
    expect(screen.queryByTestId("player-artwork-atmosphere")).toBeNull();

    await fireEvent(firstArtwork, "display");
    await fireEvent(secondArtwork, "error", { error: "stale" });
    expect(screen.queryByTestId("player-artwork-atmosphere")).toBeNull();

    await fireEvent(newFirstArtwork, "display");
    expect(screen.getByTestId("player-artwork-atmosphere")).toBeTruthy();
  });

  test("clears a displayed atmosphere when its current artwork generation errors", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);
    const artwork = screen.getByTestId("himu-image-native");

    await fireEvent(artwork, "display");
    expect(screen.getByTestId("player-artwork-atmosphere")).toBeTruthy();

    await fireEvent(artwork, "error", { error: "failed after display" });
    expect(screen.queryByTestId("player-artwork-atmosphere")).toBeNull();
  });

  test("does not collide distinct track and cover identity pairs", async () => {
    await i18n.changeLanguage("en");
    mockTrack = { ...track, id: "a:b", album_art_url: "c" };
    const screen = await render(<PlayerScreen />);
    await fireEvent(screen.getByTestId("himu-image-native"), "display");
    expect(screen.getByTestId("player-artwork-atmosphere")).toBeTruthy();

    mockTrack = { ...track, id: "a", album_art_url: "b:c" };
    await screen.rerender(<PlayerScreen />);

    expect(screen.queryByTestId("player-artwork-atmosphere")).toBeNull();
  });

  test("keeps transport mounted when a cover generation changes", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);
    const pause = screen.getByRole("button", { name: "Pause" });

    mockTrack = { ...track, album_art_url: "https://media.overinn.com/covers/regenerated.webp" };
    await screen.rerender(<PlayerScreen />);

    expect(screen.getByRole("button", { name: "Pause" })).toBe(pause);
  });

  test.each([false, true])("exposes shuffle checked state %s", async (shuffle) => {
    mockShuffle = shuffle;
    await i18n.changeLanguage("es");

    const screen = await render(<PlayerScreen />);

    expect(screen.getByRole("button", { name: "Aleatorio" }).props.accessibilityState)
      .toEqual(expect.objectContaining({ checked: shuffle }));
  });

  test.each([
    ["off", "Repetición desactivada"],
    ["all", "Repetir todo"],
    ["one", "Repetir una pista"],
  ] as const)("exposes localized repeat mode %s", async (mode, value) => {
    mockRepeatMode = mode;
    await i18n.changeLanguage("es");

    const screen = await render(<PlayerScreen />);

    expect(screen.getByRole("button", { name: "Repetir" }).props.accessibilityValue)
      .toEqual({ text: value });
  });

  test("offers a new immutable version for an owned vocal track without displaying lyrics", async () => {
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);

    expect(screen.queryByText(mockPrivateDetails!.confirmedLyrics)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Create a new version" }));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/create-track",
      params: { djId: "dj-one", sourceTrackId: "track-one" },
    });
  });

  test("does not expose version creation without owned private lyrics", async () => {
    mockOwnership = false;
    mockPrivateDetails = null;
    await i18n.changeLanguage("en");
    const screen = await render(<PlayerScreen />);

    expect(screen.queryByRole("button", { name: "Create a new version" })).toBeNull();
  });
});
