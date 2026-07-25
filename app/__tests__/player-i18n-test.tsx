/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import PlayerScreen from "@/app/player";
import i18n from "@/src/i18n";

const track = {
  id: "track-one",
  title: "Signal Bloom",
  artist: "DJ One",
  audio_url: "https://example.com/track.mp3",
  album_art_url: null,
  duration: 180,
  genre: "House",
};
let mockShuffle = false;
let mockRepeatMode: "off" | "all" | "one" = "off";

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
    currentTrack: track,
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
  useRegenerateCover: () => ({ mutate: jest.fn(), isPending: false }),
  useTrackOwnership: () => ({ data: true }),
}));
jest.mock("@/src/hooks/use-favorites", () => ({
  useIsFavorited: () => ({ data: false }),
  useToggleFavorite: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ error: jest.fn() }),
}));
jest.mock("expo-router", () => ({
  router: { canDismiss: () => true, dismiss: jest.fn(), replace: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("PlayerScreen localization", () => {
  beforeEach(() => {
    mockShuffle = false;
    mockRepeatMode = "off";
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
});
