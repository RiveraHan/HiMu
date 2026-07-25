/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { AppState, Text } from "react-native";

import i18n from "@/src/i18n";
import { AppTourProvider } from "../AppTourProvider";
import { HOME_TOUR_STEPS } from "../constants";
import type { SpotlightStep, SpotlightStepDefinition } from "../types";
import { useAppTour } from "../use-app-tour";

let mockOnboarding: { data: unknown; isPending: boolean; isError: boolean };
let mockSegments = ["(app)"];
let mockToast: unknown = null;
let mockConfirm: unknown = null;
let mockTourApi: ReturnType<typeof useAppTour> | null = null;
let mockEngineProps: {
  active: boolean;
  currentIndex: number;
  ready: boolean;
  steps: readonly SpotlightStep[];
} | null = null;
const mockMutateAsync = jest.fn(async (_record: unknown) => undefined);

jest.mock("@/src/stores/auth-store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ isLoading: false, session: { user: { id: "u1" } } }),
}));
jest.mock("@/src/stores/toast-store", () => ({
  useToastStore: (selector: (state: unknown) => unknown) =>
    selector({ current: mockToast }),
}));
jest.mock("@/src/stores/confirm-store", () => ({
  useConfirmStore: (selector: (state: unknown) => unknown) =>
    selector({ pending: mockConfirm }),
}));
jest.mock("@/src/hooks/use-onboarding", () => ({
  useOnboarding: () => mockOnboarding,
  useSaveOnboarding: () => ({ mutateAsync: mockMutateAsync }),
}));
jest.mock("expo-router", () => ({ useSegments: () => mockSegments }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../engine/SpotlightTourEngine", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SpotlightTourEngine: (props: {
      active: boolean;
      children: React.ReactNode;
      currentIndex: number;
      ready: boolean;
      steps: readonly SpotlightStep[];
    }) => {
      mockEngineProps = props;
      return React.createElement(
        View,
        { testID: "mock-engine" },
        props.children,
        props.active && props.ready
          ? React.createElement(View, { testID: "mock-tour-overlay" })
          : null,
      );
    },
  };
});

function record(overrides: Record<string, unknown> = {}) {
  const at = "2026-07-17T12:00:00.000Z";
  return {
    userId: "u1",
    version: 1,
    status: "in_progress",
    lastStep: "home.discover",
    startedAt: at,
    completedAt: null,
    skippedAt: null,
    firstPlayAt: null,
    contextualTips: {},
    replayCount: 0,
    lastReplayedAt: null,
    updatedAt: at,
    ...overrides,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function HomeRegistration({
  autoContinue = true,
  ensureStepVisible,
  steps,
}: {
  autoContinue?: boolean;
  ensureStepVisible: (stepId: string) => Promise<void>;
  steps: readonly SpotlightStepDefinition[];
}) {
  const tour = useAppTour();
  mockTourApi = tour;
  const registerHome = tour.registerHome;
  useEffect(
    () =>
      registerHome({
        ready: true,
        steps,
        hasPlayableCandidate: false,
        ensureStepVisible,
        playFirstAvailable: async () => false,
      }),
    [ensureStepVisible, registerHome, steps],
  );
  useEffect(() => {
    if (autoContinue && tour.canContinue) tour.continueTour();
  }, [autoContinue, tour]);
  return <Text testID="phase">{tour.phase}</Text>;
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockOnboarding = { data: null, isPending: false, isError: false };
  mockSegments = ["(app)"];
  mockToast = null;
  mockConfirm = null;
  mockTourApi = null;
  mockEngineProps = null;
  mockMutateAsync.mockClear();
  mockMutateAsync.mockResolvedValue(undefined);
});

it("rerenders an open spotlight in the new language without resetting progress", async () => {
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(mockEngineProps).toMatchObject({
      active: true,
      currentIndex: 2,
      ready: true,
      steps: [
        expect.objectContaining({ title: "START HERE" }),
        expect.objectContaining({ title: "DIFFERENT MINDS, DIFFERENT SOUNDS" }),
        expect.objectContaining({ title: "GO BEYOND YOUR FEED" }),
      ],
    }),
  );
  const writesBeforeLanguageChange = mockMutateAsync.mock.calls.length;

  await act(() => i18n.changeLanguage("es"));

  await waitFor(() =>
    expect(mockEngineProps).toMatchObject({
      active: true,
      currentIndex: 2,
      ready: true,
      steps: [
        expect.objectContaining({ title: "EMPIEZA AQUÍ" }),
        expect.objectContaining({ title: "MENTES DISTINTAS, SONIDOS DISTINTOS" }),
        expect.objectContaining({ title: "VE MÁS ALLÁ DE TU FEED" }),
      ],
    }),
  );
  expect(view.getByTestId("phase").props.children).toBe("home_spotlights");
  expect(mockMutateAsync).toHaveBeenCalledTimes(writesBeforeLanguageChange);
});

