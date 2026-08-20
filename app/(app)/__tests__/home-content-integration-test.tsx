import { act, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import HomeScreen from "@/app/(app)/index";
import {
  resolveShelfLayout,
  shelfLayout,
  shelfLayoutBreakpoints,
} from "@/src/components/home/shelf-layout";

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

  it.each([
    [390, shelfLayout.compact],
    [1440, shelfLayout.desktop],
  ])("maps the real private shelf to the canonical %ipx layout", async (width, expectedLayout) => {
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
        flexWrap: shelfLayoutBreakpoints.flexWrap,
        width: shelfLayoutBreakpoints.contentWidth,
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("content-shelf-item-private-0").props.style))
      .toEqual(expect.objectContaining({
        flexBasis: shelfLayoutBreakpoints.tileBasis,
        minWidth: shelfLayoutBreakpoints.tileMinWidth,
      }));
    expect(screen.getAllByText("Private")).toHaveLength(3);
    expect(resolveShelfLayout(width)).toBe(expectedLayout);
    expect(resolveShelfLayout(width)).toEqual(expect.objectContaining({
      flexWrap: expectedLayout.flexWrap,
      tileBasis: expectedLayout.tileBasis,
      tileMinWidth: expectedLayout.tileMinWidth,
    }));
  });

  it.each([
    [390, shelfLayout.compact],
    [1440, shelfLayout.desktop],
  ])("maps the real shelf skeleton to the canonical %ipx geometry", async (width, expectedLayout) => {
    mockRecentQuery = loading();

    const screen = await render(<HomeScreen />);
    const skeleton = screen.getByTestId("content-shelf-skeleton-scroll");

    expect(StyleSheet.flatten(skeleton.props.contentContainerStyle)).toEqual(
      expect.objectContaining({ flexWrap: shelfLayoutBreakpoints.flexWrap }),
    );
    expect(StyleSheet.flatten(screen.getByTestId(
      "content-shelf-skeleton-tile-5",
      { includeHiddenElements: true },
    ).props.style))
      .toEqual(expect.objectContaining({
        display: shelfLayoutBreakpoints.extraSkeletonDisplay,
        minWidth: shelfLayoutBreakpoints.tileMinWidth,
      }));
    expect(resolveShelfLayout(width)).toBe(expectedLayout);
    expect(resolveShelfLayout(width)).toEqual(expect.objectContaining({
      artworkHeight: expectedLayout.artworkHeight,
      extraSkeletonDisplay: expectedLayout.extraSkeletonDisplay,
    }));
  });

  it("keeps Home's shelf markup identical for static and desktop contracts", async () => {
    mockRecentQuery = settled([0, 1, 2].map((index) => ({
      id: `stable-${index}`,
      title: `Stable ${index}`,
      artist: "Artist",
      album_art_url: null,
      audio_url: `stable-${index}.mp3`,
      duration: 180,
      owner_id: "listener",
      is_public: false,
    })));

    const structuralMarkers = async (width: number) => {
      const screen = await render(<HomeScreen />);
      const markers = [
        screen.getByTestId("home-desktop-grid").type,
        screen.getByTestId("content-shelf-scroll").type,
        screen.getByTestId("content-shelf-item-stable-0").type,
      ];
      expect(resolveShelfLayout(width)).toBe(
        width >= 1024 ? shelfLayout.desktop : shelfLayout.compact,
      );
      await act(async () => screen.unmount());
      return markers;
    };

    expect(await structuralMarkers(390)).toEqual(await structuralMarkers(1440));
  });
});
