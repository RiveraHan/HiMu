/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import VibeCheckScreen from "@/app/vibe-check";
import i18n from "@/src/i18n";

type MockQuery<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: jest.Mock;
};

const mockVibeRefetch = jest.fn();
const mockDjsRefetch = jest.fn();
const initialQuery = <T,>(refetch: jest.Mock): MockQuery<T> => ({
  data: undefined,
  isPending: true,
  isError: false,
  fetchStatus: "fetching",
  refetch,
});
const settledQuery = <T,>(
  data: T,
  refetch: jest.Mock,
  overrides: Partial<MockQuery<T>> = {},
): MockQuery<T> => ({
  data,
  isPending: false,
  isError: false,
  fetchStatus: "idle",
  refetch,
  ...overrides,
});

type VibeData = {
  hoursThisWeek: number;
  tracksThisWeek: number;
  streak: number;
  weekOverWeekPct: number | null;
  topGenre: string | null;
  genreMix: { genre: string; percentage: number }[];
  week: { day: string; minutes: number }[];
};

const zeroVibe: VibeData = {
  hoursThisWeek: 0,
  tracksThisWeek: 0,
  streak: 0,
  weekOverWeekPct: null,
  topGenre: null,
  genreMix: [],
  week: [],
};
const listeningVibe = {
  ...zeroVibe,
  hoursThisWeek: 4,
  tracksThisWeek: 23,
  topGenre: "Ambient",
  genreMix: [{ genre: "Ambient", percentage: 1 }],
  week: [{ day: "mon", minutes: 240 }],
};
const djs = [
  {
    id: "dj-one",
    name: "DJ One",
    slug: "dj-one",
    avatar_url: null,
    genre_specialties: ["House"],
    is_premium: false,
    owner_id: "listener-one",
  },
];

let mockOnline = true;
let mockVibeQuery = initialQuery<VibeData>(mockVibeRefetch);
let mockDjsQuery = initialQuery<typeof djs>(mockDjsRefetch);
const mockUseVibeCheck = jest.fn(() => mockVibeQuery);
const mockUseDJs = jest.fn(() => mockDjsQuery);
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text: NativeText, View } = require("react-native");
  const placeholder = (testID: string) => function Placeholder() {
    return React.createElement(View, { testID });
  };

  return {
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    ScreenHeader: ({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) =>
      React.createElement(
        View,
        { testID: "screen-header" },
        React.createElement(NativeText, null, kicker),
        React.createElement(NativeText, null, title),
        React.createElement(NativeText, null, subtitle),
      ),
    ScreenScrollView: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: "screen-scroll-view", ...props }, children),
    StateNotice: ({ title, message, actionLabel, onAction, compact }: {
      title: string;
      message?: string;
      actionLabel?: string;
      onAction?: () => void;
      compact?: boolean;
    }) => React.createElement(
      View,
      { testID: compact ? "compact-notice" : "state-notice" },
      React.createElement(NativeText, null, title),
      message ? React.createElement(NativeText, null, message) : null,
      actionLabel && onAction
        ? React.createElement(
            Pressable,
            { accessibilityLabel: actionLabel, accessibilityRole: "button", onPress: onAction },
            React.createElement(NativeText, null, actionLabel),
          )
        : null,
    ),
    StatCard: ({ value, label }: { value: string; label: string }) =>
      React.createElement(NativeText, null, `${value} ${label}`),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
    TopDjRow: ({ name, onPress }: { name: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityLabel: name, accessibilityRole: "button", onPress },
        React.createElement(NativeText, { testID: "top-dj-row" }, name),
      ),
    TopGenreCard: () => React.createElement(View, { testID: "top-genre-card" }),
    VibeAreaChart: () => React.createElement(View, { testID: "vibe-chart" }),
    VibeDjsSkeleton: placeholder("vibe-djs-skeleton"),
    VibeInsightSkeleton: placeholder("vibe-insight-skeleton"),
  };
});

jest.mock("@/src/hooks/use-home", () => ({ useDJs: () => mockUseDJs() }));
jest.mock("@/src/hooks/use-vibe-check", () => ({ useVibeCheck: () => mockUseVibeCheck() }));
jest.mock("@/src/hooks/use-online-status", () => ({ useOnlineStatus: () => mockOnline }));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useMiniPlayerPadding: () => 75 }));
jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 10, right: 2, bottom: 3, left: 4 }),
}));

