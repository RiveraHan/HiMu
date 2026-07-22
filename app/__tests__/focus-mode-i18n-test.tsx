/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import FocusModeScreen from "@/app/focus-mode";
import i18n from "@/src/i18n";

type TimerStatus = "idle" | "running" | "paused" | "completed";
let mockStatus: TimerStatus = "running";

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text: NativeText } = require("react-native");
  return {
    IconButton: ({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel, accessibilityRole: "button", onPress }),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
  };
});
jest.mock("@/src/components/focus/FocusAtmosphere", () => ({ FocusAtmosphere: () => null }));
jest.mock("@/src/components/focus/FocusOrb", () => ({ FocusOrb: () => null }));
jest.mock("@/src/hooks/use-focus-timer", () => ({
  useFocusTimer: () => ({
    status: mockStatus,
    formatted: "24:59",
    presets: [25],
    minutes: 25,
    setPreset: jest.fn(),
    start: jest.fn(),
    pause: jest.fn(),
    reset: jest.fn(),
  }),
}));
jest.mock("@/src/hooks/use-home", () => ({
  useFocusTracks: () => ({ data: [{
    id: "focus-one",
    title: "Quiet Current",
    artist: "DJ One",
    audio_url: "https://example.com/focus.mp3",
    album_art_url: null,
    duration: 180,
    genre: "Ambient",
    energy_level: 2,
    bpm: 70,
  }] }),
}));
jest.mock("@/src/hooks/use-taste-profile", () => ({
  useTasteProfile: () => ({ excludedMoods: [] }),
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ toggle: jest.fn(), next: jest.fn(), prev: jest.fn(), load: jest.fn() }),
}));
jest.mock("@/src/stores/player-store", () => {
  const state = {
    currentTrack: null,
    isPlaying: false,
    setRepeatMode: jest.fn(),
  };
  const usePlayerStore = (selector: (value: typeof state) => unknown) => selector(state);
  usePlayerStore.getState = () => state;
  return { usePlayerStore };
});
jest.mock("expo-keep-awake", () => ({ useKeepAwake: jest.fn() }));
jest.mock("expo-router", () => ({ router: { canGoBack: () => true, back: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("FocusModeScreen localization", () => {
  it.each([
    ["running", "CONCENTRACIÓN PROFUNDA", "Pausar sesión de concentración"],
    ["paused", "EN PAUSA", "Iniciar sesión de concentración"],
    ["completed", "SESIÓN COMPLETADA", "Reiniciar sesión de concentración"],
  ] as const)("renders Spanish %s status and action", async (status, copy, action) => {
    mockStatus = status;
    await i18n.changeLanguage("es");
    const screen = await render(<FocusModeScreen />);

    expect(screen.getByText(copy)).toBeTruthy();
    expect(screen.getByRole("button", { name: action })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Finalizar sesión de concentración" }),
    ).toBeTruthy();
  });
});
