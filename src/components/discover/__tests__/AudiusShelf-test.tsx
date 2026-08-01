/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { AudiusShelf } from "../AudiusShelf";

const mockUseAudiusTrending = jest.fn();
const mockRefetch = jest.fn();
let mockOnline = true;

jest.mock("@/src/hooks/use-audius", () => ({
  useAudiusTrending: (...args: unknown[]) => mockUseAudiusTrending(...args),
}));
jest.mock("@/src/hooks/use-online-status", () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    ContentShelf: ({ title }: { title: string }) =>
      React.createElement(View, { testID: "content-shelf" },
        React.createElement(Text, null, title),
      ),
    ContentShelfSkeleton: () =>
      React.createElement(View, { testID: "content-shelf-skeleton" }),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
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
  };
});
const tracks = [0, 1, 2].map((index) => ({
  id: `track-${index}`,
  title: `Track ${index}`,
  artist: "Artist",
  audio_url: "track.mp3",
}));

beforeEach(() => {
  mockOnline = true;
  mockRefetch.mockReset();
});

test.each([
  ["offline", false, { data: undefined, isPending: true, fetchStatus: "paused", isError: false }, "You're offline"],
  ["loading", true, { data: undefined, isPending: true, fetchStatus: "fetching", isError: false }, "skeleton"],
  ["error", true, { data: undefined, isPending: false, fetchStatus: "idle", isError: true }, "Recommendations are unavailable"],
  ["empty", true, { data: tracks.slice(0, 2), isPending: false, fetchStatus: "idle", isError: false }, "No tracks here yet"],
] as const)("renders the title with the %s branch", async (_name, online, query, expected) => {
  mockOnline = online;
  mockUseAudiusTrending.mockReturnValue({ ...query, refetch: mockRefetch });
  const screen = await render(
    <AudiusShelf title="Ambient shelf" genre="Ambient" onPlay={jest.fn()} />,
  );

  expect(screen.getByText("Ambient shelf")).toBeTruthy();
  if (expected === "skeleton") {
    expect(screen.getByTestId("content-shelf-skeleton")).toBeTruthy();
  } else {
    expect(screen.getByText(expected)).toBeTruthy();
  }
});

test("keeps a usable cached shelf and adds a retry notice after refetch failure", async () => {
  mockUseAudiusTrending.mockReturnValue({
    data: tracks,
    isPending: false,
    fetchStatus: "idle",
    isError: true,
    refetch: mockRefetch,
  });
  const screen = await render(
    <AudiusShelf title="House shelf" genre="House" onPlay={jest.fn()} />,
  );

  expect(screen.getByTestId("content-shelf")).toBeTruthy();
  expect(screen.getByText("Recommendations are unavailable")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

test("renders normal shelf content without a notice", async () => {
  mockUseAudiusTrending.mockReturnValue({
    data: tracks,
    isPending: false,
    fetchStatus: "idle",
    isError: false,
    refetch: mockRefetch,
  });
  const screen = await render(
    <AudiusShelf title="Techno shelf" genre="Techno" onPlay={jest.fn()} />,
  );

  expect(screen.getByTestId("content-shelf")).toBeTruthy();
  expect(screen.queryByText("Recommendations are unavailable")).toBeNull();
});

test("keeps a usable cached shelf visible while offline", async () => {
  mockOnline = false;
  mockUseAudiusTrending.mockReturnValue({
    data: tracks,
    isPending: false,
    fetchStatus: "paused",
    isError: false,
    refetch: mockRefetch,
  });
  const screen = await render(
    <AudiusShelf title="Cached shelf" genre="House" onPlay={jest.fn()} />,
  );

  expect(screen.getByTestId("content-shelf")).toBeTruthy();
  expect(screen.getByText("You're offline")).toBeTruthy();
});
