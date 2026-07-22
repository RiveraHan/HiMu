import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useEffect, useRef } from "react";
import { AppState, Text } from "react-native";

import { AppTourProvider, getTourEngineGate } from "../AppTourProvider";
import { CONTEXTUAL_TIP_COPY, HOME_TOUR_STEPS } from "../constants";
import { useAppTour } from "../use-app-tour";

let mockAuth = { isLoading: false, session: null as null | { user: { id: string } } };
let mockOnboarding: { data: any; isPending: boolean; isError: boolean } = { data: null, isPending: false, isError: false };
let mockToast: unknown = null;
let mockConfirm: unknown = null;
let mockSegments = ["(app)"];
const mockMutateAsync = jest.fn(async (_record: unknown) => undefined);
const mockHaptic = jest.fn(async () => undefined);
let mockPlayFirstAvailable = jest.fn<Promise<boolean>, []>();
let mockEnsureStepVisible = jest.fn<Promise<void>, [string]>();
let mockTourApi: ReturnType<typeof useAppTour> | null = null;

jest.mock("@/src/stores/auth-store", () => ({
  useAuthStore: (selector: (state: typeof mockAuth) => unknown) => selector(mockAuth),
}));
jest.mock("@/src/stores/toast-store", () => ({
  useToastStore: (selector: (state: { current: unknown }) => unknown) => selector({ current: mockToast }),
}));
jest.mock("@/src/stores/confirm-store", () => ({
  useConfirmStore: (selector: (state: { pending: unknown }) => unknown) => selector({ pending: mockConfirm }),
}));
jest.mock("@/src/hooks/use-onboarding", () => ({
  useOnboarding: () => mockOnboarding,
  useSaveOnboarding: () => ({ mutateAsync: mockMutateAsync }),
}));
jest.mock("expo-router", () => ({ useSegments: () => mockSegments }));
jest.mock("expo-haptics", () => ({
  notificationAsync: () => mockHaptic(),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

function HomeRegistration({
  autoContinue = false,
  hasPlayableCandidate = true,
}: {
  autoContinue?: boolean;
  hasPlayableCandidate?: boolean;
}) {
  const tour = useAppTour();
  mockTourApi = tour;
  const registerHome = tour.registerHome;
  useEffect(() => registerHome({
    ready: true,
    hasPlayableCandidate,
    steps: HOME_TOUR_STEPS,
    ensureStepVisible: mockEnsureStepVisible,
    playFirstAvailable: async () => true,
  }), [hasPlayableCandidate, registerHome]);
  useEffect(() => {
    if (autoContinue && tour.canContinue) tour.continueTour();
  }, [autoContinue, tour]);
  return <Text testID="phase">{tour.phase}</Text>;
}

function InertRegistrationProbe() {
  const tour = useAppTour();
  useEffect(() => tour.registerHome({
    ready: true,
    hasPlayableCandidate: true,
    steps: HOME_TOUR_STEPS,
    ensureStepVisible: async () => undefined,
    playFirstAvailable: async () => true,
  }), [tour]);
  useEffect(() => {
    void tour.finishWithPlayback();
  }, [tour]);
  return <Text testID="inert-phase">{`${tour.phase}:${tour.canContinue}`}</Text>;
}

function ContextRegistration({
  tipId,
}: {
  tipId: "discover.search" | "dj.hero" | null;
}) {
  const tour = useAppTour();
  mockTourApi = tour;
  const registerContextTarget = tour.registerContextTarget;
  useEffect(() => {
    if (tipId === null) return;
    return registerContextTarget({ tipId, targetId: tipId, ready: true });
  }, [tipId, registerContextTarget]);
  return <Text testID="phase">{tour.phase}</Text>;
}

it("keeps the contextual tip copy at the approved route-neutral contract", () => {
  expect(CONTEXTUAL_TIP_COPY).toEqual({
    "discover.search": {
      titleKey: "onboarding.contextual.discoverSearch.title",
      descriptionKey: "onboarding.contextual.discoverSearch.description",
      placement: "bottom",
    },
    "dj.hero": {
      titleKey: "onboarding.contextual.djHero.title",
      descriptionKey: "onboarding.contextual.djHero.description",
      placement: "bottom",
    },
  });
});

it("keeps Home tour definitions semantic without changing stable identity fields", () => {
  expect(HOME_TOUR_STEPS).toEqual([
    {
      id: "home.daily-drop",
      targetId: "home.hero",
      titleKey: "onboarding.home.dailyDrop.title",
      descriptionKey: "onboarding.home.dailyDrop.description",
      placement: "bottom",
    },
    {
      id: "home.djs",
      targetId: "home.djs",
      titleKey: "onboarding.home.djs.title",
      descriptionKey: "onboarding.home.djs.description",
      placement: "top",
    },
    {
      id: "home.discover",
      targetId: "tabs.discover",
      titleKey: "onboarding.home.discover.title",
      descriptionKey: "onboarding.home.discover.description",
      placement: "top",
    },
  ]);
});

function ReplayRegistration() {
  const tour = useAppTour();
  const requested = useRef(false);
  const registerHome = tour.registerHome;
  useEffect(() => registerHome({
    ready: true,
    hasPlayableCandidate: true,
    steps: HOME_TOUR_STEPS,
    ensureStepVisible: async () => undefined,
    playFirstAvailable: async () => true,
  }), [registerHome]);
  useEffect(() => {
    if (tour.phase === "idle" && !requested.current) {
      requested.current = true;
      tour.replayTour();
    }
  }, [tour]);
  return <Text testID="phase">{tour.phase}</Text>;
}

function CompletionRegistration() {
  const tour = useAppTour();
  mockTourApi = tour;
  const registerHome = tour.registerHome;
  useEffect(() => registerHome({
    ready: true,
    hasPlayableCandidate: true,
    steps: HOME_TOUR_STEPS,
    ensureStepVisible: async () => undefined,
    playFirstAvailable: mockPlayFirstAvailable,
  }), [registerHome]);
  useEffect(() => {
    if (tour.canContinue) tour.continueTour();
  }, [tour]);
  return <Text testID="phase">{tour.phase}</Text>;
}

function completedRecord(overrides: Record<string, unknown> = {}) {
  const at = "2026-07-17T12:00:00.000Z";
  return {
    userId: "u1", version: 1, status: "completed", lastStep: "home.ready",
    startedAt: at, completedAt: at, skippedAt: null, firstPlayAt: null,
    contextualTips: {}, replayCount: 0, lastReplayedAt: null, updatedAt: at,
    ...overrides,
  };
}

beforeEach(() => {
  mockAuth = { isLoading: false, session: null };
  mockOnboarding = { data: null, isPending: false, isError: false };
  mockToast = null;
  mockConfirm = null;
  mockSegments = ["(app)"];
  mockMutateAsync.mockClear();
  mockMutateAsync.mockResolvedValue(undefined);
  mockHaptic.mockClear();
  mockPlayFirstAvailable = jest.fn(async () => true);
  mockEnsureStepVisible = jest.fn(async (_stepId: string) => undefined);
  mockTourApi = null;
});

it("renders unauthenticated and resolving children without an overlay", async () => {
  const view = await render(<AppTourProvider><InertRegistrationProbe /></AppTourProvider>);
  expect(view.getByTestId("inert-phase").props.children).toBe("idle:false");
  expect(view.queryByTestId("welcome-surface")).toBeNull();

  mockAuth = { isLoading: true, session: { user: { id: "u1" } } };
  await view.rerender(<AppTourProvider><Text>child</Text></AppTourProvider>);
  expect(view.queryByTestId("welcome-surface")).toBeNull();
});

it("keeps spotlight playback active but drops engine readiness during a collision", () => {
  expect(getTourEngineGate("home_spotlights", true, true)).toEqual({
    active: true,
    ready: false,
  });
  expect(getTourEngineGate("home_spotlights", false, true)).toEqual({
    active: true,
    ready: true,
  });
});

it("opens welcome once only after eligible Home is ready", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);

  await waitFor(() => expect(view.getByTestId("welcome-surface", { includeHiddenElements: true })).toBeTruthy());
  expect(view.getByTestId("app-tour-background", { includeHiddenElements: true }).props.importantForAccessibility)
    .toBe("no-hide-descendants");
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  expect(mockHaptic).not.toHaveBeenCalled();
});

it("ensures the first available Home target is visible before entering spotlights", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await fireEvent.press(await waitFor(() => view.getByLabelText("Continue introduction")));
  await fireEvent.press(view.getByLabelText("Show me around HiMu"));
  await waitFor(() => expect(mockEnsureStepVisible).toHaveBeenCalledWith("home.daily-drop"));
  expect(view.getByTestId("phase", { includeHiddenElements: true }).props.children)
    .toBe("home_spotlights");
});

