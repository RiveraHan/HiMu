import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { AccessibilityInfo, StyleSheet as RNStyleSheet } from "react-native";

import type { ActivityContextValue } from "@/src/activity";
import type { ActivityItem } from "@/src/activity/types";
import { ActivityPanel } from "@/src/components/activity/ActivityPanel";
import { ActivityPill } from "@/src/components/activity/ActivityPill";
import { ActivityRow } from "@/src/components/activity/ActivityRow";
import i18n from "@/src/i18n";

const mockUseActivity = jest.fn<ActivityContextValue, []>();
const mockWithRepeat = jest.fn((animation) => animation);
const mockWithTiming = jest.fn((value) => value);
let mockReducedMotion = false;

jest.mock("@/src/activity", () => ({
  useActivity: () => mockUseActivity(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 18, left: 0 }),
}));

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return new Proxy(actual, {
    get: (target, property) => {
      if (property === "useReducedMotion") return () => mockReducedMotion;
      if (property === "withRepeat") return (...args: unknown[]) => mockWithRepeat(args[0]);
      if (property === "withTiming") return (...args: unknown[]) => mockWithTiming(args[0]);
      return target[property];
    },
  });
});

const NOW = "2026-08-01T12:00:00.000Z";

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "activity-1",
    source: "server",
    kind: "mix",
    status: "running",
    title: "Nova",
    djId: "dj-1",
    trackId: null,
    createdAt: NOW,
    updatedAt: NOW,
    error: null,
    failureReason: null,
    recoveryAvailable: false,
    retryLyrics: null,
    detail: null,
    seen: false,
    ...overrides,
  };
}

function context(overrides: Partial<ActivityContextValue> = {}): ActivityContextValue {
  return {
    items: [],
    primary: null,
    activeCount: 0,
    isInitialLoading: false,
    isOffline: false,
    queryError: null,
    panelOpen: false,
    openPanel: jest.fn(),
    closePanel: jest.fn(),
    refetch: jest.fn(async () => undefined),
    markSeen: jest.fn(async () => undefined),
    canOpenActivity: jest.fn(() => false),
    openActivity: jest.fn(async () => undefined),
    retryActivity: jest.fn(async () => undefined),
    retryingIds: new Set<string>(),
    activeMixForDj: jest.fn(() => null),
    ...overrides,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  jest.clearAllMocks();
  mockReducedMotion = false;
  mockUseActivity.mockReturnValue(context());
});

describe("ActivityPill", () => {
  it("keeps a 48-point minimum without a fixed height so scaled text can expand", async () => {
    const openPanel = jest.fn();
    mockUseActivity.mockReturnValue(context({ openPanel }));
    const current = activity();
    const screen = await render(<ActivityPill activity={current} activeCount={1} />);

    const pill = screen.getByRole("button", { name: "Generating with Nova" });
    expect(RNStyleSheet.flatten(pill.props.style)).toEqual(
      expect.objectContaining({ minHeight: 48 }),
    );
    expect(RNStyleSheet.flatten(pill.props.style).height).toBeUndefined();
    await fireEvent.press(pill);
    expect(openPanel).toHaveBeenCalledTimes(1);
  });

  it("uses plural active copy and combines terminal status with active work", async () => {
    const screen = await render(
      <ActivityPill activity={activity()} activeCount={2} />,
    );
    expect(screen.getByText("2 processes active")).toBeTruthy();

    await screen.rerender(
      <ActivityPill
        activity={activity({ status: "ready", trackId: "track-1" })}
        activeCount={1}
      />,
    );
    expect(screen.getByRole("button", { name: "Your mix is ready · 1 active" })).toBeTruthy();

    await screen.rerender(
      <ActivityPill
        activity={activity({ status: "failed", failureReason: "generationFailed" })}
        activeCount={2}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Mix generation needs attention · 2 active",
      }),
    ).toBeTruthy();
  });

  it("covers singular counts and loading, offline, and error fallbacks", async () => {
    const screen = await render(
      <ActivityPill activity={activity()} activeCount={1} />,
    );
    expect(screen.getByText("Generating with Nova")).toBeTruthy();

    await screen.rerender(
      <ActivityPill activity={null} activeCount={0} fallbackStatus="loading" />,
    );
    expect(screen.getByRole("button", { name: "Loading activity" })).toBeTruthy();
    await screen.rerender(
      <ActivityPill activity={null} activeCount={0} fallbackStatus="offline" />,
    );
    expect(
      screen.getByRole("button", {
        name: "Activity will update when you're back online",
      }),
    ).toBeTruthy();
    await screen.rerender(
      <ActivityPill activity={null} activeCount={0} fallbackStatus="error" />,
    );
    expect(screen.getByRole("button", { name: "Activity is unavailable" })).toBeTruthy();
  });

  it("does not start its looping status animation when reduced motion is enabled", async () => {
    mockReducedMotion = true;
    await render(<ActivityPill activity={activity()} activeCount={1} />);
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });
});

