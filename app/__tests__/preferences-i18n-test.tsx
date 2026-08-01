/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import MusicPreferencesScreen from "@/app/preferences";
import i18n from "@/src/i18n";

const mockUpdate = jest.fn();
const mockRefetch = jest.fn();
let mockPreferencesQuery: Record<string, unknown>;
let mockOnline = true;
const mockSetQueryData = jest.fn();
const mockCancelQueries = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockToastError = jest.fn();

jest.mock("@/src/hooks/use-music-preferences", () => ({
  useMusicPreferences: () => mockPreferencesQuery,
  useUpdateMusicPreferences: () => ({ mutateAsync: mockUpdate }),
}));

beforeEach(() => {
  mockOnline = true;
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockRefetch.mockReset();
  mockSetQueryData.mockReset();
  mockCancelQueries.mockReset().mockResolvedValue(undefined);
  mockInvalidateQueries.mockReset().mockResolvedValue(undefined);
  mockToastError.mockReset();
  mockPreferencesQuery = {
    data: {
      genres: [],
      excludedMoods: [],
      vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
      aiFrequency: "optimal",
      discoveryDepth: false,
    },
    isPending: false,
    fetchStatus: "idle",
    isError: false,
    refetch: mockRefetch,
  };
});
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "user-a" }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    cancelQueries: mockCancelQueries,
    invalidateQueries: mockInvalidateQueries,
  }),
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({
    resolvedLanguage: require("@/src/i18n").default.resolvedLanguage,
  }),
}));
jest.mock("@/src/hooks/use-online-status", () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ error: mockToastError }),
}));
jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    ScreenScrollView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    ScreenHeader: ({ kicker, title, subtitle }: Record<string, string>) =>
      React.createElement(View, null, [kicker, title, subtitle].map((text) =>
        React.createElement(Text, { key: text }, text),
      )),
    StateNotice: ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) =>
      React.createElement(View, null,
        React.createElement(Text, null, title),
        actionLabel && onAction
          ? React.createElement(Pressable, {
              accessibilityRole: "button",
              accessibilityLabel: actionLabel,
              onPress: onAction,
            }, React.createElement(Text, null, actionLabel))
          : null,
      ),
    TrackRowSkeleton: () => React.createElement(View, { testID: "preference-skeleton" }),
    PrefSection: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) =>
      React.createElement(View, null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        children,
      ),
    GroupedChipPicker: ({ groups, getGroupLabel, getItemLabel, onToggle }: {
      groups: readonly { label: string; items: readonly string[] }[];
      getGroupLabel: (value: string) => string;
      getItemLabel: (value: string) => string;
      onToggle: (value: string) => void;
    }) => {
      const group = groups[0];
      const item = group.items[0];
      return React.createElement(View, null,
        React.createElement(Text, null, getGroupLabel(group.label)),
        React.createElement(
          Pressable,
          { accessibilityRole: "button", accessibilityLabel: getItemLabel(item), onPress: () => onToggle(item) },
          React.createElement(Text, null, getItemLabel(item)),
        ),
      );
    },
    VibeSlider: ({ leftLabel, rightLabel }: { leftLabel: string; rightLabel: string }) =>
      React.createElement(Text, null, `${leftLabel} / ${rightLabel}`),
  };
});
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Icon = () => React.createElement(View);
  return { AudioLines: Icon, Ban: Icon, SlidersHorizontal: Icon };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

test("renders Spanish preferences while mutations keep canonical values", async () => {
  await i18n.changeLanguage("es");
  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("Preferencias musicales")).toBeTruthy();
  expect(screen.getByText("Afinidad de géneros")).toBeTruthy();
  expect(screen.getByText("Relajado y ambiental")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "Ambiental" }));
  expect(mockUpdate).toHaveBeenCalledTimes(1);
});

test("renders a retryable preferences query error", async () => {
  await i18n.changeLanguage("en");
  mockPreferencesQuery = {
    data: undefined,
    isPending: false,
    fetchStatus: "idle",
    isError: true,
    refetch: mockRefetch,
  };

  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

test("renders offline state before preference skeletons", async () => {
  await i18n.changeLanguage("en");
  mockOnline = false;
  mockPreferencesQuery = {
    data: undefined,
    isPending: true,
    fetchStatus: "paused",
    isError: false,
    refetch: mockRefetch,
  };

  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("You're offline")).toBeTruthy();
  expect(screen.queryByTestId("preference-skeleton")).toBeNull();
});

test("shows translated rollback feedback when a preference save fails", async () => {
  await i18n.changeLanguage("es");
  mockUpdate.mockRejectedValueOnce(new Error("offline"));
  const screen = await render(<MusicPreferencesScreen />);

  fireEvent.press(screen.getByRole("button", { name: "Ambiental" }));

  await waitFor(() =>
    expect(mockToastError).toHaveBeenCalledWith(
      "No se pudo guardar",
      "Se restauraron tus ajustes anteriores.",
    ),
  );
  expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
});

test("keeps cached preferences visible with a compact refetch error", async () => {
  await i18n.changeLanguage("en");
  mockPreferencesQuery = { ...mockPreferencesQuery, isError: true };

  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("Genre Affinity")).toBeTruthy();
  expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

test("keeps cached preferences visible while offline", async () => {
  await i18n.changeLanguage("en");
  mockOnline = false;
  mockPreferencesQuery = {
    ...mockPreferencesQuery,
    fetchStatus: "paused",
  };

  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("Genre Affinity")).toBeTruthy();
  expect(screen.getByText("You're offline")).toBeTruthy();
});
