/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import ProfileScreen from "@/app/(app)/profile";
import { queryKeys } from "@/src/api/queries";
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

const profile = {
  name: "Listener One",
  username: "listener",
  avatarUrl: null,
  subscriptionTier: "free",
};
const premiumProfile = { ...profile, subscriptionTier: "premium" };
const stats = { hours: 0, tracks: 0, topGenre: null };
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

let mockProfileQuery = initialQuery();
let mockStatsQuery = initialQuery();
let mockDjsHeardQuery = initialQuery();
let mockDjsQuery = initialQuery();
const mockUseProfile = jest.fn(() => mockProfileQuery);
const mockUseListeningTotals = jest.fn(() => mockStatsQuery);
const mockUseDjsHeard = jest.fn(() => mockDjsHeardQuery);
const mockUseDJs = jest.fn(() => mockDjsQuery);
const mockInvalidateQueries = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockReplayTour = jest.fn();
const mockConfirm = jest.fn();
const mockFlushListeningStats = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text: NativeText, View } = require("react-native");
  const placeholder = (testID: string) => function Placeholder() {
    return React.createElement(View, { testID });
  };

  return {
    Avatar: () => React.createElement(View, { testID: "avatar" }),
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    IdentityCard: ({
      title,
      description,
    }: {
      title: string;
      description: string;
    }) =>
      React.createElement(
        View,
        { testID: "identity-card" },
        React.createElement(NativeText, null, title),
        React.createElement(NativeText, null, description),
      ),
    ScreenScrollView: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      contentContainerStyle?: unknown;
      style?: unknown;
    }) => React.createElement(View, { testID: "screen-scroll-view", ...props }, children),
    SettingRow: ({
      label,
      onPress,
      right,
    }: {
      label: string;
      onPress?: () => void;
      right?: React.ReactNode;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: label,
          accessibilityRole: "button",
          disabled: !onPress,
          onPress,
        },
        React.createElement(NativeText, null, label),
        right,
      ),
    StatCard: ({ value, label }: { value: string; label: string }) =>
      React.createElement(NativeText, { testID: `stat-${label}` }, `${value} ${label}`),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
    ProfileDjsSkeleton: placeholder("profile-djs-skeleton"),
    ProfileIdentitySkeleton: placeholder("profile-identity-skeleton"),
    ProfileStatsSkeleton: placeholder("profile-stats-skeleton"),
  };
});

jest.mock("@/src/api/auth", () => ({
  authApi: { signOut: (...args: unknown[]) => mockSignOut(...args) },
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ flushListeningStats: mockFlushListeningStats }),
}));
jest.mock("@/src/onboarding", () => ({
  useAppTour: () => ({ replayTour: mockReplayTour }),
}));
jest.mock("@/src/hooks/use-confirm", () => ({
  useConfirm: () => mockConfirm,
}));
jest.mock("@/src/hooks/use-home", () => ({
  useDJs: () => mockUseDJs(),
}));
jest.mock("@/src/hooks/use-profile", () => ({
  useDjsHeard: () => mockUseDjsHeard(),
  useListeningTotals: () => mockUseListeningTotals(),
  useProfile: () => mockUseProfile(),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useTabBarPadding: () => 96,
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
  useFocusEffect: (effect: () => void) => effect(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 12, right: 2, bottom: 3, left: 4 }),
}));

