import { fireEvent, render, renderHook, within } from "@testing-library/react-native";
import { View } from "react-native";

import { ActivityPanel } from "@/src/components/activity/ActivityPanel";
import { BottomChrome } from "@/src/components/BottomChrome";
import { bottomChromePadding } from "@/src/components/bottom-chrome-metrics";
import i18n from "@/src/i18n";
import { useMiniPlayerPadding, useTabBarPadding } from "@/src/hooks/use-tab-bar-padding";
import { usePlayerStore } from "@/src/stores/player-store";

let mockSegments: string[] = ["(app)"];
let mockPhase = "idle";
let mockWindowWidth = 390;
let mockActivity = createActivityState();

function createActivityState(
  overrides: Partial<ReturnType<typeof baseActivityState>> = {},
) {
  return { ...baseActivityState(), ...overrides };
}

function baseActivityState() {
  return {
    items: [],
    primary: null,
    activeCount: 0,
    isInitialLoading: false,
    isOffline: false,
    queryError: null as Error | null,
    panelOpen: false,
    openPanel: jest.fn(() => {
      mockActivity.panelOpen = true;
    }),
    closePanel: jest.fn(() => {
      mockActivity.panelOpen = false;
    }),
    refetch: jest.fn(async () => undefined),
    markSeen: jest.fn(async () => undefined),
    canOpenActivity: jest.fn(() => false),
    openActivity: jest.fn(async () => undefined),
    retryActivity: jest.fn(async () => undefined),
    retryingIds: new Set<string>(),
    activeMixForDj: jest.fn(() => null),
  };
}

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSegments: () => mockSegments,
}));

jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ next: jest.fn(), prev: jest.fn(), toggle: jest.fn() }),
}));

jest.mock("@/src/activity", () => ({
  useActivity: () => mockActivity,
}));

jest.mock("@/src/onboarding", () => ({
  useAppTour: () => ({ phase: mockPhase }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 20, left: 0 }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 844, scale: 1, fontScale: 1 }),
}));

describe("bottom chrome geometry", () => {
  it("reserves tab bar, player, activity, gaps, safe area, and tail", () => {
    expect(
      bottomChromePadding({
        safeBottom: 20,
        hasTabBar: true,
        hasPlayer: true,
        hasActivity: true,
        gap: 8,
        tail: 32,
      }),
    ).toBe(252);
  });

  it("reserves a pushed-screen activity trigger without player or tab bar", () => {
    expect(
      bottomChromePadding({
        safeBottom: 20,
        hasTabBar: false,
        hasPlayer: false,
        hasActivity: true,
        gap: 8,
        tail: 32,
      }),
    ).toBe(108);
  });

  it("makes both existing padding hooks activity-aware", async () => {
    mockActivity = createActivityState({ isOffline: true });
    usePlayerStore.getState().setNowPlaying(
      {
        id: "track-1",
        title: "Night Bloom",
        artist: "Luna",
        audio_url: "https://example.com/night-bloom.mp3",
        album_art_url: null,
        duration: 180,
      },
      [],
      0,
    );

    const padding = await renderHook(() => [
      useTabBarPadding(),
      useMiniPlayerPadding(),
    ]);
    expect(padding.result.current).toEqual([252, 180]);
    await padding.unmount();
  });
});

describe("BottomChrome", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockSegments = ["(app)"];
    mockPhase = "idle";
    mockWindowWidth = 390;
    mockActivity = createActivityState({ isInitialLoading: true });
    usePlayerStore.getState().reset();
    usePlayerStore.getState().setNowPlaying(
      {
        id: "track-1",
        title: "Night Bloom",
        artist: "Luna",
        audio_url: "https://example.com/night-bloom.mp3",
        album_art_url: null,
        duration: 180,
      },
      [],
      0,
    );
  });

  it("stacks activity above the embedded MiniPlayer", async () => {
    const screen = await render(<BottomChrome />);
    const stack = screen.getByTestId("bottom-chrome-stack");

    expect(stack.children).toHaveLength(2);
    expect((stack.children[0] as { props: object }).props).toEqual(
      expect.objectContaining({ accessibilityLabel: "Loading activity" }),
    );
    expect(
      within(stack.children[1] as never).getByLabelText(
        "Open player: Night Bloom by Luna",
      ),
    ).toBeTruthy();
  });

  it.each([
    [["(auth)"], "idle"],
    [["player"], "idle"],
    [["focus-mode"], "idle"],
    [["(app)"], "welcome"],
  ])("hides on route %j in onboarding phase %s", async (segments, phase) => {
    mockSegments = segments;
    mockPhase = phase;

    const screen = await render(<BottomChrome />);

    expect(screen.queryByTestId("bottom-chrome")).toBeNull();
  });

  it("spans the tablet window and centers a stack capped at 720", async () => {
    mockWindowWidth = 1024;
    const screen = await render(<BottomChrome />);

    expect(screen.getByTestId("bottom-chrome")).toHaveStyle({
      width: 1024,
      alignItems: "center",
    });
    expect(screen.getByTestId("bottom-chrome-stack")).toHaveStyle({
      width: "88%",
      maxWidth: 720,
      alignSelf: "center",
    });
  });

  it.each([
    ["offline", { isOffline: true }, "Activity will update when you're back online"],
    ["loading", { isInitialLoading: true }, "Loading activity"],
    ["error", { queryError: new Error("unavailable") }, "Activity is unavailable"],
  ])("opens the panel from an initial %s trigger with no activity rows", async (_name, state, notice) => {
    mockActivity = createActivityState(state);
    const screen = await render(
      <View>
        <BottomChrome />
        <ActivityPanel />
      </View>,
    );

    await fireEvent.press(screen.getByLabelText(notice));
    await screen.rerender(
      <View>
        <BottomChrome />
        <ActivityPanel />
      </View>,
    );

    const panel = screen.getByTestId("activity-panel");
    expect(panel).toBeTruthy();
    if (_name === "loading") {
      expect(within(panel).getByLabelText(notice)).toBeTruthy();
    } else {
      expect(within(panel).getByText(notice)).toBeTruthy();
    }
    await screen.unmount();
  });

  it("has no persistent activity trigger after a successful empty query", async () => {
    mockActivity = createActivityState();
    const screen = await render(<BottomChrome />);

    expect(screen.queryByRole("button", { name: /activity/i })).toBeNull();
    expect(screen.getByLabelText("Open player: Night Bloom by Luna")).toBeTruthy();
    await screen.unmount();
  });
});