it("ensures an interrupted spotlight target is visible before Continue resumes it", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: {
      ...completedRecord(),
      status: "in_progress",
      completedAt: null,
      lastStep: "home.djs",
    },
    isPending: false,
    isError: false,
  };
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await waitFor(() => expect(mockTourApi?.canContinue).toBe(true));
  await act(() => mockTourApi?.continueTour());
  await waitFor(() => expect(mockEnsureStepVisible).toHaveBeenCalledWith("home.djs"));
  expect(view.getByTestId("phase", { includeHiddenElements: true }).props.children)
    .toBe("home_spotlights");
});

it.each(["inactive", "background"] as const)(
  "interrupts an active tour on AppState %s and requires explicit Continue",
  async (nextState) => {
    let appStateListener: ((state: typeof nextState) => void) | undefined;
    const listenerSpy = jest.spyOn(AppState, "addEventListener").mockImplementation(
      ((_type: string, listener: (state: typeof nextState) => void) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      }) as typeof AppState.addEventListener,
    );
    mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
    const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
    await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());

    await act(() => appStateListener?.(nextState));
    expect(view.queryByTestId("welcome-surface")).toBeNull();
    expect(mockTourApi?.canContinue).toBe(true);

    await act(() => mockTourApi?.continueTour());
    await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());
    await view.unmount();
    listenerSpy.mockRestore();
  },
);

