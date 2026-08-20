import { act, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import HomeScreen from "@/app/(app)/index";
import {
  shelfLayout,
  shelfLayoutBreakpoints,
} from "@/src/components/home/shelf-layout";
import { layoutBreakpoints } from "@/src/theme/breakpoints";

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

function isResponsiveValue(value: unknown): value is { xs?: unknown; xl?: unknown } {
  return value != null && typeof value === "object" && ("xs" in value || "xl" in value);
}

function resolveRenderedResponsiveStyle(style: unknown, width: number) {
  const flattened = StyleSheet.flatten(style) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(flattened).map(([key, value]) => [
    key,
    isResponsiveValue(value)
      ? value[width >= layoutBreakpoints.desktop ? "xl" : "xs"]
      : value,
  ]));
}

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
    const renderedList = StyleSheet.flatten(shelf.props.contentContainerStyle);
    const renderedTile = StyleSheet.flatten(
      screen.getByTestId("content-shelf-item-private-0").props.style,
    );

    expect(renderedList).toEqual(
      expect.objectContaining({
        flexWrap: shelfLayoutBreakpoints.flexWrap,
        width: shelfLayoutBreakpoints.contentWidth,
      }),
    );
    expect(renderedTile)
      .toEqual(expect.objectContaining({
        flexBasis: shelfLayoutBreakpoints.tileBasis,
        minWidth: shelfLayoutBreakpoints.tileMinWidth,
      }));
    expect(resolveRenderedResponsiveStyle(renderedList, width)).toEqual(
      expect.objectContaining({
        flexWrap: expectedLayout.flexWrap,
        width: expectedLayout.contentWidth,
      }),
    );
    expect(resolveRenderedResponsiveStyle(renderedTile, width)).toEqual(
      expect.objectContaining({
        flexBasis: expectedLayout.tileBasis,
        minWidth: expectedLayout.tileMinWidth,
        maxWidth: expectedLayout.tileMaxWidth,
      }),
    );
    expect(screen.getAllByText("Private")).toHaveLength(3);
  });

  it.each([
    [390, shelfLayout.compact],
    [1440, shelfLayout.desktop],
  ])("maps the real shelf skeleton to the canonical %ipx geometry", async (width, expectedLayout) => {
    mockRecentQuery = loading();

    const screen = await render(<HomeScreen />);
    const skeleton = screen.getByTestId("content-shelf-skeleton-scroll");
    const renderedList = StyleSheet.flatten(skeleton.props.contentContainerStyle);
    const renderedTile = StyleSheet.flatten(screen.getByTestId(
      "content-shelf-skeleton-tile-5",
      { includeHiddenElements: true },
    ).props.style);

    expect(renderedList).toEqual(
      expect.objectContaining({ flexWrap: shelfLayoutBreakpoints.flexWrap }),
    );
    expect(renderedTile)
      .toEqual(expect.objectContaining({
        display: shelfLayoutBreakpoints.extraSkeletonDisplay,
        minWidth: shelfLayoutBreakpoints.tileMinWidth,
      }));
    expect(resolveRenderedResponsiveStyle(renderedList, width)).toEqual(
      expect.objectContaining({ flexWrap: expectedLayout.flexWrap }),
    );
    expect(resolveRenderedResponsiveStyle(renderedTile, width)).toEqual(
      expect.objectContaining({
        display: expectedLayout.extraSkeletonDisplay,
        flexBasis: expectedLayout.tileBasis,
        minWidth: expectedLayout.tileMinWidth,
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId(
      "content-shelf-skeleton-artwork-0",
    ).props.style)).toEqual(expect.objectContaining({
      width: "100%",
      aspectRatio: 1,
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
      const markers = {
        root: screen.getByTestId("home-desktop-grid").type,
        shelf: screen.getByTestId("content-shelf-scroll").type,
        firstCard: screen.getByTestId("content-shelf-item-stable-0").type,
        shelfCount: screen.getAllByTestId("content-shelf-scroll").length,
        cardCount: screen.getAllByTestId(/^content-shelf-item-stable-/).length,
      };
      expect(markers.shelfCount).toBe(1);
      expect(markers.cardCount).toBe(3);
      await act(async () => screen.unmount());
      return markers;
    };

    expect(await structuralMarkers(390)).toEqual(await structuralMarkers(1440));
  });
});
