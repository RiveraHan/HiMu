import * as Haptics from "expo-haptics";
import { useSegments } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useOnboarding, useSaveOnboarding } from "@/src/hooks/use-onboarding";
import { useAuthStore } from "@/src/stores/auth-store";
import { useConfirmStore } from "@/src/stores/confirm-store";
import { useToastStore } from "@/src/stores/toast-store";
import { CONTEXTUAL_TIP_COPY, HOME_TOUR_STEPS, ONBOARDING_VERSION } from "./constants";
import { SpotlightTourEngine } from "./engine/SpotlightTourEngine";
import {
  createOnboardingState,
  nearestAvailableHomeStepIndex,
  reduceOnboarding,
  type OnboardingEffect,
  type OnboardingEvent,
  type OnboardingPhase,
  type OnboardingState,
} from "./onboarding-machine";
import { TourCompletionSheet } from "./TourCompletionSheet";
import { TourTooltip } from "./TourTooltip";
import type {
  ContextualTipId,
  OnboardingRecord,
  SpotlightStep,
  SpotlightStepDefinition,
  TourTargetId,
} from "./types";
import {
  AppTourContext,
  type AppTourContextValue,
  type HomeTourRegistration,
} from "./use-app-tour";
import { WelcomeTour } from "./WelcomeTour";

type ContextRegistration = {
  tipId: ContextualTipId;
  targetId: TourTargetId;
  ready: boolean;
};

const INERT_APP_TOUR: AppTourContextValue = {
  phase: "idle",
  registerHome: () => () => undefined,
  registerContextTarget: () => () => undefined,
  continueTour: () => undefined,
  replayTour: () => undefined,
  dismissActiveTour: () => undefined,
  finishWithPlayback: async () => undefined,
  canContinue: false,
};

function routeFromSegments(segments: readonly string[]): string {
  if (segments[0] === "(app)") return segments[1] ?? "home";
  if (segments[0] === "dj" && segments[1]) return `dj/${segments[1]}`;
  return segments.filter((segment) => !segment.startsWith("(")).join("/") || "home";
}

export function getTourEngineGate(
  phase: OnboardingPhase,
  collisionActive: boolean,
  targetReady: boolean,
) {
  const active = phase === "home_spotlights" || phase === "contextual_tip";
  return { active, ready: active && !collisionActive && targetReady };
}

export function AppTourProvider({ children }: { children: ReactNode }) {
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.session?.user ?? null);

  if (isLoading || !user) {
    return <AppTourContext value={INERT_APP_TOUR}>{children}</AppTourContext>;
  }
  return (
    <AuthenticatedAppTourProvider key={`${user.id}:${ONBOARDING_VERSION}`} userId={user.id}>
      {children}
    </AuthenticatedAppTourProvider>
  );
}

function AuthenticatedAppTourProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const { t } = useTranslation();
  const segments = useSegments();
  const route = routeFromSegments(segments as readonly string[]);
  const onboarding = useOnboarding(ONBOARDING_VERSION);
  const { mutateAsync: saveOnboarding } = useSaveOnboarding();
  const toastActive = useToastStore((state) => state.current !== null);
  const confirmActive = useConfirmStore((state) => state.pending !== null);
  const collisionActive = toastActive || confirmActive;
  const collisionRef = useRef(collisionActive);
  const routeRef = useRef(route);
  collisionRef.current = collisionActive;
  routeRef.current = route;
  const homeRef = useRef<HomeTourRegistration | null>(null);
  const contextRefs = useRef(new Map<ContextualTipId, ContextRegistration>());
  const sessionTipsRef = useRef(new Set<ContextualTipId>());
  const stateRef = useRef<OnboardingState>(createOnboardingState({
    userId,
    version: ONBOARDING_VERSION,
    currentRoute: route,
    sessionTipIds: [...sessionTipsRef.current],
  }));
  const [state, setState] = useState(stateRef.current);
  const mountedRef = useRef(true);
  const homeReadinessRequestRef = useRef(0);
  const homeReadyRegistrationRef = useRef<HomeTourRegistration | null>(null);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const completionFlightRef = useRef<Promise<void> | null>(null);
  const [completionRunning, setCompletionRunning] = useState(false);
  const [, setRegistrationRevision] = useState(0);

  useEffect(
    () => () => {
      mountedRef.current = false;
      homeReadinessRequestRef.current += 1;
    },
    [],
  );

  const enqueuePersist = useCallback((record: OnboardingRecord) => {
    const queued = persistQueueRef.current.then(async () => {
      if (!mountedRef.current) return;
      try {
        await saveOnboarding(record);
      } catch {
        // Persistence is best effort; a failed write must not stall later writes.
      }
    });
    persistQueueRef.current = queued;
    return queued;
  }, [saveOnboarding]);

  const runEffects = useCallback((effects: readonly OnboardingEffect[]) => {
    const tasks: Promise<unknown>[] = [];
    for (const effect of effects) {
      if (effect.type === "PERSIST") {
        tasks.push(enqueuePersist(effect.record));
      } else if (effect.type === "MARK_SESSION_TIP") {
        sessionTipsRef.current.add(effect.tipId);
      } else if (effect.type === "HAPTIC_COMPLETION") {
        tasks.push(
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
        );
      }
    }
    return Promise.all(tasks);
  }, [enqueuePersist]);

  const send = useCallback((event: OnboardingEvent) => {
    const transition = reduceOnboarding(stateRef.current, event);
    stateRef.current = transition.state;
    setState(transition.state);
    return runEffects(transition.effects);
  }, [runEffects]);

  const setHomeReadyRegistration = useCallback(
    (registration: HomeTourRegistration | null) => {
      if (homeReadyRegistrationRef.current === registration) return;
      homeReadyRegistrationRef.current = registration;
      if (mountedRef.current) {
        setRegistrationRevision((revision) => revision + 1);
      }
    },
    [],
  );

  const retireHomeReadiness = useCallback(() => {
    homeReadinessRequestRef.current += 1;
    setHomeReadyRegistration(null);
  }, [setHomeReadyRegistration]);

  const announceHomeReady = useCallback(
    (input: HomeTourRegistration) => {
      const request = homeReadinessRequestRef.current + 1;
      homeReadinessRequestRef.current = request;
      setHomeReadyRegistration(null);

      if (
        !mountedRef.current ||
        homeRef.current !== input ||
        !input.ready ||
        collisionRef.current ||
        routeRef.current !== "home"
      ) {
        return;
      }

      const current = stateRef.current;
      const activeStepId =
        current.phase === "home_spotlights" &&
        current.activeStepIndex !== null
          ? current.homeStepIds[current.activeStepIndex] ?? null
          : null;
      const currentStillRegistered =
        activeStepId !== null &&
        input.steps.some((step) => step.id === activeStepId);
      const fallbackIndex =
        activeStepId !== null && !currentStillRegistered
          ? nearestAvailableHomeStepIndex(
              input.steps.map((step) => step.id),
              activeStepId,
            )
          : null;
      const fallbackStep =
        fallbackIndex === null ? null : input.steps[fallbackIndex];

      const canSettleReadiness = () =>
        !(
          request !== homeReadinessRequestRef.current ||
          !mountedRef.current ||
          homeRef.current !== input ||
          !input.ready ||
          collisionRef.current ||
          routeRef.current !== "home"
        );

      const commitHomeReady = () => {
        if (!canSettleReadiness()) return;
        void send({
          type: "HOME_READY",
          at: new Date().toISOString(),
          stepIds: input.steps.map((step) => step.id),
        });
        setHomeReadyRegistration(input);
      };

      const retireAfterVisibilityFailure = () => {
        if (!canSettleReadiness()) return;
        homeReadinessRequestRef.current += 1;
        void send({ type: "INTERRUPTED" });
      };

      if (fallbackStep === null) {
        commitHomeReady();
        return;
      }

      void Promise.resolve()
        .then(() => input.ensureStepVisible(fallbackStep.id))
        .then(commitHomeReady, retireAfterVisibilityFailure);
    },
    [send, setHomeReadyRegistration],
  );

  useEffect(() => {
    if (!onboarding.isPending && !onboarding.isError) {
      void send({ type: "ELIGIBILITY_RESOLVED", record: onboarding.data ?? null });
    }
  }, [onboarding.data, onboarding.isError, onboarding.isPending, send]);

  useEffect(() => {
    void send({ type: "ROUTE_CHANGED", route });
  }, [route, send]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        retireHomeReadiness();
        void send({ type: "INTERRUPTED" });
      }
    });
    return () => subscription?.remove();
  }, [retireHomeReadiness, send]);

  useEffect(() => {
    const registration = homeRef.current;
    if (collisionActive || route !== "home" || !registration?.ready) {
      retireHomeReadiness();
      return;
    }
    announceHomeReady(registration);
  }, [announceHomeReady, collisionActive, retireHomeReadiness, route]);

  useEffect(() => {
    if (collisionActive || state.phase !== "idle") return;
    for (const registration of contextRefs.current.values()) {
      if (registration.ready) {
        void send({ type: "CONTEXT_TARGET_READY", tipId: registration.tipId });
        if (stateRef.current.phase === "contextual_tip") break;
      }
    }
  }, [collisionActive, route, send, state.phase]);

  const registerHome = useCallback((input: HomeTourRegistration) => {
    homeRef.current = input;
    setRegistrationRevision((revision) => revision + 1);
    announceHomeReady(input);
    return () => {
      if (homeRef.current === input) {
        homeRef.current = null;
        homeReadinessRequestRef.current += 1;
        homeReadyRegistrationRef.current = null;
        setRegistrationRevision((revision) => revision + 1);
      }
    };
  }, [announceHomeReady]);

  const registerContextTarget = useCallback((input: ContextRegistration) => {
    contextRefs.current.set(input.tipId, input);
    setRegistrationRevision((revision) => revision + 1);
    if (!collisionRef.current && input.ready) {
      void send({ type: "CONTEXT_TARGET_READY", tipId: input.tipId });
    }
    return () => {
      if (contextRefs.current.get(input.tipId) !== input) return;
      contextRefs.current.delete(input.tipId);
      setRegistrationRevision((revision) => revision + 1);
      void send({ type: "CONTEXT_TARGET_UNAVAILABLE", tipId: input.tipId });
    };
  }, [send]);

  const dismissActiveTour = useCallback(() => {
    const current = stateRef.current;
    if (current.phase === "contextual_tip" && current.activeTipId) {
      void send({
        type: "CONTEXT_TIP_DISMISSED",
        tipId: current.activeTipId,
        at: new Date().toISOString(),
      });
      return;
    }
    void send({ type: "SKIPPED", at: new Date().toISOString() });
  }, [send]);

  const finishWithPlayback = useCallback((): Promise<void> => {
    if (completionFlightRef.current) return completionFlightRef.current;
    if (stateRef.current.phase !== "completion_prompt") return Promise.resolve();

    setCompletionRunning(true);
    const flight = (async () => {
      let played = false;
      if (homeRef.current?.hasPlayableCandidate) {
        try {
          played = (await homeRef.current.playFirstAvailable()) === true;
        } catch {
          played = false;
        }
      }
      if (!mountedRef.current || stateRef.current.phase !== "completion_prompt") return;
      await send({ type: "COMPLETED", at: new Date().toISOString(), played });
    })();
    completionFlightRef.current = flight;
    void flight.then(
      () => {
        if (completionFlightRef.current !== flight) return;
        completionFlightRef.current = null;
        if (mountedRef.current) setCompletionRunning(false);
      },
      () => {
        if (completionFlightRef.current !== flight) return;
        completionFlightRef.current = null;
        if (mountedRef.current) setCompletionRunning(false);
      },
    );
    return flight;
  }, [send]);

  const continueTour = useCallback(() => {
    const current = stateRef.current;
    const registration = homeRef.current;
    const at = new Date().toISOString();
    if (
      current.phase !== "idle" ||
      !current.canContinue ||
      !registration?.ready ||
      collisionRef.current ||
      routeRef.current !== "home"
    ) {
      void send({ type: "CONTINUE_REQUESTED", at });
      return;
    }

    const request = homeReadinessRequestRef.current + 1;
    homeReadinessRequestRef.current = request;
    setHomeReadyRegistration(null);
    const cursor = current.replayActive
      ? current.replayCursor
      : current.record?.lastStep ?? null;
    const stepIds = registration.steps.map((step) => step.id);
    let stepIndex = cursor === null
      ? -1
      : registration.steps.findIndex((step) => step.id === cursor);
    if (
      stepIndex === -1 &&
      cursor !== null &&
      HOME_TOUR_STEPS.some((step) => step.id === cursor)
    ) {
      stepIndex = nearestAvailableHomeStepIndex(stepIds, cursor) ?? -1;
    }
    const step = stepIndex === -1 ? null : registration.steps[stepIndex];

    const commitContinue = () => {
      if (
        request !== homeReadinessRequestRef.current ||
        !mountedRef.current ||
        homeRef.current !== registration ||
        !registration.ready ||
        collisionRef.current ||
        routeRef.current !== "home" ||
        stateRef.current.phase !== "idle" ||
        !stateRef.current.canContinue
      ) {
        return;
      }
      void send({ type: "HOME_READY", at, stepIds });
      void send({ type: "CONTINUE_REQUESTED", at });
      setHomeReadyRegistration(registration);
    };

    if (step === null) {
      commitContinue();
      return;
    }

    void Promise.resolve()
      .then(() => registration.ensureStepVisible(step.id))
      .then(commitContinue, () => undefined);
  }, [send, setHomeReadyRegistration]);
  const replayTour = useCallback(() => {
    void send({ type: "REPLAY_REQUESTED", at: new Date().toISOString() });
  }, [send]);

  const value = useMemo<AppTourContextValue>(() => ({
    phase: state.phase,
    registerHome,
    registerContextTarget,
    continueTour,
    replayTour,
    dismissActiveTour,
    finishWithPlayback,
    canContinue: state.canContinue,
  }), [
    continueTour,
    dismissActiveTour,
    finishWithPlayback,
    registerContextTarget,
    registerHome,
    replayTour,
    state.canContinue,
    state.phase,
  ]);

  const welcomePage = state.activeWelcomeStepId === "welcome.djs" ? 1 : 0;
  const guidedModalActive = !collisionActive &&
    (state.phase === "welcome" || state.phase === "completion_prompt");
  const contextualRegistration = state.activeTipId
    ? contextRefs.current.get(state.activeTipId)
    : undefined;
  const engineDefinitions: readonly SpotlightStepDefinition[] =
    state.phase === "contextual_tip" && contextualRegistration
    ? [{
        id: contextualRegistration.tipId,
        targetId: contextualRegistration.targetId,
        ...CONTEXTUAL_TIP_COPY[contextualRegistration.tipId],
      }]
    : homeRef.current?.steps ?? [];
  const engineSteps: readonly SpotlightStep[] = engineDefinitions.map(
    ({ titleKey, descriptionKey, ...step }) => ({
      ...step,
      title: t(titleKey),
      description: t(descriptionKey),
    }),
  );
  const engineIndex = state.phase === "contextual_tip" ? 0 : state.activeStepIndex ?? 0;
  const engineReady = state.phase === "contextual_tip"
    ? contextualRegistration?.ready === true
    : homeRef.current?.ready === true &&
      homeReadyRegistrationRef.current === homeRef.current;
  const engineGate = getTourEngineGate(state.phase, collisionActive, engineReady);

  const handleWelcomeContinue = () => {
    const current = stateRef.current;
    const firstStep = homeRef.current?.steps[0];
    if (current.activeWelcomeStepId === "welcome.djs" && firstStep) {
      void homeRef.current?.ensureStepVisible(firstStep.id).then(() =>
        send({ type: "WELCOME_CONTINUED", at: new Date().toISOString() }),
      );
      return;
    }
    void send({ type: "WELCOME_CONTINUED", at: new Date().toISOString() });
  };
  const handleWelcomeBack = () => {
    void send({ type: "WELCOME_BACK", at: new Date().toISOString() });
  };
  const handleEngineNext = () => {
    if (state.phase === "contextual_tip") {
      dismissActiveTour();
      return;
    }
    const nextIndex = Math.min(engineIndex + 1, engineSteps.length - 1);
    const next = engineSteps[nextIndex];
    if (next) {
      void (homeRef.current?.ensureStepVisible(next.id) ?? Promise.resolve()).then(() =>
        send({
          type: "STEP_ADVANCED",
          stepId: next.id,
          index: nextIndex,
          at: new Date().toISOString(),
        }),
      );
    }
  };
  const handleEnginePrevious = () => {
    const previousIndex = Math.max(0, engineIndex - 1);
    const previous = engineSteps[previousIndex];
    if (previous) {
      void (homeRef.current?.ensureStepVisible(previous.id) ?? Promise.resolve()).then(() =>
        send({
          type: "STEP_ADVANCED",
          stepId: previous.id,
          index: previousIndex,
          at: new Date().toISOString(),
        }),
      );
    }
  };
  const handleEngineFinish = () => {
    if (state.phase === "contextual_tip") dismissActiveTour();
    else {
      void send({ type: "SPOTLIGHTS_FINISHED", at: new Date().toISOString() });
    }
  };

  return (
    <AppTourContext value={value}>
      <View
        accessibilityElementsHidden={guidedModalActive}
        importantForAccessibility={guidedModalActive ? "no-hide-descendants" : "auto"}
        style={{ flex: 1 }}
        testID="app-tour-background"
      >
        <SpotlightTourEngine
          active={engineGate.active}
          currentIndex={engineIndex}
          onFinishSpotlights={handleEngineFinish}
          onNext={handleEngineNext}
          onPrevious={handleEnginePrevious}
          onSkip={dismissActiveTour}
          ready={engineGate.ready}
          renderTooltip={(props) => <TourTooltip {...props} />}
          steps={engineSteps}
        >
          {children}
        </SpotlightTourEngine>
      </View>
      {!collisionActive && state.phase === "welcome" ? (
        <WelcomeTour
          page={welcomePage}
          onBack={handleWelcomeBack}
          onContinue={handleWelcomeContinue}
          onSkip={dismissActiveTour}
        />
      ) : null}
      {!collisionActive && state.phase === "completion_prompt" ? (
        <TourCompletionSheet
          canPlay={homeRef.current?.hasPlayableCandidate === true}
          onDismiss={dismissActiveTour}
          onComplete={finishWithPlayback}
          running={completionRunning}
        />
      ) : null}
    </AppTourContext>
  );
}