describe("VibeCheckScreen", () => {
  beforeEach(() => {
    mockOnline = true;
    mockVibeQuery = initialQuery(mockVibeRefetch);
    mockDjsQuery = initialQuery(mockDjsRefetch);
    jest.clearAllMocks();
  });

  it("shows independent structural placeholders only for initial loading", async () => {
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByTestId("vibe-insight-skeleton")).toBeTruthy();
    expect(screen.getByTestId("vibe-djs-skeleton")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(mockUseVibeCheck).toHaveBeenCalledTimes(1);
    expect(mockUseDJs).toHaveBeenCalledTimes(1);
  });

  it("puts offline/no-data ahead of an unresolved skeleton and retries", async () => {
    mockOnline = false;
    mockVibeQuery = {
      ...initialQuery(mockVibeRefetch),
      isPending: true,
      fetchStatus: "paused",
    };
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.queryByTestId("vibe-insight-skeleton")).toBeNull();
    await fireEvent.press(screen.getAllByRole("button", { name: "Retry" })[0]);
    expect(mockVibeRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows a blocking insight failure without misleading zeros", async () => {
    mockVibeQuery = {
      data: undefined,
      isPending: false,
      isError: true,
      fetchStatus: "idle",
      refetch: mockVibeRefetch,
    };
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByText("Listening insights are unavailable")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByTestId("vibe-chart")).toBeNull();
    await fireEvent.press(screen.getAllByRole("button", { name: "Retry" })[0]);
    expect(mockVibeRefetch).toHaveBeenCalledTimes(1);
  });

  it("turns successful zero listening into an actionable empty state", async () => {
    mockVibeQuery = settledQuery(zeroVibe, mockVibeRefetch);
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByText("Start listening to build your Vibe Check")).toBeTruthy();
    expect(screen.queryByTestId("vibe-chart")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Discover music" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/(app)/discover");
  });

  it("keeps cached insight visible and appends a compact refresh failure", async () => {
    mockVibeQuery = settledQuery(listeningVibe, mockVibeRefetch, { isError: true });
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByTestId("vibe-chart")).toBeTruthy();
    expect(screen.getByText("Listening insights are unavailable")).toBeTruthy();
    expect(screen.getByTestId("compact-notice")).toBeTruthy();
  });

  it("keeps DJ failure and empty handling local to the DJ section", async () => {
    mockVibeQuery = settledQuery(listeningVibe, mockVibeRefetch);
    mockDjsQuery = {
      data: undefined,
      isPending: false,
      isError: true,
      fetchStatus: "idle",
      refetch: mockDjsRefetch,
    };
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByTestId("vibe-chart")).toBeTruthy();
    expect(screen.getByText("DJ insights are unavailable")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockDjsRefetch).toHaveBeenCalledTimes(1);

    mockDjsQuery = settledQuery([], mockDjsRefetch);
    await screen.rerender(<VibeCheckScreen />);
    expect(screen.getByText("No DJs to rank yet")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Go to Home" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/");
  });

  it("keeps cached DJs visible during a failed refresh", async () => {
    mockVibeQuery = settledQuery(listeningVibe, mockVibeRefetch);
    mockDjsQuery = settledQuery(djs, mockDjsRefetch, { isError: true });
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByText("DJ One")).toBeTruthy();
    expect(screen.getByText("DJ insights are unavailable")).toBeTruthy();
  });

  it("renders exact Spanish empty and failure copy", async () => {
    mockVibeQuery = settledQuery(zeroVibe, mockVibeRefetch);
    mockDjsQuery = settledQuery([], mockDjsRefetch);
    await i18n.changeLanguage("es");
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByText("Empieza a escuchar para crear tu Vibe Check")).toBeTruthy();
    expect(screen.getByText("Aún no hay DJs para clasificar")).toBeTruthy();
  });

  it("preserves the safe-area scroll container contract", async () => {
    const screen = await render(<VibeCheckScreen />);
    const scrollView = screen.getByTestId("screen-scroll-view");

    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingTop: 26, paddingBottom: 75 })]),
    );
    expect(scrollView.props.showsVerticalScrollIndicator).toBe(false);
    expect(scrollView.props.style).toEqual(
      expect.objectContaining({ flex: 1, backgroundColor: "#0D0D12" }),
    );
  });

  it("preserves Top DJ navigation", async () => {
    mockVibeQuery = settledQuery(listeningVibe, mockVibeRefetch);
    mockDjsQuery = settledQuery(djs, mockDjsRefetch);
    const screen = await render(<VibeCheckScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "DJ One" }));
    expect(mockRouterPush).toHaveBeenCalledWith("/dj/dj-one");
  });
});