it("retires first-run readiness until an offscreen previous fallback is visible", async () => {
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const initialEnsure = jest.fn(async () => undefined);
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={initialEnsure}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  expect(mockEngineProps).toMatchObject({ currentIndex: 2, ready: true });

  const scroll = deferred();
  const ensureFallback = jest.fn(() => scroll.promise);
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={ensureFallback}
        steps={[HOME_TOUR_STEPS[0]]}
      />
    </AppTourProvider>,
  );

  await waitFor(() =>
    expect(ensureFallback).toHaveBeenCalledWith("home.daily-drop"),
  );
  expect(mockEngineProps).toMatchObject({ active: true, ready: false });
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();

  await act(() => scroll.resolve());

  await waitFor(() =>
    expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true }),
  );
  expect(view.getByTestId("mock-tour-overlay")).toBeTruthy();
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ lastStep: "home.daily-drop" }),
  );
});

it("retires replay readiness until an offscreen next fallback is visible", async () => {
  mockOnboarding = {
    data: record({
      status: "completed",
      lastStep: "home.ready",
      completedAt: "2026-07-17T12:30:00.000Z",
    }),
    isPending: false,
    isError: false,
  };
  const initialEnsure = jest.fn(async () => undefined);
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={initialEnsure}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(mockTourApi?.phase).toBe("idle"));
  await act(() => mockTourApi!.replayTour());
  await fireEvent.press(
    await waitFor(() => view.getByLabelText("Continue introduction")),
  );
  await fireEvent.press(view.getByLabelText("Show me around HiMu"));
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true });
  mockMutateAsync.mockClear();

  const scroll = deferred();
  const ensureFallback = jest.fn(() => scroll.promise);
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={ensureFallback}
        steps={[HOME_TOUR_STEPS[1], HOME_TOUR_STEPS[2]]}
      />
    </AppTourProvider>,
  );

  await waitFor(() => expect(ensureFallback).toHaveBeenCalledWith("home.djs"));
  expect(mockEngineProps).toMatchObject({ active: true, ready: false });
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();

  await act(() => scroll.resolve());

  await waitFor(() =>
    expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true }),
  );
  expect(view.getByTestId("mock-tour-overlay")).toBeTruthy();
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("ignores an old visibility promise after Home registers a newer fallback", async () => {
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const oldScroll = deferred();
  const oldEnsure = jest.fn(() => oldScroll.promise);
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={oldEnsure}
        steps={[HOME_TOUR_STEPS[0]]}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(oldEnsure).toHaveBeenCalledWith("home.daily-drop"),
  );

  const currentScroll = deferred();
  const currentEnsure = jest.fn(() => currentScroll.promise);
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={currentEnsure}
        steps={[HOME_TOUR_STEPS[1]]}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(currentEnsure).toHaveBeenCalledWith("home.djs"));

  await act(() => oldScroll.resolve());

  expect(mockEngineProps).toMatchObject({ active: true, ready: false });
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();
  expect(mockMutateAsync).not.toHaveBeenCalled();

  await act(() => currentScroll.resolve());

  await waitFor(() =>
    expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true }),
  );
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ lastStep: "home.djs" }),
  );
});

it("keeps a visibility settlement retired during a collision and retries afterward", async () => {
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const scroll = deferred();
  const ensureFallback = jest.fn(() => scroll.promise);
  const fallbackSteps = [HOME_TOUR_STEPS[0]];
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={ensureFallback}
        steps={fallbackSteps}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(1));

  mockToast = { id: "collision" };
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={ensureFallback}
        steps={fallbackSteps}
      />
    </AppTourProvider>,
  );
  await act(() => scroll.resolve());

  expect(mockEngineProps).toMatchObject({ active: true, ready: false });
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();
  expect(mockMutateAsync).not.toHaveBeenCalled();

  mockToast = null;
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={ensureFallback}
        steps={fallbackSteps}
      />
    </AppTourProvider>,
  );

  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true }),
  );
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ lastStep: "home.daily-drop" }),
  );
});

it("ignores a visibility settlement after the Home registration unmounts", async () => {
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const scroll = deferred();
  const ensureFallback = jest.fn(() => scroll.promise);
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={ensureFallback}
        steps={[HOME_TOUR_STEPS[0]]}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(1));

  await view.unmount();
  await act(() => scroll.resolve());

  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("ignores a visibility settlement after the route leaves Home", async () => {
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const scroll = deferred();
  const ensureFallback = jest.fn(() => scroll.promise);
  const fallbackSteps = [HOME_TOUR_STEPS[0]];
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={ensureFallback}
        steps={fallbackSteps}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(1));

  mockSegments = ["(app)", "profile"];
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        autoContinue={false}
        ensureStepVisible={ensureFallback}
        steps={fallbackSteps}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("idle"),
  );
  await act(() => scroll.resolve());

  expect(mockEngineProps).toMatchObject({ active: false, ready: false });
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("adapts an interrupted first-run cursor after pending previous-fallback visibility", async () => {
  let appStateListener: ((state: "inactive") => void) | undefined;
  const listenerSpy = jest.spyOn(AppState, "addEventListener").mockImplementation(
    ((_type: string, listener: (state: "inactive") => void) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    }) as typeof AppState.addEventListener,
  );
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const scroll = deferred();
  const ensureFallback = jest.fn(() => scroll.promise);
  const fallbackSteps = [HOME_TOUR_STEPS[0]];
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        autoContinue={false}
        ensureStepVisible={ensureFallback}
        steps={fallbackSteps}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(1));

  await act(() => appStateListener?.("inactive"));
  expect(mockTourApi?.canContinue).toBe(true);
  await act(() => scroll.resolve());
  expect(view.getByTestId("phase").props.children).toBe("idle");
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();

  await act(() => mockTourApi!.continueTour());

  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true });
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ lastStep: "home.daily-drop" }),
  );
  listenerSpy.mockRestore();
});

