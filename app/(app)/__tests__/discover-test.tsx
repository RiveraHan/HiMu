/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import DiscoverScreen from "@/app/(app)/discover";
import i18n from "@/src/i18n";

const mockUseAudiusSearch = jest.fn();
const mockUseAudiusTrending = jest.fn();
const mockRegisterContextTarget = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSearchRefetch = jest.fn();
let mockOnline = true;

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
    StateNotice: ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) =>
      React.createElement(View, null,
        React.createElement(NativeText, null, title),
        actionLabel && onAction
          ? React.createElement(require("react-native").Pressable, {
              accessibilityRole: "button",
              accessibilityLabel: actionLabel,
              onPress: onAction,
            }, React.createElement(NativeText, null, actionLabel))
          : null,
      ),
    TrackCard: (props: object) =>
      React.createElement(View, { ...props, testID: "track-card" }),
    TrackRowSkeleton: () =>
      React.createElement(View, { testID: "track-row-skeleton" }),
  };
});

jest.mock("@/src/components/discover/AudiusShelf", () => ({
  AudiusShelf: (props: { genre?: string }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, {
      ...props,
      testID: `audius-shelf-${props.genre ?? "trending"}`,
    });
  },
}));
jest.mock("@/src/onboarding", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    TourTarget: ({ children, id }: { children: React.ReactNode; id: string }) =>
      React.createElement(View, { testID: `tour-target-${id}` }, children),
    useAppTour: () => ({ registerContextTarget: mockRegisterContextTarget }),
  };
});
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: jest.fn() }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useTabBarPadding: () => 0,
}));
jest.mock("@/src/hooks/use-online-status", () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ currentTrack: null, setRepeatMode: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("DiscoverScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    mockUseAudiusSearch.mockReset().mockReturnValue({
      data: undefined,
      isPending: true,
      fetchStatus: "idle",
      isError: false,
      isPlaceholderData: false,
      refetch: mockSearchRefetch,
    });
    mockUseAudiusTrending.mockReset().mockReturnValue({
      data: [],
      isPending: false,
      fetchStatus: "idle",
      isError: false,
    });
    mockRegisterContextTarget.mockReset().mockReturnValue(jest.fn());
    mockInvalidateQueries.mockReset();
    mockSearchRefetch.mockReset();
    mockOnline = true;
  });

  it("renders the Discover surface in Spanish", async () => {
    await i18n.changeLanguage("es");

    const screen = await render(<DiscoverScreen />);

    expect(screen.getByText("Descubrir")).toBeTruthy();
    expect(
      screen.getByText("Música real de artistas independientes"),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText("Buscar en Audius…")).toBeTruthy();
    expect(screen.getByText("Con tecnología de Audius")).toBeTruthy();

    const ambientShelf = screen.getByTestId("audius-shelf-Ambient");
    expect(ambientShelf.props.title).toBe("Ambiental");
    expect(ambientShelf.props.genre).toBe("Ambient");
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

  it("wraps only the real search input in the Discover tour target", async () => {
    const screen = await render(<DiscoverScreen />);
    const target = screen.getByTestId("tour-target-discover.search");

    expect(target.children).toHaveLength(1);
    expect(screen.getByTestId("search-input").parent).toBe(target);
  });

  it("registers readiness from settled content and cleans up when it becomes unavailable", async () => {
    const firstCleanup = jest.fn();
    const secondCleanup = jest.fn();
    mockRegisterContextTarget
      .mockReturnValueOnce(firstCleanup)
      .mockReturnValueOnce(secondCleanup);
    mockUseAudiusTrending.mockReturnValue({
      data: undefined,
      isPending: true,
      fetchStatus: "fetching",
      isError: false,
    });

    const screen = await render(<DiscoverScreen />);
    await waitFor(() => expect(mockRegisterContextTarget).toHaveBeenLastCalledWith({
      tipId: "discover.search",
      targetId: "discover.search",
      ready: false,
    }));

    mockUseAudiusTrending.mockReturnValue({
      data: [],
      isPending: false,
      fetchStatus: "idle",
      isError: false,
    });
    await screen.rerender(<DiscoverScreen />);
    await waitFor(() => expect(firstCleanup).toHaveBeenCalledTimes(1));
    expect(mockRegisterContextTarget).toHaveBeenLastCalledWith({
      tipId: "discover.search",
      targetId: "discover.search",
      ready: true,
    });

    mockUseAudiusTrending.mockReturnValue({
      data: undefined,
      isPending: true,
      fetchStatus: "fetching",
      isError: false,
    });
    await screen.rerender(<DiscoverScreen />);
    await waitFor(() => expect(secondCleanup).toHaveBeenCalledTimes(1));
    expect(mockRegisterContextTarget).toHaveBeenLastCalledWith({
      tipId: "discover.search",
      targetId: "discover.search",
      ready: false,
    });
  });

  it("replaces initial search loading with four track rows", async () => {
    mockUseAudiusSearch.mockImplementation((query: string) =>
      query.trim().length >= 2
        ? { data: undefined, isPending: true, fetchStatus: "fetching" }
        : { data: undefined, isPending: true, fetchStatus: "idle" },
    );

    const screen = await searchForAmbient();

    expect(screen.getAllByTestId("track-row-skeleton")).toHaveLength(4);
    expect(mockRegisterContextTarget).toHaveBeenLastCalledWith({
      tipId: "discover.search",
      targetId: "discover.search",
      ready: false,
    });
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
    expect(mockRegisterContextTarget).toHaveBeenLastCalledWith({
      tipId: "discover.search",
      targetId: "discover.search",
      ready: true,
    });
  });

  it("interpolates the Spanish no-results query", async () => {
    await i18n.changeLanguage("es");
    mockUseAudiusSearch.mockImplementation((query: string) =>
      query.trim().length >= 2
        ? { data: [], isPending: false, fetchStatus: "idle" }
        : { data: undefined, isPending: true, fetchStatus: "idle" },
    );

    const screen = await searchForAmbient();

    expect(
      screen.getByText("No hay resultados en Audius para «ambient»."),
    ).toBeTruthy();
  });

  it("keeps independently stateful shelves mounted when trending fails", async () => {
    await i18n.changeLanguage("es");
    mockUseAudiusTrending.mockReturnValue({
      data: undefined,
      isPending: false,
      fetchStatus: "idle",
      isError: true,
    });

    const screen = await render(<DiscoverScreen />);

    expect(screen.getByTestId("audius-shelf-trending")).toBeTruthy();
    expect(screen.getByTestId("audius-shelf-Ambient")).toBeTruthy();
  });

  it("preserves search content while exposing Spanish play accessibility", async () => {
    await i18n.changeLanguage("es");
    mockUseAudiusSearch.mockImplementation((query: string) =>
      query.trim().length >= 2
        ? {
            data: [
              {
                id: "search-result",
                title: "Luz Original",
                artist: "Artista Real",
              },
            ],
            isPending: false,
            fetchStatus: "idle",
          }
        : { data: undefined, isPending: true, fetchStatus: "idle" },
    );

    const screen = await searchForAmbient();
    const card = screen.getByTestId("track-card");

    expect(card.props.title).toBe("Luz Original");
    expect(card.props.artist).toBe("Artista Real");
    expect(card.props.accessibilityLabel).toBe(
      "Reproducir Luz Original de Artista Real",
    );
  });

  it("shows a retryable search error without clearing the query", async () => {
    await i18n.changeLanguage("en");
    mockUseAudiusSearch.mockImplementation((query: string) =>
      query.trim().length >= 2
        ? {
            data: undefined,
            isPending: false,
            fetchStatus: "idle",
            isError: true,
            isPlaceholderData: false,
            refetch: mockSearchRefetch,
          }
        : { data: undefined, isPending: true, fetchStatus: "idle" },
    );

    const screen = await searchForAmbient();

    expect(screen.getByText("Search is unavailable")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockSearchRefetch).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue("ambient")).toBeTruthy();
  });

  it("shows offline state before skeletons for a paused first search", async () => {
    await i18n.changeLanguage("en");
    mockOnline = false;
    mockUseAudiusSearch.mockImplementation((query: string) =>
      query.trim().length >= 2
        ? {
            data: undefined,
            isPending: true,
            fetchStatus: "paused",
            isError: false,
            isPlaceholderData: false,
            refetch: mockSearchRefetch,
          }
        : { data: undefined, isPending: true, fetchStatus: "idle" },
    );

    const screen = await searchForAmbient();

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.queryByTestId("track-row-skeleton")).toBeNull();
  });

  it("keeps online placeholder rows while a new search key is fetching", async () => {
    await i18n.changeLanguage("en");
    const ambient = [{ id: "ambient", title: "Ambient", artist: "Artist" }];
    mockUseAudiusSearch.mockImplementation((query: string) => {
      if (query === "ambient") {
        return {
          data: ambient,
          isPending: false,
          fetchStatus: "idle",
          isError: false,
          isPlaceholderData: false,
          refetch: mockSearchRefetch,
        };
      }
      if (query === "techno") {
        return {
          data: ambient,
          isPending: false,
          fetchStatus: "fetching",
          isError: false,
          isPlaceholderData: true,
          refetch: mockSearchRefetch,
        };
      }
      return { data: undefined, isPending: true, fetchStatus: "idle" };
    });
    const screen = await render(<DiscoverScreen />);
    await fireEvent.changeText(screen.getByTestId("search-input"), "ambient");
    await act(() => jest.advanceTimersByTime(300));
    expect(screen.getByTestId("track-card")).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("search-input"), "techno");
    await act(() => jest.advanceTimersByTime(300));

    expect(screen.getByTestId("track-card")).toBeTruthy();
    expect(screen.queryByText(/No results/)).toBeNull();
  });

  it("hides previous-key placeholder rows behind offline state", async () => {
    await i18n.changeLanguage("en");
    const ambient = [{ id: "ambient", title: "Ambient", artist: "Artist" }];
    mockUseAudiusSearch.mockImplementation((query: string) => ({
      data: query.trim().length >= 2 ? ambient : undefined,
      isPending: false,
      fetchStatus: query === "techno" ? "paused" : "idle",
      isError: false,
      isPlaceholderData: query === "techno",
      refetch: mockSearchRefetch,
    }));
    const screen = await render(<DiscoverScreen />);
    await fireEvent.changeText(screen.getByTestId("search-input"), "ambient");
    await act(() => jest.advanceTimersByTime(300));
    expect(screen.getByTestId("track-card")).toBeTruthy();

    mockOnline = false;
    await fireEvent.changeText(screen.getByTestId("search-input"), "techno");
    await act(() => jest.advanceTimersByTime(300));

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.queryByTestId("track-card")).toBeNull();
  });
});
