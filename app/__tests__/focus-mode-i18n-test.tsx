/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as RNStyleSheet } from "react-native";
import FocusModeScreen from "@/app/focus-mode";
import i18n from "@/src/i18n";

type TimerStatus = "idle" | "running" | "paused" | "completed";
type FocusRow = {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  album_art_url: null;
  duration: number;
  genre: string;
  energy_level: number;
  bpm: number;
  mood_tags: string[];
};
type MockFocusQuery = {
  data: FocusRow[] | undefined;
  isPending: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: jest.Mock;
};

const focusTrack: FocusRow = {
  id: "focus-one",
  title: "Quiet Current",
  artist: "DJ One",
  audio_url: "https://example.com/focus.mp3",
  album_art_url: null,
  duration: 180,
  genre: "Ambient",
  energy_level: 2,
  bpm: 70,
  mood_tags: ["Focus"],
};
const mockFocusRefetch = jest.fn();
const mockStart = jest.fn();
const mockPause = jest.fn();
const mockReset = jest.fn();
const mockSetPreset = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();

let mockStatus: TimerStatus = "idle";
let mockMinutes = 25;
let mockOnline = true;
let mockCanGoBack = true;
let mockReducedMotion = false;
let mockExcludedMoods = new Set<string>();
let mockFocusQuery: MockFocusQuery = {
  data: [focusTrack],
  isPending: false,
  isError: false,
  fetchStatus: "idle",
  refetch: mockFocusRefetch,
};

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text: NativeText, View } = require("react-native");
  return {
    IconButton: ({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel, accessibilityRole: "button", onPress }),
    StateNotice: ({ title, message, actionLabel, onAction, compact }: {
      title: string;
      message?: string;
      actionLabel?: string;
      onAction?: () => void;
      compact?: boolean;
    }) => React.createElement(View, { testID: compact ? "compact-notice" : "state-notice" },
      React.createElement(NativeText, null, title),
      message ? React.createElement(NativeText, null, message) : null,
      actionLabel && onAction
        ? React.createElement(Pressable, { accessibilityLabel: actionLabel, accessibilityRole: "button", onPress: onAction }, React.createElement(NativeText, null, actionLabel))
        : null,
    ),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
  };
});
jest.mock("@/src/components/focus/FocusAtmosphere", () => ({ FocusAtmosphere: () => null }));
jest.mock("@/src/components/focus/FocusOrb", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { FocusOrb: () => React.createElement(View, { testID: "focus-orb" }) };
});
jest.mock("@/src/hooks/use-focus-timer", () => ({
  useFocusTimer: () => ({
    status: mockStatus,
    formatted: "24:59",
    presets: [25, 50],
    minutes: mockMinutes,
    setPreset: mockSetPreset,
    start: mockStart,
    pause: mockPause,
    reset: mockReset,
  }),
}));
jest.mock("@/src/hooks/use-home", () => ({ useFocusTracks: () => mockFocusQuery }));
jest.mock("@/src/hooks/use-online-status", () => ({ useOnlineStatus: () => mockOnline }));
jest.mock("@/src/hooks/use-taste-profile", () => ({
  useTasteProfile: () => ({ excludedMoods: mockExcludedMoods }),
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ toggle: jest.fn(), next: jest.fn(), prev: jest.fn(), load: jest.fn() }),
}));
jest.mock("@/src/stores/player-store", () => {
  const state = { currentTrack: null, isPlaying: false, setRepeatMode: jest.fn() };
  const usePlayerStore = (selector: (value: typeof state) => unknown) => selector(state);
  usePlayerStore.getState = () => state;
  return { usePlayerStore };
});
jest.mock("expo-keep-awake", () => ({ useKeepAwake: jest.fn() }));
jest.mock("expo-router", () => ({
  router: {
    canGoBack: () => mockCanGoBack,
    back: (...args: unknown[]) => mockRouterBack(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return new Proxy(actual, {
    get: (target, property) => property === "useReducedMotion"
      ? () => mockReducedMotion
      : target[property],
  });
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = "idle";
  mockMinutes = 25;
  mockOnline = true;
  mockCanGoBack = true;
  mockReducedMotion = false;
  mockExcludedMoods = new Set<string>();
  mockFocusQuery = {
    data: [focusTrack],
    isPending: false,
    isError: false,
    fetchStatus: "idle",
    refetch: mockFocusRefetch,
  };
});

describe("FocusModeScreen data states", () => {
  it.each([
    [false, "paused", false, "You're offline"],
    [true, "idle", true, "Focus audio is unavailable"],
  ] as const)("keeps the shell and retries blocking state online=%s", async (online, fetchStatus, isError, title) => {
    mockOnline = online;
    mockFocusQuery = { data: undefined, isPending: false, isError, fetchStatus, refetch: mockFocusRefetch };
    const screen = await render(<FocusModeScreen />);

    expect(screen.getByText("24:59")).toBeTruthy();
    expect(screen.getByRole("button", { name: "End focus session" })).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByTestId("focus-orb")).toBeNull();
    expect(screen.getByRole("button", { name: "Start focus session" })).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockFocusRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows a successful empty state with Discover and disables only fresh Start", async () => {
    mockFocusQuery = { data: [], isPending: false, isError: false, fetchStatus: "idle", refetch: mockFocusRefetch };
    const screen = await render(<FocusModeScreen />);

    expect(screen.getByText("No focus tracks are available")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discover music" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start focus session" })).toBeDisabled();
  });

  it("shows empty recovery when taste exclusions remove every Focus track", async () => {
    mockExcludedMoods = new Set(["Focus"]);
    const screen = await render(<FocusModeScreen />);

    expect(screen.getByText("No focus tracks are available")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discover music" })).toBeTruthy();
    expect(screen.queryByTestId("focus-orb")).toBeNull();
    expect(screen.getByRole("button", { name: "Start focus session" })).toBeDisabled();
  });

  it.each([
    ["failed", true, true, "idle", "Focus audio is unavailable"],
    ["offline", false, false, "paused", "You're offline"],
  ] as const)("keeps cached empty Focus state during a %s refresh", async (_label, online, isError, fetchStatus, noticeTitle) => {
    mockOnline = online;
    mockFocusQuery = { data: [], isPending: false, isError, fetchStatus, refetch: mockFocusRefetch };
    const screen = await render(<FocusModeScreen />);

    expect(screen.getByText("No focus tracks are available")).toBeTruthy();
    expect(screen.getByText(noticeTitle)).toBeTruthy();
    expect(screen.getByTestId("compact-notice")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockFocusRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cached focus audio playable and appends compact refresh recovery", async () => {
    mockFocusQuery = { data: [focusTrack], isPending: false, isError: true, fetchStatus: "idle", refetch: mockFocusRefetch };
    const screen = await render(<FocusModeScreen />);

    expect(screen.getByTestId("focus-orb")).toBeTruthy();
    expect(screen.getByTestId("compact-notice")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start focus session" })).toBeEnabled();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockFocusRefetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["running", "Pause focus session", mockPause],
    ["paused", "Start focus session", mockStart],
    ["completed", "Reset focus session", mockReset],
  ] as const)("preserves %s session control after the queue disappears", async (status, action, handler) => {
    mockStatus = status;
    mockFocusQuery = { data: [], isPending: false, isError: false, fetchStatus: "idle", refetch: mockFocusRefetch };
    const screen = await render(<FocusModeScreen />);

    const control = screen.getByRole("button", { name: action });
    expect(control).toBeEnabled();
    await fireEvent.press(control);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("gives presets translated accessible selected state, visible cue, and 44-point targets", async () => {
    const screen = await render(<FocusModeScreen />);
    const selected = screen.getByRole("button", { name: "25 MIN" });
    const other = screen.getByRole("button", { name: "50 MIN" });

    expect(selected).toHaveProp("accessibilityState", { selected: true });
    expect(other).toHaveProp("accessibilityState", { selected: false });
    expect(RNStyleSheet.flatten(selected.props.style)).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    expect(RNStyleSheet.flatten(other.props.style)).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
    expect(screen.getByTestId("focus-preset-selected-25")).toBeTruthy();
  });

  it("omits preset transitions when reduced motion is enabled", async () => {
    mockReducedMotion = true;
    const screen = await render(<FocusModeScreen />);
    const presets = screen.getByTestId("focus-presets");
    expect(presets.props.entering).toBeUndefined();
    expect(presets.props.exiting).toBeUndefined();
  });

  it("replaces Home when a deep link has no back history", async () => {
    mockCanGoBack = false;
    const screen = await render(<FocusModeScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "End focus session" }));
    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith("/");
  });
});

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
    expect(screen.getByRole("button", { name: "Finalizar sesión de concentración" })).toBeTruthy();
  });
});