it("delays automatic welcome while toast or confirmation is active", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockToast = { id: 1 };
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);

  expect(view.queryByTestId("welcome-surface")).toBeNull();
  mockToast = null;
  await act(() => view.rerender(<AppTourProvider><HomeRegistration /></AppTourProvider>));
  await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());
});

it("temporarily hides an active welcome for a toast and resumes it unchanged", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());

  mockToast = { id: 2 };
  await view.rerender(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await waitFor(() => expect(view.queryByTestId("welcome-surface")).toBeNull());
  expect(view.getByTestId("phase", { includeHiddenElements: true }).props.children).toBe("welcome");

  mockToast = null;
  await view.rerender(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
});

it("derives Welcome Back from the machine across a route interruption", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  const view = await render(
    <AppTourProvider><HomeRegistration autoContinue /></AppTourProvider>,
  );
  await fireEvent.press(await waitFor(() => view.getByLabelText("Continue introduction")));
  await waitFor(() => expect(view.getByText("Page 2 of 2")).toBeTruthy());
  await fireEvent.press(view.getByLabelText("Back to introduction page 1"));
  await waitFor(() => expect(view.getByText("Page 1 of 2")).toBeTruthy());

  mockSegments = ["profile"];
  await view.rerender(
    <AppTourProvider><HomeRegistration autoContinue /></AppTourProvider>,
  );
  expect(view.queryByTestId("welcome-surface")).toBeNull();
  mockSegments = ["(app)"];
  await view.rerender(
    <AppTourProvider><HomeRegistration /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("idle"));
  await act(() => mockTourApi!.continueTour());
  await waitFor(() => expect(view.getByText("Page 1 of 2")).toBeTruthy());
});

