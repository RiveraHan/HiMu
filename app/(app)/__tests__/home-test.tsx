/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import HomeScreen from "@/app/(app)/index";
import i18n from "@/src/i18n";
import { HOME_TOUR_STEPS } from "@/src/onboarding/constants";
import type { HomeTourRegistration } from "@/src/onboarding";

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
let mockHero: Record<string, any> | undefined;
const mockLoad = jest.fn();
const mockSetRepeatMode = jest.fn();
const mockRegisterHome = jest.fn();
const mockContinueTour = jest.fn();
const mockDismissActiveTour = jest.fn();
const mockScrollTo = jest.fn();
let mockCanContinue = false;
let mockRegistrationCleanup = jest.fn();

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
    DJAvatar: ({ subtitle }: { subtitle?: string }) =>
      React.createElement(
        View,
        { testID: "dj-avatar" },
        React.createElement(NativeText, null, subtitle),
      ),
    HomeDjsSkeleton: placeholder("home-djs-skeleton"),
    HomeHeroSkeleton: placeholder("home-hero-skeleton"),
    HomeLibraryRowSkeleton: placeholder("home-library-row-skeleton"),
    HomeVibeSkeleton: placeholder("home-vibe-skeleton"),
    LibraryCard: ({ title }: { title: string }) =>
      React.createElement(View, { testID: `library-${title}` }),
    OnAirHero: placeholder("on-air-hero"),
    ScreenScrollView: ({ children, onScrollRef, onMomentumScrollEnd }: {
      children: React.ReactNode;
      onScrollRef?: (node: unknown) => void;
      onMomentumScrollEnd?: () => void;
    }) => {
      onScrollRef?.({
        scrollTo: (options: unknown) => {
          mockScrollTo(options);
          onMomentumScrollEnd?.();
        },
      });
      return React.createElement(View, null, children);
    },
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
  usePlayer: () => ({ load: mockLoad }),
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
  useOnAirHero: () => ({ data: mockHero }),
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
    selector({ setRepeatMode: mockSetRepeatMode }),
}));
jest.mock("@/src/onboarding", () => {
  const React = require("react");
  const { View } = require("react-native");
  const { ContinueTourCard } = jest.requireActual(
    "@/src/onboarding/ContinueTourCard",
  );

  return {
    ContinueTourCard,
    TourTarget: ({
      children,
      id,
      onLayout,
    }: {
      children: React.ReactNode;
      id: string;
      onLayout?: (event: unknown) => void;
    }) => React.createElement(View, {
      testID: `tour-target-${id}`,
      onLayout,
    }, children),
    useAppTour: () => ({
      canContinue: mockCanContinue,
      continueTour: mockContinueTour,
      dismissActiveTour: mockDismissActiveTour,
      registerHome: mockRegisterHome,
    }),
  };
});
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
    mockHero = undefined;
    mockCanContinue = false;
    mockLoad.mockReset();
    mockLoad.mockResolvedValue(true);
    mockSetRepeatMode.mockReset();
    mockRegisterHome.mockReset();
    mockContinueTour.mockReset();
    mockDismissActiveTour.mockReset();
    mockScrollTo.mockReset();
    mockRegistrationCleanup = jest.fn();
    mockRegisterHome.mockReturnValue(mockRegistrationCleanup);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the Home surface in Spanish", async () => {
    await i18n.changeLanguage("es");
    jest.spyOn(Date.prototype, "getHours").mockReturnValue(9);
    const canonicalDjs = [
      {
        id: "dj-one",
        owner_id: "user",
        name: "DJ One",
        avatar_url: null,
        genre_specialties: ["Ambient"],
      },
    ];
    mockDjsQuery = settledQuery(canonicalDjs);

    const screen = await render(<HomeScreen />);

    expect(screen.getByText("Buenos días")).toBeTruthy();
    expect(screen.getByText("Tus DJs")).toBeTruthy();
    expect(screen.getByText("Ambiental")).toBeTruthy();
    expect(screen.getByText("Tu entorno sonoro te espera.")).toBeTruthy();
    expect(canonicalDjs[0].genre_specialties).toEqual(["Ambient"]);
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
    expect(screen.queryByTestId("tour-target-home.hero")).toBeNull();
  });

  it("does not register unresolved skeleton content as ready", async () => {
    await render(<HomeScreen />);

    const registration = mockRegisterHome.mock.calls.at(-1)?.[0] as
      | HomeTourRegistration
      | undefined;
    expect(registration).toMatchObject({ ready: false });
    expect(registration?.steps).toEqual([HOME_TOUR_STEPS[2]]);
    expect(registration?.hasPlayableCandidate).toBe(false);
  });

  it("registers real Daily Drop and DJ targets with the three Home steps", async () => {
    mockDjsQuery = settledQuery([
      {
        id: "dj-one",
        owner_id: "user",
        name: "DJ One",
        avatar_url: null,
        genre_specialties: ["House"],
      },
    ]);
    mockDrop = {
      status: "ready",
      track: { id: "drop", title: "Drop", audio_url: "drop.mp3" },
      dj: { name: "DJ One", avatar_url: null, genre: "House" },
    };

    const screen = await render(<HomeScreen />);

    expect(screen.getByTestId("tour-target-home.hero")).toBeTruthy();
    expect(screen.getByTestId("tour-target-home.djs")).toBeTruthy();
    expect(mockRegisterHome.mock.calls.at(-1)?.[0]).toMatchObject({
      ready: true,
      steps: HOME_TOUR_STEPS,
      hasPlayableCandidate: true,
    });
  });

  it("does not create targets or readiness for settled empty content", async () => {
    mockDjsQuery = settledQuery([]);
    mockRecentQuery = settledQuery([]);
    mockDrop = { status: "failed" };

    const screen = await render(<HomeScreen />);

    expect(screen.queryByTestId("tour-target-home.hero")).toBeNull();
    expect(screen.queryByTestId("tour-target-home.djs")).toBeNull();
    expect(mockRegisterHome.mock.calls.at(-1)?.[0]).toMatchObject({
      ready: true,
      steps: [HOME_TOUR_STEPS[2]],
      hasPlayableCandidate: false,
    });
  });

  it("settles an empty Home when no DJs exist and Daily Drop remains idle", async () => {
    mockDjsQuery = settledQuery([]);
    mockRecentQuery = settledQuery([]);
    mockDrop = { status: "idle" };
    await render(<HomeScreen />);
    expect(mockRegisterHome.mock.calls.at(-1)?.[0]).toMatchObject({
      ready: true,
      steps: [HOME_TOUR_STEPS[2]],
      hasPlayableCandidate: false,
    });
  });

  it("keeps cached real targets ready while Home refetches", async () => {
    mockDjsQuery = settledQuery(
      [
        {
          id: "dj-one",
          owner_id: "user",
          name: "DJ One",
          avatar_url: null,
          genre_specialties: ["House"],
        },
      ],
      "fetching",
    );
    mockDrop = {
      status: "ready",
      track: { id: "drop", title: "Drop", audio_url: "drop.mp3" },
      dj: { name: "DJ One", avatar_url: null, genre: "House" },
    };

    const screen = await render(<HomeScreen />);

    expect(screen.getByTestId("tour-target-home.hero")).toBeTruthy();
    expect(screen.getByTestId("tour-target-home.djs")).toBeTruthy();
    expect(mockRegisterHome.mock.calls.at(-1)?.[0]).toMatchObject({ ready: true });
  });

  it("scrolls an offscreen Home target into view before resolving its step", async () => {
    mockDjsQuery = settledQuery([{
      id: "dj-one", owner_id: "user", name: "DJ One", avatar_url: null,
      genre_specialties: ["House"],
    }]);
    mockDrop = {
      status: "ready",
      track: { id: "drop", title: "Drop", audio_url: "drop.mp3" },
      dj: { name: "DJ One", avatar_url: null, genre: "House" },
    };
    const screen = await render(<HomeScreen />);
    await fireEvent(screen.getByTestId("tour-target-home.djs"), "layout", {
      nativeEvent: { layout: { x: 0, y: 620, width: 320, height: 120 } },
    });
    const registration = mockRegisterHome.mock.calls.at(-1)?.[0] as HomeTourRegistration;
    await registration.ensureStepVisible("home.djs");
    expect(mockScrollTo).toHaveBeenCalledWith({ y: 604, animated: true });
  });

  it("shows continuation only when interrupted and wires both actions", async () => {
    const hidden = await render(<HomeScreen />);
    expect(hidden.queryByLabelText("Continue guided tour")).toBeNull();
    await hidden.unmount();

    mockCanContinue = true;
    const visible = await render(<HomeScreen />);
    await fireEvent.press(visible.getByLabelText("Continue guided tour"));
    await fireEvent.press(visible.getByLabelText("Dismiss guided tour"));

    expect(mockContinueTour).toHaveBeenCalledTimes(1);
    expect(mockDismissActiveTour).toHaveBeenCalledTimes(1);
  });

  it("plays Daily Drop before hero and recent candidates", async () => {
    mockDrop = {
      status: "ready",
      track: { id: "drop", title: "Drop", audio_url: "drop.mp3" },
      dj: { name: "DJ One", avatar_url: null, genre: "House" },
    };
    mockHero = {
      track: { id: "hero", title: "Hero", audio_url: "hero.mp3" },
      queue: [{ id: "hero", title: "Hero", audio_url: "hero.mp3" }],
      dj: { name: "DJ Two", avatar_url: null, genre: "Ambient" },
      headline: "Hero headline",
      isLive: false,
    };
    mockRecentQuery = settledQuery([
      { id: "recent", title: "Recent", audio_url: "recent.mp3", artist: "Artist" },
    ]);
    await render(<HomeScreen />);

    const registration = mockRegisterHome.mock.calls.at(-1)?.[0] as HomeTourRegistration;
    await expect(registration.playFirstAvailable()).resolves.toBe(true);
    expect(mockSetRepeatMode).toHaveBeenCalledWith("off");
    expect(mockLoad).toHaveBeenCalledWith(mockDrop.track, [mockDrop.track], 0);
  });

  it("falls back to the hero with its real queue index", async () => {
    const before = { id: "before", title: "Before", audio_url: "before.mp3" };
    const heroTrack = { id: "hero", title: "Hero", audio_url: "hero.mp3" };
    mockDrop = { status: "failed" };
    mockHero = {
      track: heroTrack,
      queue: [before, heroTrack],
      dj: { name: "DJ Two", avatar_url: null, genre: "Ambient" },
      headline: "Hero headline",
      isLive: false,
    };
    await render(<HomeScreen />);

    const registration = mockRegisterHome.mock.calls.at(-1)?.[0] as HomeTourRegistration;
    await expect(registration.playFirstAvailable()).resolves.toBe(true);
    expect(mockSetRepeatMode).toHaveBeenCalledWith("all");
    expect(mockLoad).toHaveBeenCalledWith(heroTrack, [before, heroTrack], 1);
  });

  it("falls back to the first playable recent track with its filtered queue", async () => {
    const first = { id: "first", title: "First", audio_url: "first.mp3", artist: "A" };
    const second = { id: "second", title: "Second", audio_url: "second.mp3", artist: "B" };
    mockDrop = { status: "failed" };
    mockRecentQuery = settledQuery([
      { id: "missing", title: "Missing", audio_url: null, artist: "X" },
      first,
      second,
    ]);
    await render(<HomeScreen />);

    const registration = mockRegisterHome.mock.calls.at(-1)?.[0] as HomeTourRegistration;
    expect(registration.hasPlayableCandidate).toBe(true);
    await expect(registration.playFirstAvailable()).resolves.toBe(true);
    expect(mockSetRepeatMode).toHaveBeenCalledWith("all");
    expect(mockLoad).toHaveBeenCalledWith(first, [first, second], 0);
  });

  it("returns false without playback when no candidate exists", async () => {
    mockDrop = { status: "failed" };
    mockRecentQuery = settledQuery([
      { id: "missing", title: "Missing", audio_url: null, artist: "X" },
    ]);
    await render(<HomeScreen />);

    const registration = mockRegisterHome.mock.calls.at(-1)?.[0] as HomeTourRegistration;
    expect(registration.hasPlayableCandidate).toBe(false);
    await expect(registration.playFirstAvailable()).resolves.toBe(false);
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockSetRepeatMode).not.toHaveBeenCalled();
  });

  it("converts playback exceptions to false", async () => {
    mockDrop = {
      status: "ready",
      track: { id: "drop", title: "Drop", audio_url: "drop.mp3" },
      dj: { name: "DJ One", avatar_url: null, genre: "House" },
    };
    mockLoad.mockImplementation(() => {
      throw new Error("player unavailable");
    });
    await render(<HomeScreen />);

    const registration = mockRegisterHome.mock.calls.at(-1)?.[0] as HomeTourRegistration;
    await expect(registration.playFirstAvailable()).resolves.toBe(false);
  });

  it("memoizes unchanged registration and cleans up replacements and unmount", async () => {
    mockDjsQuery = settledQuery([]);
    mockDrop = { status: "failed" };
    const screen = await render(<HomeScreen />);
    expect(mockRegisterHome).toHaveBeenCalledTimes(1);

    await screen.rerender(<HomeScreen />);
    expect(mockRegisterHome).toHaveBeenCalledTimes(1);

    mockDrop = {
      status: "ready",
      track: { id: "drop", title: "Drop", audio_url: "drop.mp3" },
      dj: { name: "DJ One", avatar_url: null, genre: "House" },
    };
    const replacementCleanup = jest.fn();
    mockRegisterHome.mockReturnValue(replacementCleanup);
    await screen.rerender(<HomeScreen />);
    expect(mockRegistrationCleanup).toHaveBeenCalledTimes(1);
    expect(mockRegisterHome).toHaveBeenCalledTimes(2);

    await screen.unmount();
    expect(replacementCleanup).toHaveBeenCalledTimes(1);
  });
});
