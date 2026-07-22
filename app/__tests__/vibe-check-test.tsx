/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import VibeCheckScreen from "@/app/vibe-check";
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
): MockQuery => ({ data, isPending: false, fetchStatus });

const zeroVibe = {
  hoursThisWeek: 0,
  tracksThisWeek: 0,
  streak: 0,
  weekOverWeekPct: null,
  topGenre: null,
  genreMix: [],
  week: [],
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

let mockVibeQuery = initialQuery();
let mockDjsQuery = initialQuery();
const mockUseVibeCheck = jest.fn(() => mockVibeQuery);
const mockUseDJs = jest.fn(() => mockDjsQuery);
const mockRouterPush = jest.fn();

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
    ScreenScrollView: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      contentContainerStyle?: unknown;
      showsVerticalScrollIndicator?: boolean;
      style?: unknown;
    }) => React.createElement(View, { testID: "screen-scroll-view", ...props }, children),
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

jest.mock("@/src/hooks/use-home", () => ({
  useDJs: () => mockUseDJs(),
}));
jest.mock("@/src/hooks/use-vibe-check", () => ({
  useVibeCheck: () => mockUseVibeCheck(),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 75,
}));
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 10, right: 2, bottom: 3, left: 4 }),
}));

describe("VibeCheckScreen", () => {
  beforeEach(() => {
    mockVibeQuery = initialQuery();
    mockDjsQuery = initialQuery();
    mockUseVibeCheck.mockClear();
    mockUseDJs.mockClear();
    mockRouterPush.mockClear();
  });

  it("skeletonizes unresolved insight and DJ queries without pre-fetch zeros", async () => {
    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByTestId("vibe-insight-skeleton")).toBeTruthy();
    expect(screen.getByTestId("vibe-djs-skeleton")).toBeTruthy();
    expect(screen.queryByText("0.0")).toBeNull();
    expect(screen.queryByText("0 tracks · 0-day streak")).toBeNull();
    expect(mockUseVibeCheck).toHaveBeenCalledTimes(1);
    expect(mockUseDJs).toHaveBeenCalledTimes(1);
  });

  it("renders settled zero insight while the independent DJ query loads", async () => {
    mockVibeQuery = settledQuery(zeroVibe);

    const screen = await render(<VibeCheckScreen />);

    expect(screen.queryByTestId("vibe-insight-skeleton")).toBeNull();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("0 tracks · 0-day streak")).toBeTruthy();
    expect(screen.getByTestId("vibe-chart")).toBeTruthy();
    expect(screen.getByTestId("vibe-djs-skeleton")).toBeTruthy();
  });

  it("renders Spanish insight copy and zero-count plurals", async () => {
    mockVibeQuery = settledQuery(zeroVibe);
    await i18n.changeLanguage("es");

    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByText("Tu evolución sonora esta semana.")).toBeTruthy();
    expect(screen.getByText("Esta semana")).toBeTruthy();
    expect(screen.getByText("0 canciones · racha de 0 días")).toBeTruthy();
  });

  it("renders settled DJs while the independent insight query loads", async () => {
    mockDjsQuery = settledQuery(djs);

    const screen = await render(<VibeCheckScreen />);

    expect(screen.getByTestId("vibe-insight-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("vibe-djs-skeleton")).toBeNull();
    expect(screen.getByText("DJ One")).toBeTruthy();
  });

  it("keeps cached insight and DJs visible during background refetches", async () => {
    mockVibeQuery = settledQuery(zeroVibe, "fetching");
    mockDjsQuery = settledQuery(djs, "fetching");

    const screen = await render(<VibeCheckScreen />);

    expect(screen.queryByTestId("vibe-insight-skeleton")).toBeNull();
    expect(screen.queryByTestId("vibe-djs-skeleton")).toBeNull();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("DJ One")).toBeTruthy();
  });

  it("preserves the safe-area scroll container contract", async () => {
    const screen = await render(<VibeCheckScreen />);
    const scrollView = screen.getByTestId("screen-scroll-view");

    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paddingTop: 26, paddingBottom: 75 }),
      ]),
    );
    expect(scrollView.props.showsVerticalScrollIndicator).toBe(false);
    expect(scrollView.props.style).toEqual(
      expect.objectContaining({ flex: 1, backgroundColor: "#0D0D12" }),
    );
  });

  it("preserves Top DJ navigation", async () => {
    mockDjsQuery = settledQuery(djs);

    const screen = await render(<VibeCheckScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "DJ One" }));

    expect(mockRouterPush).toHaveBeenCalledWith("/dj/dj-one");
  });
});
