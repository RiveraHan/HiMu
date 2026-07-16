/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import DiscoverScreen from "@/app/(app)/discover";

const mockUseAudiusSearch = jest.fn();
const mockUseAudiusTrending = jest.fn();

jest.mock("@/src/hooks/use-audius", () => ({
  useAudiusSearch: (...args: unknown[]) => mockUseAudiusSearch(...args),
  useAudiusTrending: (...args: unknown[]) => mockUseAudiusTrending(...args),
}));

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Text: NativeText, TextInput, View } = require("react-native");

  return {
    GlassInput: (props: object) =>
      React.createElement(TextInput, { ...props, testID: "search-input" }),
    ScreenScrollView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
    TrackCard: () => React.createElement(View, { testID: "track-card" }),
    TrackRowSkeleton: () =>
      React.createElement(View, { testID: "track-row-skeleton" }),
  };
});

jest.mock("@/src/components/discover/AudiusShelf", () => ({
  AudiusShelf: () => null,
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: jest.fn() }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useTabBarPadding: () => 0,
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ currentTrack: null, setRepeatMode: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("DiscoverScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    mockUseAudiusTrending.mockReturnValue({ isError: false });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  async function searchForAmbient() {
    const screen = await render(<DiscoverScreen />);
    await fireEvent.changeText(screen.getByTestId("search-input"), "ambient");
    await act(() => jest.advanceTimersByTime(300));
    return screen;
  }

  it("replaces initial search loading with four track rows", async () => {
    mockUseAudiusSearch.mockImplementation((query: string) =>
      query.trim().length >= 2
        ? { data: undefined, isPending: true, fetchStatus: "fetching" }
        : { data: undefined, isPending: true, fetchStatus: "idle" },
    );

    const screen = await searchForAmbient();

    expect(screen.getAllByTestId("track-row-skeleton")).toHaveLength(4);
  });

  it("keeps cached search results visible during a refetch", async () => {
    mockUseAudiusSearch.mockImplementation((query: string) =>
      query.trim().length >= 2
        ? {
            data: [{ id: "cached", title: "Cached", artist: "Artist" }],
            isPending: false,
            fetchStatus: "fetching",
          }
        : { data: undefined, isPending: true, fetchStatus: "idle" },
    );

    const screen = await searchForAmbient();

    expect(screen.getByTestId("track-card")).toBeTruthy();
    expect(screen.queryByTestId("track-row-skeleton")).toBeNull();
  });
});
