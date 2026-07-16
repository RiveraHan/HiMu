/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import HomeScreen from "@/app/(app)/index";

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

let mockDjsQuery = initialQuery();
let mockRecentQuery = initialQuery();
let mockContextualQuery = initialQuery();
let mockFavoritesQuery = initialQuery();
let mockVibeQuery = initialQuery();
let mockDrop: Record<string, unknown> = { status: "idle" };

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Text: NativeText, View } = require("react-native");
  const placeholder = (testID: string) => function Placeholder() {
    return React.createElement(View, { testID });
  };

  return {
    Avatar: placeholder("avatar"),
    CaptionVoiceButton: placeholder("caption-voice"),
    ContentShelf: ({ title }: { title: string }) =>
      React.createElement(View, { testID: `content-shelf-${title}` }),
    ContentShelfSkeleton: placeholder("content-shelf-skeleton"),
    DJAvatar: placeholder("dj-avatar"),
    HomeDjsSkeleton: placeholder("home-djs-skeleton"),
    HomeHeroSkeleton: placeholder("home-hero-skeleton"),
    HomeLibraryRowSkeleton: placeholder("home-library-row-skeleton"),
    HomeVibeSkeleton: placeholder("home-vibe-skeleton"),
    LibraryCard: ({ title }: { title: string }) =>
      React.createElement(View, { testID: `library-${title}` }),
    OnAirHero: placeholder("on-air-hero"),
    ScreenScrollView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
    VibeSpotlightCard: placeholder("vibe-spotlight"),
  };
});

jest.mock("@/src/components/focus/FocusOrb", () => ({ FocusOrb: () => null }));
jest.mock("@/src/components/home/HomeSkeletons", () => {
  const React = require("react");
  const { View } = require("react-native");
  const placeholder = (testID: string) => function Placeholder() {
    return React.createElement(View, { testID });
  };

  return {
    HomeDjsSkeleton: placeholder("home-djs-skeleton"),
    HomeHeroSkeleton: placeholder("home-hero-skeleton"),
    HomeLibraryRowSkeleton: placeholder("home-library-row-skeleton"),
    HomeVibeSkeleton: placeholder("home-vibe-skeleton"),
  };
});
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: jest.fn() }),
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "user", email: "listener@example.com" }),
}));
jest.mock("@/src/hooks/use-daily-drop", () => ({
  useDailyDrop: () => mockDrop,
}));
jest.mock("@/src/hooks/use-favorites", () => ({
  useFavorites: () => mockFavoritesQuery,
}));
jest.mock("@/src/hooks/use-home", () => ({
  toPlayerTrack: (track: object) => track,
  useAIMixTracks: () => ({ data: [] }),
  useDJs: () => mockDjsQuery,
  useLiveDJIds: () => ({ data: new Set() }),
  useOnAirHero: () => ({ data: undefined }),
  useRecentTracks: () => mockRecentQuery,
  useTimeOfDayShelf: () => mockContextualQuery,
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useTabBarPadding: () => 0,
}));
jest.mock("@/src/hooks/use-taste-profile", () => ({
  useTasteProfile: () => ({
    affineGenres: new Set(),
    excludedMoods: new Set(),
    topGenre: null,
  }),
}));
jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ warning: jest.fn() }),
}));
jest.mock("@/src/hooks/use-vibe-check", () => ({
  useVibeCheck: () => mockVibeQuery,
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ setRepeatMode: jest.fn() }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    mockDjsQuery = initialQuery();
    mockRecentQuery = initialQuery();
    mockContextualQuery = initialQuery();
    mockFavoritesQuery = initialQuery();
    mockVibeQuery = initialQuery();
    mockDrop = { status: "idle" };
  });

  it("resolves initial Home queries with independent progressive skeletons", async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByTestId("home-hero-skeleton")).toBeTruthy();
    expect(screen.getByTestId("home-djs-skeleton")).toBeTruthy();
    expect(screen.getAllByTestId("content-shelf-skeleton")).toHaveLength(2);
    expect(screen.getByTestId("home-library-row-skeleton")).toBeTruthy();
    expect(screen.getByTestId("home-vibe-skeleton")).toBeTruthy();
    expect(screen.getByTestId("library-AI Mixes")).toBeTruthy();
    expect(screen.getByText("Focus Mode")).toBeTruthy();
  });

  it("resolves one Home section while unrelated sections remain skeletons", async () => {
    mockDjsQuery = settledQuery([
      {
        id: "dj-one",
        owner_id: "user",
        name: "DJ One",
        avatar_url: null,
        genre_specialties: ["House"],
      },
    ]);

    const screen = await render(<HomeScreen />);

    expect(screen.getByTestId("dj-avatar")).toBeTruthy();
    expect(screen.queryByTestId("home-djs-skeleton")).toBeNull();
    expect(screen.getByTestId("home-hero-skeleton")).toBeTruthy();
    expect(screen.getAllByTestId("content-shelf-skeleton")).toHaveLength(2);
    expect(screen.getByTestId("home-library-row-skeleton")).toBeTruthy();
    expect(screen.getByTestId("home-vibe-skeleton")).toBeTruthy();
  });

  it("keeps cached Home content visible while its query refetches", async () => {
    mockRecentQuery = settledQuery(
      [
        { id: "one", title: "One", audio_url: "one.mp3", artist: "Artist" },
        { id: "two", title: "Two", audio_url: "two.mp3", artist: "Artist" },
        {
          id: "three",
          title: "Three",
          audio_url: "three.mp3",
          artist: "Artist",
        },
      ],
      "fetching",
    );

    const screen = await render(<HomeScreen />);

    expect(screen.getByTestId("content-shelf-Fresh from your DJs")).toBeTruthy();
    expect(screen.getAllByTestId("content-shelf-skeleton")).toHaveLength(1);
  });

  it("keeps the real Daily Drop hero during generation", async () => {
    mockDrop = {
      status: "pending",
      dj: { name: "DJ One", avatar_url: null, genre: "House" },
    };

    const screen = await render(<HomeScreen />);

    expect(screen.getByTestId("on-air-hero")).toBeTruthy();
    expect(screen.queryByTestId("home-hero-skeleton")).toBeNull();
  });
});
