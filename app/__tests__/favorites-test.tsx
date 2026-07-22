/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import FavoritesScreen from "@/app/favorites";
import i18n from "@/src/i18n";

type MockQuery = {
  data: unknown;
  isPending: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
};

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
    TrackCard: () => React.createElement(View, { testID: "track-card" }),
    TrackRowSkeleton: () =>
      React.createElement(View, { testID: "track-row-skeleton" }),
  };
});

jest.mock("@/src/hooks/use-favorites", () => ({
  useFavorites: () => mockFavoritesQuery,
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: jest.fn() }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ currentTrack: null, setRepeatMode: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("FavoritesScreen", () => {
  beforeEach(() => {
    mockFavoritesQuery = initialQuery();
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

  it("shows guidance after an empty Favorites query settles", async () => {
    mockFavoritesQuery = settledQuery([]);

    const screen = await render(<FavoritesScreen />);

    expect(
      screen.getByText(
        "No favorites yet — tap the heart on Now Playing to save a track.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("track-row-skeleton")).toBeNull();
  });
});