it("serializes cursor persistence and continues the queue after rejection", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  const order: string[] = [];
  let rejectFirst!: (error: Error) => void;
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());
  mockMutateAsync.mockClear();
  mockMutateAsync.mockImplementation((next: any) => {
    order.push(`start:${next.lastStep}`);
    if (next.lastStep === "welcome.djs") {
      return new Promise((_resolve, reject) => { rejectFirst = reject; });
    }
    return Promise.resolve(undefined);
  });

  await fireEvent.press(view.getByLabelText("Continue introduction"));
  await waitFor(() => expect(view.getByText("Page 2 of 2")).toBeTruthy());
  await fireEvent.press(view.getByLabelText("Back to introduction page 1"));
  expect(order).toEqual(["start:welcome.djs"]);

  rejectFirst(new Error("offline"));
  await waitFor(() => expect(order).toEqual([
    "start:welcome.djs",
    "start:welcome.intro",
  ]));
});

it("drops queued writes with the old authenticated controller", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  const order: string[] = [];
  let resolveFirst!: () => void;
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());
  mockMutateAsync.mockClear();
  mockMutateAsync.mockImplementation((next: any) => {
    order.push(`${next.userId}:${next.lastStep}`);
    if (next.userId === "u1" && next.lastStep === "welcome.djs") {
      return new Promise<undefined>((resolve) => {
        resolveFirst = () => resolve(undefined);
      });
    }
    return Promise.resolve(undefined);
  });

  await fireEvent.press(view.getByLabelText("Continue introduction"));
  await waitFor(() => expect(view.getByText("Page 2 of 2")).toBeTruthy());
  await fireEvent.press(view.getByLabelText("Back to introduction page 1"));
  expect(order).toEqual(["u1:welcome.djs"]);

  mockAuth = { isLoading: false, session: { user: { id: "u2" } } };
  mockOnboarding = { data: null, isPending: false, isError: false };
  await view.rerender(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  await waitFor(() => expect(order).toContain("u2:welcome.intro"));

  await act(async () => {
    resolveFirst();
    await Promise.resolve();
  });
  expect(order).not.toContain("u1:welcome.intro");
});

it("delays automatic welcome while a confirmation is active", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockConfirm = { title: "Confirm" };
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  expect(view.queryByTestId("welcome-surface")).toBeNull();
  expect(view.getByTestId("phase").props.children).toBe("idle");
});

it("fails closed while onboarding eligibility is resolving", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: null, isPending: true, isError: false };
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  expect(view.queryByTestId("welcome-surface")).toBeNull();
  expect(view.getByTestId("phase").props.children).toBe("resolving");
});

it("keeps children mounted when persistence rejects and records dismissal as skipped", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockMutateAsync.mockRejectedValue(new Error("offline"));
  const view = await render(<AppTourProvider><HomeRegistration /></AppTourProvider>);
  const skip = await waitFor(() => view.getByLabelText("Skip introduction", { includeHiddenElements: true }));
  await fireEvent.press(skip);
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
  expect(mockMutateAsync.mock.calls[1][0]).toEqual(expect.objectContaining({ status: "skipped" }));
  expect(view.getByTestId("phase").props.children).toBe("idle");
});

it("shows Finish when Home reports no playable candidate", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: { ...completedRecord(), status: "in_progress", lastStep: "home.ready", completedAt: null },
    isPending: false,
    isError: false,
  };
  const view = await render(
    <AppTourProvider><HomeRegistration autoContinue hasPlayableCandidate={false} /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByLabelText("Finish", { includeHiddenElements: true })).toBeTruthy());
});

it("shows Play today’s drop when Home reports a playable candidate", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: { ...completedRecord(), status: "in_progress", lastStep: "home.ready", completedAt: null },
    isPending: false,
    isError: false,
  };
  const view = await render(
    <AppTourProvider><HomeRegistration autoContinue /></AppTourProvider>,
  );
  await waitFor(() => expect(
    view.getByLabelText("Play today’s drop", { includeHiddenElements: true }),
  ).toBeTruthy());
});

