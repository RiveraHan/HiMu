import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import HomeScreen from "@/app/(app)/index";

type Query<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: jest.Mock;
};

const settled = <T,>(data: T): Query<T> => ({
  data,
  isPending: false,
  isError: false,
  fetchStatus: "idle",
  refetch: jest.fn(),
});

const loading = <T,>(): Query<T> => ({
  data: undefined,
  isPending: true,
  isError: false,
  fetchStatus: "fetching",
  refetch: jest.fn(),
});

let mockRecentQuery: Query<unknown[]> = settled([]);
const mockNoOp = jest.fn();

jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: mockNoOp }),
}));
jest.mock("@/src/components/home/CaptionVoiceButton", () => ({
  CaptionVoiceButton: () => null,
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "listener", email: "listener@example.com" }),
}));
jest.mock("@/src/hooks/use-daily-drop", () => ({
  useDailyDrop: () => ({ status: "failed", retry: mockNoOp }),
}));
jest.mock("@/src/hooks/use-favorites", () => ({
  useFavorites: () => settled([]),
}));
jest.mock("@/src/hooks/use-home", () => ({
  toPlayerTrack: (track: object) => track,
  useAIMixTracks: () => settled([]),
  useDJs: () => settled([]),
  useLiveDJIds: () => settled(new Set()),
  useOnAirHero: () => ({ data: undefined }),
  useRecentTracks: () => mockRecentQuery,
  useTimeOfDayShelf: () => settled({ bucket: "morning", tracks: [] }),
}));
jest.mock("@/src/hooks/use-online-status", () => ({ useOnlineStatus: () => true }));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useTabBarPadding: () => 0 }));
jest.mock("@/src/hooks/use-taste-profile", () => ({
  useTasteProfile: () => ({ affineGenres: new Set(), excludedMoods: new Set(), topGenre: null }),
}));
jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ warning: mockNoOp }),
}));
jest.mock("@/src/hooks/use-vibe-check", () => ({
  useVibeCheck: () => settled({ hoursThisWeek: 0, topGenre: null, streak: 0 }),
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) => selector({
    currentTrack: null,
    setRepeatMode: mockNoOp,
  }),
}));
jest.mock("@/src/onboarding", () => {
  return {
    ContinueTourCard: () => null,
    TourTarget: ({ children }: { children: React.ReactNode }) => children,
    useAppTour: () => ({
      canContinue: false,
      continueTour: mockNoOp,
      dismissActiveTour: mockNoOp,
      registerHome: mockNoOp,
    }),
  };
});
jest.mock("expo-router", () => ({ router: { push: mockNoOp } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("HomeScreen shelf integration", () => {
  beforeEach(() => {
    mockNoOp.mockReset();
  });

  it.each([390, 1440])("keeps the real private shelf in one responsive scroll tree at %ipx", async () => {
    mockRecentQuery = settled([0, 1, 2].map((index) => ({
      id: `private-${index}`,
      title: `Private ${index}`,
      artist: "Artist",
      album_art_url: null,
      audio_url: `private-${index}.mp3`,
      duration: 180,
      owner_id: "listener",
      is_public: false,
    })));

    const screen = await render(<HomeScreen />);
    const shelf = screen.getByTestId("content-shelf-scroll");

    expect(StyleSheet.flatten(shelf.props.contentContainerStyle)).toEqual(
      expect.objectContaining({
        flexWrap: { xs: "nowrap", xl: "wrap" },
        width: { xs: undefined, xl: "100%" },
      }),
    );
    expect(screen.getAllByText("Private")).toHaveLength(3);
  });

  it("reaches the real responsive shelf skeleton during Home's initial recent-query load", async () => {
    mockRecentQuery = loading();

    const screen = await render(<HomeScreen />);
    const skeleton = screen.getByTestId("content-shelf-skeleton-scroll");

    expect(StyleSheet.flatten(skeleton.props.contentContainerStyle)).toEqual(
      expect.objectContaining({ flexWrap: { xs: "nowrap", xl: "wrap" } }),
    );
    expect(screen.getByTestId("content-shelf-skeleton-tile-5")).toBeTruthy();
  });
});