it("adapts an interrupted replay cursor after pending next-fallback visibility", async () => {
  let appStateListener: ((state: "background") => void) | undefined;
  const listenerSpy = jest.spyOn(AppState, "addEventListener").mockImplementation(
    ((_type: string, listener: (state: "background") => void) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    }) as typeof AppState.addEventListener,
  );
  mockOnboarding = {
    data: record({
      status: "completed",
      lastStep: "home.ready",
      completedAt: "2026-07-17T12:30:00.000Z",
    }),
    isPending: false,
    isError: false,
  };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(mockTourApi?.phase).toBe("idle"));
  await act(() => mockTourApi!.replayTour());
  await fireEvent.press(
    await waitFor(() => view.getByLabelText("Continue introduction")),
  );
  await fireEvent.press(view.getByLabelText("Show me around HiMu"));
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const scroll = deferred();
  const ensureFallback = jest.fn(() => scroll.promise);
  const fallbackSteps = [HOME_TOUR_STEPS[1], HOME_TOUR_STEPS[2]];
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        autoContinue={false}
        ensureStepVisible={ensureFallback}
        steps={fallbackSteps}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(1));

  await act(() => appStateListener?.("background"));
  expect(mockTourApi?.canContinue).toBe(true);
  await act(() => scroll.resolve());
  expect(view.getByTestId("phase").props.children).toBe("idle");
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();

  await act(() => mockTourApi!.continueTour());

  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true });
  expect(mockMutateAsync).not.toHaveBeenCalled();
  listenerSpy.mockRestore();
});

it("retires a first-run replacement safely when fallback visibility rejects", async () => {
  mockOnboarding = { data: record(), isPending: false, isError: false };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const ensureFallback = jest
    .fn<Promise<void>, [string]>()
    .mockRejectedValueOnce(new Error("scroll failed"))
    .mockResolvedValue(undefined);
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        autoContinue={false}
        ensureStepVisible={ensureFallback}
        steps={[HOME_TOUR_STEPS[0]]}
      />
    </AppTourProvider>,
  );

  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("idle"),
  );
  expect(mockTourApi?.canContinue).toBe(true);
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();
  expect(mockMutateAsync).not.toHaveBeenCalled();

  await act(() => mockTourApi!.continueTour());

  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true });
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ lastStep: "home.daily-drop" }),
  );
});

it("retires a replay replacement safely when fallback visibility rejects", async () => {
  mockOnboarding = {
    data: record({
      status: "completed",
      lastStep: "home.ready",
      completedAt: "2026-07-17T12:30:00.000Z",
    }),
    isPending: false,
    isError: false,
  };
  const view = await render(
    <AppTourProvider>
      <HomeRegistration
        ensureStepVisible={async () => undefined}
        steps={HOME_TOUR_STEPS}
      />
    </AppTourProvider>,
  );
  await waitFor(() => expect(mockTourApi?.phase).toBe("idle"));
  await act(() => mockTourApi!.replayTour());
  await fireEvent.press(
    await waitFor(() => view.getByLabelText("Continue introduction")),
  );
  await fireEvent.press(view.getByLabelText("Show me around HiMu"));
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  mockMutateAsync.mockClear();

  const ensureFallback = jest
    .fn<Promise<void>, [string]>()
    .mockRejectedValueOnce(new Error("scroll failed"))
    .mockResolvedValue(undefined);
  await view.rerender(
    <AppTourProvider>
      <HomeRegistration
        autoContinue={false}
        ensureStepVisible={ensureFallback}
        steps={[HOME_TOUR_STEPS[1], HOME_TOUR_STEPS[2]]}
      />
    </AppTourProvider>,
  );

  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("idle"),
  );
  expect(mockTourApi?.canContinue).toBe(true);
  expect(view.queryByTestId("mock-tour-overlay")).toBeNull();
  expect(mockMutateAsync).not.toHaveBeenCalled();

  await act(() => mockTourApi!.continueTour());

  await waitFor(() => expect(ensureFallback).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(view.getByTestId("phase").props.children).toBe("home_spotlights"),
  );
  expect(mockEngineProps).toMatchObject({ currentIndex: 0, ready: true });
  expect(mockMutateAsync).not.toHaveBeenCalled();
});