it("opens an eligible DJ registration through the contextual controller", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: completedRecord(), isPending: false, isError: false };
  mockSegments = ["dj", "one"];

  const view = await render(
    <AppTourProvider><ContextRegistration tipId="dj.hero" /></AppTourProvider>,
  );

  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("contextual_tip"));
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("does not open an already-seen DJ registration", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: completedRecord({
      contextualTips: { "dj.hero": "2026-07-17T12:30:00.000Z" },
    }),
    isPending: false,
    isError: false,
  };
  mockSegments = ["dj", "one"];

  const view = await render(
    <AppTourProvider><ContextRegistration tipId="dj.hero" /></AppTourProvider>,
  );

  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("idle"));
  expect(view.queryByTestId("tour-overlay")).toBeNull();
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("dismisses Discover once and suppresses DJ for the rest of the session", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: completedRecord(), isPending: false, isError: false };
  mockSegments = ["(app)", "discover"];
  const view = await render(
    <AppTourProvider><ContextRegistration tipId="discover.search" /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("contextual_tip"));

  await act(() => mockTourApi!.dismissActiveTour());
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("idle"));
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);

  mockSegments = ["dj", "one"];
  await view.rerender(
    <AppTourProvider><ContextRegistration tipId="dj.hero" /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("idle"));
  expect(view.queryByTestId("tour-overlay")).toBeNull();
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
});

it("opening DJ suppresses Discover after the declarative route switch", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: completedRecord(), isPending: false, isError: false };
  mockSegments = ["dj", "one"];
  const view = await render(
    <AppTourProvider><ContextRegistration tipId="dj.hero" /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("contextual_tip"));

  mockSegments = ["(app)", "discover"];
  await view.rerender(
    <AppTourProvider><ContextRegistration tipId="discover.search" /></AppTourProvider>,
  );

  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("idle"));
  expect(view.queryByTestId("tour-overlay")).toBeNull();
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("route loss closes a contextual tip without persisting it as seen", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: completedRecord(), isPending: false, isError: false };
  mockSegments = ["(app)", "discover"];
  const view = await render(
    <AppTourProvider><ContextRegistration tipId="discover.search" /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("contextual_tip"));

  mockSegments = ["(app)", "profile"];
  await view.rerender(
    <AppTourProvider><ContextRegistration tipId="discover.search" /></AppTourProvider>,
  );

  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("idle"));
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("target cleanup closes a contextual tip without persisting it as seen", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: completedRecord(), isPending: false, isError: false };
  mockSegments = ["dj", "one"];
  const view = await render(
    <AppTourProvider><ContextRegistration tipId="dj.hero" /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("contextual_tip"));

  await view.rerender(
    <AppTourProvider><ContextRegistration tipId={null} /></AppTourProvider>,
  );

  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("idle"));
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("persists contextual dismissal without changing completed status to skipped", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: completedRecord(), isPending: false, isError: false };
  mockSegments = ["(app)", "discover"];
  const view = await render(
    <AppTourProvider><ContextRegistration tipId="discover.search" /></AppTourProvider>,
  );
  await waitFor(() => expect(view.getByTestId("phase").props.children).toBe("contextual_tip"));

  await act(() => mockTourApi!.dismissActiveTour());

  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "completed",
      skippedAt: null,
      contextualTips: {
        "discover.search": expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    }),
  ));
  expect(view.getByTestId("phase").props.children).toBe("idle");
});

it("holds a replay request until Home becomes ready, then restarts at welcome", async () => {
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = { data: completedRecord(), isPending: false, isError: false };
  mockSegments = ["profile"];
  const view = await render(<AppTourProvider><ReplayRegistration /></AppTourProvider>);
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ replayCount: 1 }),
  ));
  expect(view.queryByTestId("welcome-surface")).toBeNull();

  mockSegments = ["(app)"];
  await view.rerender(<AppTourProvider><ReplayRegistration /></AppTourProvider>);
  await waitFor(() => expect(view.getByTestId("welcome-surface")).toBeTruthy());
});

