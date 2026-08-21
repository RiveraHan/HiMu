/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import FavoritesScreen from "@/app/favorites";
import i18n from "@/src/i18n";

type MockQuery = {
  data: unknown;
  isPending: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  isError?: boolean;
  refetch?: jest.Mock;
};

const mockRefetch = jest.fn();
const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockSetRepeatMode = jest.fn();
let mockOnline = true;

const initialQuery = (): MockQuery => ({
  data: undefined,
  isPending: true,
  fetchStatus: "fetching",
});

const settledQuery = <T,>(
  data: T,
  fetchStatus: MockQuery["fetchStatus"] = "idle",
): MockQuery => ({
  data,
  isPending: false,
  fetchStatus,
});

let mockFavoritesQuery = initialQuery();

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Text: NativeText, View } = require("react-native");

  return {
    ScreenHeader: ({ title }: { title: string }) =>
      React.createElement(
        View,
        { testID: "screen-header" },
        React.createElement(NativeText, null, title),
      ),
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
    TrackCard: (props: object) => React.createElement(View, { ...props, testID: "track-card" }),
    TrackRowSkeleton: () =>
      React.createElement(View, { testID: "track-row-skeleton" }),
  };
});

jest.mock("@/src/hooks/use-favorites", () => ({
  useFavorites: () => mockFavoritesQuery,
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: mockLoad }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("@/src/hooks/use-online-status", () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ currentTrack: null, setRepeatMode: mockSetRepeatMode }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("FavoritesScreen", () => {
  beforeEach(() => {
    mockFavoritesQuery = initialQuery();
    mockFavoritesQuery.refetch = mockRefetch;
    mockFavoritesQuery.isError = false;
    mockRefetch.mockReset();
    mockReplace.mockReset();
    mockLoad.mockReset();
    mockSetRepeatMode.mockReset();
    mockOnline = true;
  });

  it("renders the Favorites title in Spanish", async () => {
    await i18n.changeLanguage("es");

    const screen = await render(<FavoritesScreen />);

    expect(screen.getByText("Favoritos")).toBeTruthy();
  });

  it("renders five track rows during the initial Favorites query", async () => {
    const screen = await render(<FavoritesScreen />);

    expect(screen.getAllByTestId("track-row-skeleton")).toHaveLength(5);
  });

  it("keeps cached Favorites visible during a refetch", async () => {
    mockFavoritesQuery = settledQuery(
      [
        {
          id: "favorite-one",
          title: "Favorite One",
          artist: "Artist",
          audio_url: "favorite.mp3",
          album_art_url: null,
          duration: 180,
          genre: "House",
          favoritedAt: "2026-07-15T00:00:00Z",
        },
      ],
      "fetching",
    );

    const screen = await render(<FavoritesScreen />);

    expect(screen.getByTestId("track-card")).toBeTruthy();
    expect(screen.queryByTestId("track-row-skeleton")).toBeNull();
  });

  it("keeps favorite playback queue order inside the responsive grid", async () => {
    const favorites = [
      {
        id: "favorite-one", title: "Favorite One", artist: "Artist", audio_url: "one.mp3",
        album_art_url: null, duration: 180, genre: "House", favoritedAt: "2026-07-15T00:00:00Z",
      },
      {
        id: "favorite-two", title: "Favorite Two", artist: "Artist", audio_url: "two.mp3",
        album_art_url: null, duration: 180, genre: "House", favoritedAt: "2026-07-14T00:00:00Z",
      },
    ];
    mockFavoritesQuery = settledQuery(favorites);

    const screen = await render(<FavoritesScreen />);

    expect(screen.getByTestId("track-grid")).toBeTruthy();
    fireEvent.press(screen.getAllByTestId("track-card")[1]);
    expect(mockSetRepeatMode).toHaveBeenCalledWith("all");
    expect(mockLoad).toHaveBeenCalledWith(favorites[1], favorites, 1);
  });

  it("shows guidance after an empty Favorites query settles", async () => {
    mockFavoritesQuery = settledQuery([]);

    const screen = await render(<FavoritesScreen />);

    expect(
      screen.getByText(
        "No favorites yet — tap the heart on Now Playing to save a track.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("track-row-skeleton")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Discover music" }));
    expect(mockReplace).toHaveBeenCalledWith("/(app)/discover");
  });

  it("renders a retryable blocking error instead of the empty state", async () => {
    mockFavoritesQuery = {
      ...settledQuery(undefined),
      isError: true,
      refetch: mockRefetch,
    };

    const screen = await render(<FavoritesScreen />);

    expect(screen.getByText("Favorites are unavailable")).toBeTruthy();
    expect(screen.queryByText(/No favorites yet/)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows offline state before skeletons for a paused first load", async () => {
    mockOnline = false;
    mockFavoritesQuery = {
      data: undefined,
      isPending: true,
      fetchStatus: "paused",
      isError: false,
      refetch: mockRefetch,
    };

    const screen = await render(<FavoritesScreen />);

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.queryByTestId("track-row-skeleton")).toBeNull();
  });

  it("keeps cached favorites with a retry notice after a refetch error", async () => {
    mockFavoritesQuery = {
      ...settledQuery([
        {
          id: "cached",
          title: "Cached",
          artist: "Artist",
          audio_url: "cached.mp3",
          album_art_url: null,
          duration: 180,
          genre: "House",
          favoritedAt: "2026-07-15T00:00:00Z",
        },
      ]),
      isError: true,
      refetch: mockRefetch,
    };

    const screen = await render(<FavoritesScreen />);

    expect(screen.getByTestId("track-card")).toBeTruthy();
    expect(screen.getByText("Favorites are unavailable")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("keeps cached favorites visible while offline", async () => {
    mockOnline = false;
    mockFavoritesQuery = settledQuery([
      {
        id: "cached",
        title: "Cached",
        artist: "Artist",
        audio_url: "cached.mp3",
        album_art_url: null,
        duration: 180,
        genre: "House",
        favoritedAt: "2026-07-15T00:00:00Z",
      },
    ], "paused");
    mockFavoritesQuery.refetch = mockRefetch;

    const screen = await render(<FavoritesScreen />);

    expect(screen.getByTestId("track-card")).toBeTruthy();
    expect(screen.getByText("You're offline")).toBeTruthy();
  });
});
