/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DJProfileScreen from "@/app/dj/[id]";
import i18n from "@/src/i18n";

type MockQuery = {
  data: unknown;
  isPending: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  isError: boolean;
  refetch: jest.Mock;
};

const initialQuery = (): MockQuery => ({
  data: undefined,
  isPending: true,
  fetchStatus: "fetching",
  isError: false,
  refetch: jest.fn(),
});

const settledQuery = <T,>(
  data: T,
  fetchStatus: MockQuery["fetchStatus"] = "idle",
): MockQuery => ({
  data,
  isPending: false,
  fetchStatus,
  isError: false,
  refetch: jest.fn(),
});

const dj = {
  id: "dj-one",
  name: "DJ One",
  avatar_url: null,
  character: null,
  genre_specialties: ["House"],
  is_premium: false,
  owner_id: null,
  personality_traits: null,
};
const ownedDj = { ...dj, owner_id: "listener" };
const trackFixture = (id: string) => ({
  id,
  title: id,
  artist: "Artist",
  audio_url: `${id}.mp3`,
  album_art_url: null,
  duration: 180,
  genre: "House",
});

let mockDjQuery = initialQuery();
let mockTracksQuery = initialQuery();
const mockConfirm = jest.fn().mockResolvedValue(false);
const mockRegisterContextTarget = jest.fn();
let mockDjId = "dj-one";
let mockHighlightTrackId: string | undefined;
let mockOnline = true;
let mockActiveMix: { id: string; status: string; djId: string } | null = null;
const mockPlayerLoad = jest.fn();
let mockGenerateMix = {
  generate: jest.fn(),
  generateAsync: jest.fn(),
  isStarting: false,
  error: null,
};

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text: NativeText, View } = require("react-native");
  const placeholder = (testID: string) => function Placeholder() {
    return React.createElement(View, { testID });
  };

  return {
    DjHero: placeholder("dj-hero"),
    DjProfileSkeleton: placeholder("dj-profile-skeleton"),
    DjTracksSkeleton: placeholder("dj-tracks-skeleton"),
    GeneratingTrackCard: placeholder("generating-track-card"),
    GlassInput: placeholder("glass-input"),
    IconButton: ({
      accessibilityLabel,
      disabled,
      onPress,
    }: {
      accessibilityLabel: string;
      disabled?: boolean;
      onPress: () => void;
    }) =>
      React.createElement(Pressable, {
        accessibilityLabel,
        disabled,
        onPress,
        testID: "icon-button",
      }),
    ScreenHeader: ({ actions }: { actions?: React.ReactNode }) =>
      React.createElement(View, { testID: "screen-header" }, actions),
    StatCard: ({ label, value }: { label: string; value: string }) =>
      React.createElement(
        View,
        { testID: `stat-card-${label.toLowerCase()}` },
        React.createElement(NativeText, null, `${value} ${label}`),
      ),
    StatCardSkeleton: placeholder("stat-card-skeleton"),
    StateNotice: ({
      actionLabel,
      onAction,
      title,
    }: {
      actionLabel?: string;
      onAction?: () => void;
      title: string;
    }) =>
      React.createElement(
        View,
        { testID: "state-notice" },
        React.createElement(NativeText, null, title),
        actionLabel && onAction
          ? React.createElement(
              Pressable,
              {
                accessibilityLabel: actionLabel,
                accessibilityRole: "button",
                onPress: onAction,
              },
              React.createElement(NativeText, null, actionLabel),
            )
          : null,
      ),
    Tag: placeholder("tag"),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
    TrackCard: ({
      accessibilityHint,
      highlighted,
      highlightedLabel,
      onPress,
    }: {
      accessibilityHint?: string;
      highlighted?: boolean;
      highlightedLabel?: string;
      onPress?: () => void;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityHint,
          accessibilityRole: "button",
          accessibilityState: { selected: highlighted },
          onPress,
          testID: "track-card",
        },
        highlighted && highlightedLabel
          ? React.createElement(NativeText, null, highlightedLabel)
          : null,
      ),
  };
});
jest.mock("@/src/components/dj/DjProfileSkeleton", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    DjProfileSkeleton: () =>
      React.createElement(View, { testID: "dj-profile-skeleton" }),
    DjTracksSkeleton: () =>
      React.createElement(View, { testID: "dj-tracks-skeleton" }),
  };
});
jest.mock("@/src/onboarding", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    TourTarget: ({ children, id }: { children: React.ReactNode; id: string }) =>
      React.createElement(View, { testID: `tour-target-${id}` }, children),
    useAppTour: () => ({ registerContextTarget: mockRegisterContextTarget }),
  };
});