it("returns one controller completion flight for duplicate public calls", async () => {
  let resolvePlay!: (played: boolean) => void;
  mockPlayFirstAvailable = jest.fn(() => new Promise<boolean>((resolve) => {
    resolvePlay = resolve;
  }));
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: { ...completedRecord(), status: "in_progress", lastStep: "home.ready", completedAt: null },
    isPending: false,
    isError: false,
  };
  const view = await render(<AppTourProvider><CompletionRegistration /></AppTourProvider>);
  await waitFor(() => expect(view.getByTestId("completion-surface")).toBeTruthy());

  let first!: Promise<void>;
  let second!: Promise<void>;
  await act(() => {
    first = mockTourApi!.finishWithPlayback();
    second = mockTourApi!.finishWithPlayback();
  });
  expect(first).toBe(second);
  expect(mockPlayFirstAvailable).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolvePlay(true);
    await first;
  });
  expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
    status: "completed",
    firstPlayAt: expect.any(String),
  }));
  expect(mockHaptic).toHaveBeenCalledTimes(1);
});

it("keeps the controller completion lock across a sheet collision and records false without firstPlayAt", async () => {
  let resolvePlay!: (played: boolean) => void;
  mockPlayFirstAvailable = jest.fn(() => new Promise<boolean>((resolve) => {
    resolvePlay = resolve;
  }));
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: { ...completedRecord(), status: "in_progress", lastStep: "home.ready", completedAt: null },
    isPending: false,
    isError: false,
  };
  const view = await render(<AppTourProvider><CompletionRegistration /></AppTourProvider>);
  await fireEvent.press(await waitFor(() => view.getByLabelText("Play today’s drop")));
  expect(mockPlayFirstAvailable).toHaveBeenCalledTimes(1);

  mockToast = { id: 44 };
  await view.rerender(<AppTourProvider><CompletionRegistration /></AppTourProvider>);
  expect(view.queryByTestId("completion-surface")).toBeNull();
  mockToast = null;
  await view.rerender(<AppTourProvider><CompletionRegistration /></AppTourProvider>);
  const remounted = await waitFor(() => view.getByLabelText("Play today’s drop"));
  expect(remounted.props.accessibilityState).toEqual({ busy: true, disabled: true });
  await fireEvent.press(remounted);
  expect(mockPlayFirstAvailable).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolvePlay(false);
    await Promise.resolve();
  });
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
    status: "completed",
    firstPlayAt: null,
  })));
  expect(mockHaptic).toHaveBeenCalledTimes(1);
});

it("persists completion when playback throws and treats haptics as best effort", async () => {
  mockPlayFirstAvailable = jest.fn(async () => { throw new Error("audio failed"); });
  mockHaptic.mockRejectedValueOnce(new Error("haptic unavailable"));
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: { ...completedRecord(), status: "in_progress", lastStep: "home.ready", completedAt: null },
    isPending: false,
    isError: false,
  };
  const view = await render(<AppTourProvider><CompletionRegistration /></AppTourProvider>);
  await fireEvent.press(await waitFor(() => view.getByLabelText("Play today’s drop")));
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
    status: "completed",
    firstPlayAt: null,
  })));
  expect(mockHaptic).toHaveBeenCalledTimes(1);
  expect(view.getByTestId("phase").props.children).toBe("idle");
});

it("drops an in-flight completion when the authenticated controller changes", async () => {
  let resolvePlay!: (played: boolean) => void;
  mockPlayFirstAvailable = jest.fn(() => new Promise<boolean>((resolve) => {
    resolvePlay = resolve;
  }));
  mockAuth = { isLoading: false, session: { user: { id: "u1" } } };
  mockOnboarding = {
    data: { ...completedRecord(), status: "in_progress", lastStep: "home.ready", completedAt: null },
    isPending: false,
    isError: false,
  };
  const view = await render(<AppTourProvider><CompletionRegistration /></AppTourProvider>);
  await fireEvent.press(await waitFor(() => view.getByLabelText("Play today’s drop")));
  mockMutateAsync.mockClear();

  mockAuth = { isLoading: false, session: { user: { id: "u2" } } };
  mockOnboarding = { data: null, isPending: false, isError: false };
  await view.rerender(<AppTourProvider><CompletionRegistration /></AppTourProvider>);
  await act(async () => {
    resolvePlay(true);
    await Promise.resolve();
  });

  expect(mockMutateAsync).not.toHaveBeenCalledWith(expect.objectContaining({
    userId: "u1",
    status: "completed",
  }));
  expect(mockHaptic).not.toHaveBeenCalled();
});