describe("ActivityRow", () => {
  it.each([
    ["mix", "running", "Generating with Nova"],
    ["create-dj", "running", "Creating Nova"],
    ["update-dj", "ready", "Nova was updated"],
    ["cover", "ready", "Artwork for Nova is ready"],
  ] as const)("labels %s %s activity", async (kind, status, expected) => {
    const screen = await render(
      <ActivityRow activity={activity({ kind, status })} />,
    );
    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.getByTestId("activity-row")).toHaveProp("accessible", false);
  });

  it("maps safe failure details and portrait detail without exposing a raw error", async () => {
    const rawError = "provider secret: stack trace";
    const screen = await render(
      <ActivityRow
        activity={activity({
          status: "failed",
          error: rawError,
          failureReason: "stalled",
        })}
      />,
    );
    expect(screen.getByText("Mix generation needs attention")).toBeTruthy();
    expect(
      screen.getByText("The mix stopped responding. You can safely try again."),
    ).toBeTruthy();
    expect(screen.queryByText(rawError)).toBeNull();

    await screen.rerender(
      <ActivityRow
        activity={activity({
          kind: "update-dj",
          status: "ready",
          detail: "portraitUnavailable",
        })}
      />,
    );
    expect(
      screen.getByText("The DJ is ready, but its new portrait is unavailable."),
    ).toBeTruthy();
  });

  it("renders only supplied 44-point actions with kind-specific destination copy", async () => {
    const onOpen = jest.fn();
    const onRetry = jest.fn();
    const screen = await render(
      <ActivityRow
        activity={activity({ status: "ready", trackId: "track-1" })}
        onOpen={onOpen}
      />,
    );
    let action = screen.getByRole("button", { name: "Open mix" });
    expect(RNStyleSheet.flatten(action.props.style)).toEqual(
      expect.objectContaining({ minHeight: 44, minWidth: 44 }),
    );
    await fireEvent.press(action);
    expect(onOpen).toHaveBeenCalledTimes(1);

    await screen.rerender(
      <ActivityRow
        activity={activity({ kind: "create-dj", status: "ready" })}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole("button", { name: "View DJ" })).toBeTruthy();

    await screen.rerender(
      <ActivityRow
        activity={activity({ kind: "cover", status: "ready", trackId: "track-1" })}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole("button", { name: "Return to player" })).toBeTruthy();

    await screen.rerender(
      <ActivityRow
        activity={activity({ status: "failed", failureReason: "generationFailed" })}
        onRetry={onRetry}
        retrying
      />,
    );
    action = screen.getByRole("button", { name: "Retrying…" });
    expect(action).toHaveProp("accessibilityState", { disabled: true, busy: true });
  });

  it("keeps active rows informational and lets only destinationless terminal rows dismiss", async () => {
    const dismiss = jest.fn();
    const screen = await render(
      <ActivityRow activity={activity({ kind: "create-dj", djId: null })} />,
    );
    expect(screen.queryByRole("button", { name: "View DJ" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();

    await screen.rerender(
      <ActivityRow
        activity={activity({ kind: "cover", status: "ready", trackId: "old-track" })}
        onDismiss={dismiss}
      />,
    );
    expect(screen.queryByRole("button", { name: "Return to player" })).toBeNull();
    const action = screen.getByRole("button", { name: "Dismiss" });
    await fireEvent.press(action);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ActivityPanel", () => {
  it("is modal, bounded, scrollable, safe-area padded, announced, and focusable", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus");
    const nodeHandle = jest.spyOn(ReactNative, "findNodeHandle").mockReturnValue(44);
    mockUseActivity.mockReturnValue(
      context({ panelOpen: true, items: [activity()], primary: activity(), activeCount: 1 }),
    );

    const screen = await render(<ActivityPanel />);
    expect(screen.getByTestId("activity-panel")).toHaveProp(
      "accessibilityViewIsModal",
      true,
    );
    expect(screen.getByTestId("activity-panel")).not.toHaveProp("accessible", true);
    expect(screen.getByRole("header", { name: "Activity" })).toHaveProp("focusable", true);
    expect(screen.getByRole("button", { name: "Close activity" })).toBeTruthy();
    expect(screen.getByTestId("activity-backdrop", { includeHiddenElements: true })).toHaveProp(
      "accessible",
      false,
    );
    const panelStyle = RNStyleSheet.flatten(screen.getByTestId("activity-panel-surface").props.style);
    expect(panelStyle).toEqual(expect.objectContaining({ maxWidth: 520 }));
    expect(typeof panelStyle.maxHeight).toBe("number");
    expect(panelStyle.maxHeight).toBeGreaterThan(0);
    expect(screen.getByTestId("activity-list")).toBeTruthy();
    expect(
      RNStyleSheet.flatten(screen.getByTestId("activity-list-content").props.style),
    ).toEqual(expect.objectContaining({ paddingBottom: 34 }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith("Activity"));
    expect(focus).toHaveBeenCalledTimes(1);
    nodeHandle.mockRestore();
  });

  it("uses no modal transition or looping status animation with reduced motion", async () => {
    mockReducedMotion = true;
    mockUseActivity.mockReturnValue(
      context({ panelOpen: true, items: [activity()], primary: activity(), activeCount: 1 }),
    );
    const screen = await render(<ActivityPanel />);
    expect(screen.getByTestId("activity-modal")).toHaveProp("animationType", "none");
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });

  it("shows initial loading, offline, error, and successful empty semantics", async () => {
    mockUseActivity.mockReturnValue(context({ panelOpen: true, isInitialLoading: true }));
    const screen = await render(<ActivityPanel />);
    expect(screen.getByTestId("activity-loading")).toBeTruthy();
    expect(screen.queryByText("No recent activity")).toBeNull();

    mockUseActivity.mockReturnValue(context({ panelOpen: true, isOffline: true }));
    await screen.rerender(<ActivityPanel />);
    expect(screen.getByText("Activity will update when you're back online")).toBeTruthy();

    mockUseActivity.mockReturnValue(context({ panelOpen: true, queryError: new Error("raw") }));
    await screen.rerender(<ActivityPanel />);
    expect(screen.getByText("Activity is unavailable")).toBeTruthy();
    expect(screen.queryByText("raw")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    mockUseActivity.mockReturnValue(context({ panelOpen: true }));
    await screen.rerender(<ActivityPanel />);
    expect(screen.getByText("No recent activity")).toBeTruthy();
  });

  it("preserves cached rows under compact offline and error notices", async () => {
    const item = activity();
    mockUseActivity.mockReturnValue(
      context({ panelOpen: true, items: [item], primary: item, activeCount: 1, isOffline: true }),
    );
    const screen = await render(<ActivityPanel />);
    expect(screen.getByText("Generating with Nova")).toBeTruthy();
    expect(screen.getByTestId("activity-state-notice")).toBeTruthy();

    mockUseActivity.mockReturnValue(
      context({
        panelOpen: true,
        items: [item],
        primary: item,
        activeCount: 1,
        queryError: new Error("never render me"),
      }),
    );
    await screen.rerender(<ActivityPanel />);
    expect(screen.getByText("Generating with Nova")).toBeTruthy();
    expect(screen.queryByText("never render me")).toBeNull();
  });

  it("wires destination, retry, and dismiss actions without creating dead CTAs", async () => {
    const openMix = activity({ id: "mix-ready", status: "ready", trackId: "track-1" });
    const openDj = activity({ id: "dj-ready", kind: "create-dj", status: "ready" });
    const retryMix = activity({
      id: "mix-failed",
      status: "failed",
      failureReason: "generationFailed",
      recoveryAvailable: true,
    });
    const openActivity = jest.fn(async () => undefined);
    const retryActivity = jest.fn(async () => undefined);
    mockUseActivity.mockReturnValue(
      context({
        panelOpen: true,
        items: [openMix, openDj, retryMix],
        canOpenActivity: jest.fn((item) => item.id !== retryMix.id),
        openActivity,
        retryActivity,
      }),
    );
    const screen = await render(<ActivityPanel />);

    await fireEvent.press(screen.getByRole("button", { name: "Open mix" }));
    await fireEvent.press(screen.getByRole("button", { name: "View DJ" }));
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(openActivity).toHaveBeenCalledTimes(2);
    expect(retryActivity).toHaveBeenCalledWith(retryMix);
  });

  it("offers Retry for a recoverable slow mix without failure wording", async () => {
    const slow = activity({ status: "slow", recoveryAvailable: true });
    mockUseActivity.mockReturnValue(context({ panelOpen: true, items: [slow] }));
    const screen = await render(<ActivityPanel />);
    expect(screen.getByText("Nova is taking a little longer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByText("Mix generation needs attention")).toBeNull();
    expect(screen.queryByText("The mix couldn't be completed. You can try again.")).toBeNull();
  });

  it("does not invent destinations for active create or stale terminal cover", async () => {
    const activeCreate = activity({ id: "active-create", kind: "create-dj", djId: null });
    const staleCover = activity({
      id: "stale-cover",
      kind: "cover",
      status: "ready",
      trackId: "old-track",
    });
    mockUseActivity.mockReturnValue(
      context({ panelOpen: true, items: [activeCreate, staleCover] }),
    );
    const screen = await render(<ActivityPanel />);
    expect(screen.queryByRole("button", { name: "View DJ" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Return to player" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(1);
  });
});