jest.mock("@/src/hooks/use-dj", () => ({
  useDJ: () => mockDjQuery,
  useDJTracks: () => mockTracksQuery,
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: mockPlayerLoad }),
}));
jest.mock("@/src/activity", () => ({
  useActivity: () => ({ activeMixForDj: () => mockActiveMix }),
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "listener" }),
}));
jest.mock("@/src/hooks/use-confirm", () => ({
  useConfirm: () => mockConfirm,
}));
jest.mock("@/src/hooks/use-delete-dj", () => ({
  useDeleteDJ: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/src/hooks/use-generate-mix", () => ({
  useGenerateMix: () => mockGenerateMix,
}));
jest.mock("@/src/hooks/use-home", () => ({
  useLiveDJIds: () => ({ data: new Set() }),
}));
jest.mock("@/src/hooks/use-online-status", () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ error: jest.fn() }),
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({
    resolvedLanguage: require("@/src/i18n").default.resolvedLanguage,
  }),
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ currentTrack: null }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({
    id: mockDjId,
    highlightTrackId: mockHighlightTrackId,
  }),
}));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Icon = () => React.createElement(View);
  return {
    AudioLines: Icon,
    Music2: Icon,
    SlidersHorizontal: Icon,
    Sparkles: Icon,
    Trash2: Icon,
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("DJProfileScreen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockDjQuery = initialQuery();
    mockTracksQuery = initialQuery();
    mockDjId = "dj-one";
    mockHighlightTrackId = undefined;
    mockOnline = true;
    mockActiveMix = null;
    mockPlayerLoad.mockReset();
    mockRegisterContextTarget.mockReset().mockReturnValue(jest.fn());
    mockConfirm.mockReset().mockResolvedValue(false);
    mockGenerateMix = {
      generate: jest.fn(),
      generateAsync: jest.fn(),
      isStarting: false,
      error: null,
    };
  });

  it("renders the DJ profile shell during the initial DJ query", async () => {
    const screen = await render(<DJProfileScreen />);

    expect(screen.getByTestId("dj-profile-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("dj-hero")).toBeNull();
    expect(screen.queryByTestId("tour-target-dj.hero")).toBeNull();
    expect(mockRegisterContextTarget).not.toHaveBeenCalled();
  });

  it("wraps and registers only a resolved DJ hero", async () => {
    mockDjQuery = settledQuery(dj);

    const screen = await render(<DJProfileScreen />);
    const target = screen.getByTestId("tour-target-dj.hero");

    expect(screen.getByTestId("dj-hero").parent).toBe(target);
    await waitFor(() => expect(mockRegisterContextTarget).toHaveBeenCalledWith({
      tipId: "dj.hero",
      targetId: "dj.hero",
      ready: true,
    }));
  });

  it.each([
    ["not found", settledQuery(null)],
    ["error with cached content", { ...settledQuery(dj), isError: true }],
  ])("does not register the DJ tip for a settled %s route", async (_label, query) => {
    mockDjQuery = query;

    const screen = await render(<DJProfileScreen />);

    expect(screen.queryByTestId("tour-target-dj.hero")).toBeNull();
    expect(mockRegisterContextTarget).not.toHaveBeenCalled();
  });

  it("unregisters the previous DJ before registering a changed route id", async () => {
    const firstCleanup = jest.fn();
    mockRegisterContextTarget
      .mockReturnValueOnce(firstCleanup)
      .mockReturnValueOnce(jest.fn());
    mockDjQuery = settledQuery(dj);
    const screen = await render(<DJProfileScreen />);
    await waitFor(() => expect(mockRegisterContextTarget).toHaveBeenCalledTimes(1));

    mockDjId = "dj-two";
    mockDjQuery = settledQuery({ ...dj, id: "dj-two", name: "DJ Two" });
    await screen.rerender(<DJProfileScreen />);
    await waitFor(() => expect(mockRegisterContextTarget).toHaveBeenCalledTimes(2));

    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(firstCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      mockRegisterContextTarget.mock.invocationCallOrder[1],
    );
  });

  it("keeps the resolved DJ visible while tracks load independently", async () => {
    mockDjQuery = settledQuery(dj);

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByTestId("dj-hero")).toBeTruthy();
    expect(screen.getByTestId("stat-card-skeleton")).toBeTruthy();
    expect(screen.queryByText("0 TRACKS")).toBeNull();
    expect(screen.getByText("1 GENRE")).toBeTruthy();
    expect(screen.getByTestId("dj-tracks-skeleton")).toBeTruthy();
    expect(screen.queryByText("No tracks yet.")).toBeNull();
  });

  it("shows the settled not-found state instead of a skeleton", async () => {
    mockDjQuery = settledQuery(null);

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByText("DJ not found")).toBeTruthy();
    expect(screen.queryByTestId("dj-profile-skeleton")).toBeNull();
  });

  it("shows a retryable DJ error instead of claiming the DJ was not found", async () => {
    mockDjQuery = { ...settledQuery(null), isError: true };

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByText("DJ unavailable")).toBeTruthy();
    expect(screen.queryByText("DJ not found")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockDjQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows offline before the first-load skeleton when no DJ is cached", async () => {
    mockOnline = false;

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.queryByTestId("dj-profile-skeleton")).toBeNull();
  });

  it("localizes the settled not-found state in Spanish", async () => {
    await i18n.changeLanguage("es");
    mockDjQuery = settledQuery(null);

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByText("DJ no encontrado")).toBeTruthy();
  });

  it("keeps cached DJ and track content visible during refetches", async () => {
    mockDjQuery = settledQuery(dj, "fetching");
    mockTracksQuery = settledQuery(
      [
        {
          id: "track-one",
          title: "Track One",
          artist: "Artist",
          audio_url: "track-one.mp3",
          album_art_url: null,
          duration: 180,
          genre: "House",
        },
      ],
      "fetching",
    );

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByTestId("dj-hero")).toBeTruthy();
    expect(screen.getByTestId("track-card")).toBeTruthy();
    expect(screen.queryByTestId("dj-profile-skeleton")).toBeNull();
    expect(screen.queryByTestId("dj-tracks-skeleton")).toBeNull();
  });

  it("shows the no-tracks state after the track query settles", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = settledQuery([]);

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByText("0 TRACKS")).toBeTruthy();
    expect(screen.getByText("No tracks yet.")).toBeTruthy();
    expect(screen.queryByTestId("dj-tracks-skeleton")).toBeNull();
  });

  it("keeps the DJ hero and an unknown count when the initial tracks query fails", async () => {
    mockDjQuery = settledQuery(ownedDj);
    mockTracksQuery = { ...settledQuery(undefined), isError: true };

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByTestId("dj-hero")).toBeTruthy();
    expect(screen.getByText("— Track count unavailable")).toBeTruthy();
    expect(screen.getByText("Tracks unavailable")).toBeTruthy();
    expect(screen.queryByText("No tracks yet.")).toBeNull();
    fireEvent.press(screen.getByLabelText("Delete DJ"));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm.mock.calls[0][0].message).toBe(
      "Delete this DJ? Its tracks could not be counted.",
    );
  });

  it("keeps cached tracks visible and appends a compact notice after a refetch error", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = {
      ...settledQuery([
        {
          id: "track-one",
          title: "Track One",
          artist: "Artist",
          audio_url: "track-one.mp3",
          album_art_url: null,
          duration: 180,
          genre: "House",
        },
      ]),
      isError: true,
    };

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByTestId("dj-hero")).toBeTruthy();
    expect(screen.getByTestId("track-card")).toBeTruthy();
    expect(screen.getByText("Tracks unavailable")).toBeTruthy();
  });

  it("keeps an empty cached track refetch error actionable instead of claiming no tracks", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = { ...settledQuery([]), isError: true };

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByTestId("dj-hero")).toBeTruthy();
    expect(screen.getByText("Tracks unavailable")).toBeTruthy();
    expect(screen.queryByText("No tracks yet.")).toBeNull();
  });

  it("omits an unresolved track count from the owner Delete confirmation", async () => {
    mockDjQuery = settledQuery(ownedDj);

    const screen = await render(<DJProfileScreen />);
    fireEvent.press(screen.getByLabelText("Delete DJ"));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    const options = mockConfirm.mock.calls[0][0];

    expect(options.message).toBe(
      "Delete this DJ? Its tracks could not be counted.",
    );
    expect(options.message).not.toContain("0 tracks");
    expect(options).toMatchObject({
      title: "Delete DJ",
      confirmLabel: "Delete",
      destructive: true,
    });
  });

  it("includes the accurate settled track count in owner Delete confirmation", async () => {
    mockDjQuery = settledQuery(ownedDj);
    mockTracksQuery = settledQuery([
      trackFixture("track-one"),
      trackFixture("track-two"),
    ]);

    const screen = await render(<DJProfileScreen />);
    fireEvent.press(screen.getByLabelText("Delete DJ"));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));

    expect(mockConfirm.mock.calls[0][0].message).toBe(
      "This will delete DJ One and its 2 tracks.",
    );
  });

  it.each([
    [1, "Esto eliminará a DJ One y su 1 canción."],
    [2, "Esto eliminará a DJ One y sus 2 canciones."],
  ])("localizes the delete confirmation for %i track(s)", async (count, message) => {
    await i18n.changeLanguage("es");
    mockDjQuery = settledQuery(ownedDj);
    mockTracksQuery = settledQuery(
      Array.from({ length: count }, (_, index) =>
        trackFixture(`track-${index}`),
      ),
    );

    const screen = await render(<DJProfileScreen />);
    fireEvent.press(screen.getByLabelText("Eliminar DJ"));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm.mock.calls[0][0].message).toBe(message);
  });

  it("localizes profile stats and generation action in Spanish", async () => {
    await i18n.changeLanguage("es");
    mockDjQuery = settledQuery({
      ...dj,
      genre_specialties: ["House", "Ambient"],
    });
    mockTracksQuery = settledQuery([trackFixture("one"), trackFixture("two")]);

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByText("2 CANCIONES")).toBeTruthy();
    expect(screen.getByText("2 GÉNEROS")).toBeTruthy();
    expect(screen.getByLabelText("Generar una mezcla nueva")).toBeTruthy();
  });

  it("preserves the generation ActivityIndicator feedback", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = settledQuery([]);
    mockGenerateMix = {
      generate: jest.fn(),
      generateAsync: jest.fn(),
      isStarting: true,
      error: null,
    };

    const screen = await render(<DJProfileScreen />);
    const generateButton = screen.getByLabelText("Generate a new mix");
    const indicator = generateButton.children[0];

    expect(typeof indicator).not.toBe("string");
    if (typeof indicator !== "string") {
      expect(indicator.type).toBe("ActivityIndicator");
    }
    expect(screen.getByText("GENERATING…")).toBeTruthy();
    expect(screen.getByTestId("generating-track-card")).toBeTruthy();
  });

  it("preserves durable generation feedback across remounts and blocks duplicate starts", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = settledQuery([]);
    mockActiveMix = {
      id: "generation:job-1",
      status: "running",
      djId: "dj-one",
    };
    const first = await render(<DJProfileScreen />);

    expect(first.getByText("GENERATING…")).toBeTruthy();
    expect(first.getByTestId("generating-track-card")).toBeTruthy();
    await first.unmount();

    const second = await render(<DJProfileScreen />);
    expect(second.getByText("GENERATING…")).toBeTruthy();
    fireEvent.press(
      second.getByRole("button", { name: "Generate a new mix" }),
    );
    expect(mockGenerateMix.generate).not.toHaveBeenCalled();
  });

  it("never auto-loads a player track when durable activity reports ready", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = settledQuery([]);
    mockActiveMix = {
      id: "generation:job-1",
      status: "ready",
      djId: "dj-one",
    };

    await render(<DJProfileScreen />);

    expect(mockPlayerLoad).not.toHaveBeenCalled();
  });

  it("passes the DJ display title locally when starting a generation", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = settledQuery([]);
    const screen = await render(<DJProfileScreen />);

    fireEvent.press(
      screen.getByRole("button", { name: "Generate a new mix" }),
    );

    expect(mockGenerateMix.generate).toHaveBeenCalledWith(
      { djId: "dj-one", title: "DJ One", lyrics: undefined },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("marks an explicitly opened result as selected with a visible New badge", async () => {
    mockDjQuery = settledQuery(dj);
    mockTracksQuery = settledQuery([
      {
        id: "track-one",
        title: "Track One",
        artist: "Artist",
        audio_url: "track-one.mp3",
        album_art_url: null,
        duration: 180,
        genre: "House",
      },
    ]);
    mockHighlightTrackId = "track-one";

    const screen = await render(<DJProfileScreen />);

    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByTestId("track-card")).toHaveProp(
      "accessibilityState",
      { selected: true },
    );
    expect(screen.getByTestId("track-card")).toHaveProp(
      "accessibilityHint",
      "Newly generated mix",
    );
    expect(mockPlayerLoad).not.toHaveBeenCalled();
  });
});