describe("ProfileScreen", () => {
  beforeEach(() => {
    mockProfileQuery = initialQuery();
    mockStatsQuery = initialQuery();
    mockDjsHeardQuery = initialQuery();
    mockDjsQuery = initialQuery();
    mockUseProfile.mockClear();
    mockUseListeningTotals.mockClear();
    mockUseDjsHeard.mockClear();
    mockUseDJs.mockClear();
    mockInvalidateQueries.mockClear();
    mockRouterPush.mockClear();
    mockRouterReplace.mockClear();
    mockReplayTour.mockClear();
    mockConfirm.mockReset();
    mockConfirm.mockResolvedValue(false);
    mockFlushListeningStats.mockReset();
    mockFlushListeningStats.mockResolvedValue(undefined);
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("renders the Profile surface in Spanish", async () => {
    await i18n.changeLanguage("es");
    mockProfileQuery = settledQuery({ ...profile, name: null });

    const screen = await render(<ProfileScreen />);

    expect(screen.getByText("PREFERENCIAS")).toBeTruthy();
    expect(screen.getByLabelText("Detalles de la cuenta")).toBeTruthy();
    expect(screen.getByText("Oyente")).toBeTruthy();
    expect(screen.getByLabelText("Cerrar sesión")).toBeTruthy();
  });

  it("renders a translated Spanish listening identity", async () => {
    await i18n.changeLanguage("es");
    mockStatsQuery = settledQuery({ ...stats, topGenre: "Ambient" });
    mockDjsHeardQuery = settledQuery(1);

    const screen = await render(<ProfileScreen />);

    expect(screen.getByText("Arquitecto etéreo")).toBeTruthy();
    expect(
      screen.getByText(
        "Ambient profundo, texturas atmosféricas y paisajes sonoros expansivos.",
      ),
    ).toBeTruthy();
  });

  it("loads identity, stats, and DJs independently while Preferences remain", async () => {
    const screen = await render(<ProfileScreen />);

    expect(screen.getByTestId("profile-identity-skeleton")).toBeTruthy();
    expect(screen.getByTestId("profile-stats-skeleton")).toBeTruthy();
    expect(screen.getByTestId("profile-djs-skeleton")).toBeTruthy();
    expect(screen.getByText("PREFERENCES")).toBeTruthy();
    expect(screen.getByLabelText("Account Details")).toBeTruthy();
    expect(screen.getByLabelText("Music Preferences")).toBeTruthy();
    expect(screen.getByLabelText("Subscription")).toBeTruthy();
    expect(screen.getByLabelText("Replay product tour")).toBeTruthy();
    expect(screen.getByLabelText("Logout")).toBeTruthy();
    expect(mockUseProfile).toHaveBeenCalledTimes(1);
    expect(mockUseListeningTotals).toHaveBeenCalledTimes(1);
    expect(mockUseDjsHeard).toHaveBeenCalledTimes(1);
    expect(mockUseDJs).toHaveBeenCalledTimes(1);
  });

  it("requests replay before replacing Profile with Home", async () => {
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByLabelText("Replay product tour"));

    expect(mockReplayTour).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith("/");
    expect(mockReplayTour.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterReplace.mock.invocationCallOrder[0],
    );
  });

  it("shows resolved identity while stats and DJs remain unresolved", async () => {
    mockProfileQuery = settledQuery(profile);

    const screen = await render(<ProfileScreen />);

    expect(screen.queryByTestId("profile-identity-skeleton")).toBeNull();
    expect(screen.getByText("Listener One")).toBeTruthy();
    expect(screen.getByText("@listener")).toBeTruthy();
    expect(screen.getByTestId("profile-stats-skeleton")).toBeTruthy();
    expect(screen.getByTestId("profile-djs-skeleton")).toBeTruthy();
  });

  it("keeps stats skeletonized until both totals queries settle", async () => {
    mockStatsQuery = settledQuery(stats);

    const screen = await render(<ProfileScreen />);

    expect(screen.getByTestId("profile-stats-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("stat-HOURS")).toBeNull();
  });

  it("keeps stats skeletonized when DJs heard settles before totals", async () => {
    mockDjsHeardQuery = settledQuery(0);

    const screen = await render(<ProfileScreen />);

    expect(screen.getByTestId("profile-stats-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("stat-DJS")).toBeNull();
  });

  it("renders settled zero stats while the independent DJs query loads", async () => {
    mockStatsQuery = settledQuery(stats);
    mockDjsHeardQuery = settledQuery(0);

    const screen = await render(<ProfileScreen />);

    expect(screen.queryByTestId("profile-stats-skeleton")).toBeNull();
    expect(screen.getByText("0 HOURS")).toBeTruthy();
    expect(screen.getByText("0 TRACKS")).toBeTruthy();
    expect(screen.getByText("0 DJS")).toBeTruthy();
    expect(screen.getByTestId("identity-card")).toBeTruthy();
    expect(screen.getByTestId("profile-djs-skeleton")).toBeTruthy();
  });

  it("keeps cached profile sections visible during background refetches", async () => {
    mockProfileQuery = settledQuery(profile, "fetching");
    mockStatsQuery = settledQuery(stats, "fetching");
    mockDjsHeardQuery = settledQuery(0, "fetching");
    mockDjsQuery = settledQuery(djs, "fetching");

    const screen = await render(<ProfileScreen />);

    expect(screen.queryByTestId("profile-identity-skeleton")).toBeNull();
    expect(screen.queryByTestId("profile-stats-skeleton")).toBeNull();
    expect(screen.queryByTestId("profile-djs-skeleton")).toBeNull();
    expect(screen.getByText("Listener One")).toBeTruthy();
    expect(screen.getByText("0 HOURS")).toBeTruthy();
    expect(screen.getByText("DJ One")).toBeTruthy();
  });

  it("preserves the premium subscription tier display", async () => {
    mockProfileQuery = settledQuery(premiumProfile);

    const screen = await render(<ProfileScreen />);

    expect(screen.getByText("PRO")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
  });

  it("preserves Profile navigation handlers", async () => {
    mockStatsQuery = settledQuery(stats);
    mockDjsHeardQuery = settledQuery(0);
    mockDjsQuery = settledQuery(djs);

    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByLabelText("Open Vibe Check"));
    await fireEvent.press(screen.getByText("DJ One"));
    await fireEvent.press(screen.getByLabelText("Account Details"));
    await fireEvent.press(screen.getByLabelText("Music Preferences"));

    expect(mockRouterPush.mock.calls).toEqual([
      ["/vibe-check"],
      ["/dj/dj-one"],
      ["/account-settings"],
      ["/preferences"],
    ]);
  });

  it("preserves logout confirmation and the confirmed save/sign-out flow", async () => {
    mockConfirm.mockResolvedValue(true);

    const screen = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Logout"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockConfirm).toHaveBeenCalledWith({
      title: "Logout",
      message: "Are you sure you want to logout?",
      confirmLabel: "Logout",
      destructive: true,
    });
    expect(mockFlushListeningStats).toHaveBeenCalledTimes(1);
    expect(mockFlushListeningStats.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });

  it("preserves safe-area scroll props and focus invalidation", async () => {
    const screen = await render(<ProfileScreen />);
    const scrollView = screen.getByTestId("screen-scroll-view");

    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paddingTop: 28, paddingBottom: 96 }),
      ]),
    );
    expect(scrollView.props.style).toEqual(
      expect.objectContaining({ flex: 1, backgroundColor: "#0D0D12" }),
    );
    expect(mockInvalidateQueries.mock.calls).toEqual([
      [{ queryKey: queryKeys.stats.listening }],
      [{ queryKey: queryKeys.stats.djsHeard }],
    ]);
  });
});
