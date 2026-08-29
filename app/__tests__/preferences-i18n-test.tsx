/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import MusicPreferencesScreen from "@/app/preferences";
import i18n from "@/src/i18n";

const mockRefetch = jest.fn();
let mockPreferencesQuery: Record<string, unknown>;
let mockOnline = true;

jest.mock("@/src/hooks/use-music-preferences-controller", () => ({
  useMusicPreferencesController: () => ({
    prefs: mockPreferencesQuery.data ?? { genres: [], excludedMoods: [], atmosphere: "balanced" },
    ready: mockPreferencesQuery.data !== undefined,
    initialLoading: mockPreferencesQuery.isPending && mockPreferencesQuery.fetchStatus === "fetching",
    offlineWithoutData: !mockOnline && mockPreferencesQuery.data === undefined,
    blockingError: mockPreferencesQuery.isError && mockPreferencesQuery.data === undefined,
    showCachedNotice: Boolean(mockPreferencesQuery.data) && (!mockOnline || mockPreferencesQuery.isError),
    cachedNoticeKind: mockPreferencesQuery.isError ? "error" : "offline",
    saveStatus: "idle",
    toggleGenre: jest.fn(),
    setAtmosphere: jest.fn(),
    toggleExcludedMood: jest.fn(),
    refetch: mockRefetch,
  }),
}));

beforeEach(() => {
  mockOnline = true;
  mockRefetch.mockReset();
  mockPreferencesQuery = {
    data: { genres: [], excludedMoods: [], atmosphere: "balanced" },
    isPending: false,
    fetchStatus: "idle",
    isError: false,
  };
});

jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: require("@/src/i18n").default.resolvedLanguage }),
}));
jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    ScreenScrollView: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    ScreenHeader: ({ kicker, title, subtitle }: Record<string, string>) => React.createElement(View, null, [kicker, title, subtitle].map((text) => React.createElement(Text, { key: text }, text))),
    StateNotice: ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) => React.createElement(View, null,
      React.createElement(Text, null, title),
      actionLabel && onAction ? React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: actionLabel, onPress: onAction }, React.createElement(Text, null, actionLabel)) : null,
    ),
    PrefSection: ({ title, children }: { title: string; children: React.ReactNode }) => React.createElement(View, null, React.createElement(Text, null, title), children),
    ProgressiveCatalogPicker: ({ title }: { title: string }) => React.createElement(Text, null, `picker:${title}`),
    AtmosphereChoice: () => React.createElement(View, { accessibilityRole: "radiogroup" }, ["Calm", "Balanced", "Intense"].map((label) => React.createElement(Pressable, { key: label, accessibilityRole: "radio", accessibilityLabel: label }, React.createElement(Text, null, label)))),
    MusicPreferenceSkeletons: () => React.createElement(View, { testID: "preferences-skeletons" }),
    Text: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

test("renders exactly the compact preference sections and atmosphere radios", async () => {
  await i18n.changeLanguage("en");
  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("Favorite genres")).toBeTruthy();
  expect(screen.getByText("Usual atmosphere")).toBeTruthy();
  expect(screen.getByText("Moods to avoid")).toBeTruthy();
  expect(screen.queryByText("Vibe Mapping")).toBeNull();
  expect(screen.queryByText("AI frequency")).toBeNull();
  expect(screen.getAllByRole("radio")).toHaveLength(3);
});

test("shows offline state before preference skeletons", async () => {
  await i18n.changeLanguage("en");
  mockOnline = false;
  mockPreferencesQuery = { data: undefined, isPending: true, fetchStatus: "paused", isError: false };
  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("You're offline")).toBeTruthy();
  expect(screen.queryByTestId("preferences-skeletons")).toBeNull();
});

test("keeps cached preferences visible with an error notice", async () => {
  await i18n.changeLanguage("en");
  mockPreferencesQuery = { ...mockPreferencesQuery, isError: true };
  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("Favorite genres")).toBeTruthy();
  expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
