import type { ContextualTipId, OnboardingRecord } from "./types";
import { HOME_TOUR_STEPS } from "./constants";
import { nextUpdatedAt } from "./timestamps";

export const WELCOME_STEP_IDS = ["welcome.intro", "welcome.djs"] as const;
export const COMPLETION_STEP_ID = "home.ready" as const;

export type WelcomeStepId = (typeof WELCOME_STEP_IDS)[number];
type HomeTourStepId = (typeof HOME_TOUR_STEPS)[number]["id"];

export type OnboardingPhase =
  | "resolving"
  | "idle"
  | "welcome"
  | "home_spotlights"
  | "completion_prompt"
  | "contextual_tip";

export type OnboardingEvent =
  | { type: "ELIGIBILITY_RESOLVED"; record: OnboardingRecord | null }
  | { type: "HOME_READY"; at: string; stepIds?: readonly string[] }
  | { type: "WELCOME_CONTINUED"; at: string }
  | { type: "WELCOME_BACK"; at: string }
  | { type: "STEP_ADVANCED"; stepId: string; index: number; at: string }
  | { type: "SPOTLIGHTS_FINISHED"; at: string }
  | { type: "SKIPPED"; at: string }
  | { type: "CONTINUE_REQUESTED"; at?: string }
  | { type: "REPLAY_REQUESTED"; at: string }
  | { type: "COMPLETED"; at: string; played: boolean }
  | { type: "CONTEXT_TARGET_READY"; tipId: ContextualTipId }
  | { type: "CONTEXT_TARGET_UNAVAILABLE"; tipId: ContextualTipId }
  | {
      type: "CONTEXT_TIP_DISMISSED";
      tipId: ContextualTipId;
      at: string;
    }
  | { type: "INTERRUPTED" }
  | { type: "ROUTE_CHANGED"; route: string };

export type OnboardingEffect =
  | { type: "PERSIST"; record: OnboardingRecord }
  | { type: "MARK_SESSION_TIP"; tipId: ContextualTipId }
  | { type: "HAPTIC_COMPLETION" };

export type OnboardingState = {
  phase: OnboardingPhase;
  record: OnboardingRecord | null;
  userId: string;
  version: number;
  currentRoute: string;
  homeReady: boolean;
  homeReadyAt: string | null;
  eligibilityResolved: boolean;
  canContinue: boolean;
  replayPending: boolean;
  replayActive: boolean;
  replayCursor: string | null;
  homeStepIds: readonly string[];
  activeTipId: ContextualTipId | null;
  activeWelcomeStepId: WelcomeStepId | null;
  activeStepIndex: number | null;
  sessionTipIds: readonly ContextualTipId[];
};

export type OnboardingTransition = {
  state: OnboardingState;
  effects: OnboardingEffect[];
};

export function createOnboardingState(input: {
  userId: string;
  version: number;
  currentRoute: string;
  sessionTipIds?: readonly ContextualTipId[];
}): OnboardingState {
  return {
    phase: "resolving",
    record: null,
    userId: input.userId,
    version: input.version,
    currentRoute: input.currentRoute,
    homeReady: false,
    homeReadyAt: null,
    eligibilityResolved: false,
    canContinue: false,
    replayPending: false,
    replayActive: false,
    replayCursor: null,
    homeStepIds: HOME_TOUR_STEPS.map((step) => step.id),
    activeTipId: null,
    activeWelcomeStepId: null,
    activeStepIndex: null,
    sessionTipIds: input.sessionTipIds ?? [],
  };
}

export function reduceOnboarding(
  state: OnboardingState,
  event: OnboardingEvent,
): OnboardingTransition {
  if (event.type === "ROUTE_CHANGED") {
    const staysHome = event.route === "home";
    const routedState = {
      ...state,
      currentRoute: event.route,
      homeReady: staysHome && state.homeReady,
      homeReadyAt: staysHome ? state.homeReadyAt : null,
    };
    if (!staysHome && isGuidedPhase(state.phase)) {
      return unchanged(toIdle(routedState));
    }
    if (
      state.phase === "contextual_tip" &&
      state.activeTipId !== null &&
      !routeMatchesTip(event.route, state.activeTipId)
    ) {
      return unchanged(toIdle(routedState));
    }
    return unchanged(routedState);
  }

  if (event.type === "HOME_READY") {
    const homeStepIds = event.stepIds ?? state.homeStepIds;
    if (
      state.currentRoute === "home" &&
      state.homeReady &&
      sameSteps(state.homeStepIds, homeStepIds)
    ) {
      return unchanged(state);
    }
    const readyState = {
      ...state,
      currentRoute: "home",
      homeReady: true,
      homeReadyAt: event.at,
      homeStepIds: [...homeStepIds],
    };
    if (!state.eligibilityResolved) return unchanged(readyState);
    if (state.replayPending) {
      return unchanged(startReplay({ ...readyState, replayPending: false }));
    }
    if (isGuidedPhase(state.phase)) {
      if (state.phase !== "home_spotlights") {
        return unchanged(readyState);
      }
      const activeStepId = state.activeStepIndex === null
        ? null
        : state.homeStepIds[state.activeStepIndex] ?? null;
      const nextIndex = activeStepId === null
        ? null
        : homeStepIndex(homeStepIds, activeStepId);
      if (nextIndex !== null) {
        return unchanged({ ...readyState, activeStepIndex: nextIndex });
      }
      if (activeStepId !== null) {
        const fallbackIndex = nearestAvailableHomeStepIndex(
          homeStepIds,
          activeStepId,
        );
        const fallbackStepId = fallbackIndex === null
          ? COMPLETION_STEP_ID
          : homeStepIds[fallbackIndex];
        if (state.replayActive) {
          return unchanged(
            fallbackIndex === null
              ? withPhase(
                  { ...readyState, replayCursor: COMPLETION_STEP_ID },
                  "completion_prompt",
                )
              : enterHomeSpotlights(
                  { ...readyState, replayCursor: fallbackStepId },
                  fallbackIndex,
                ),
          );
        }
        if (state.record !== null) {
          const nextRecord = cursorRecord(state.record, fallbackStepId, event.at);
          return persist(
            fallbackIndex === null
              ? withPhase(
                  { ...readyState, record: nextRecord },
                  "completion_prompt",
                )
              : enterHomeSpotlights(
                  { ...readyState, record: nextRecord },
                  fallbackIndex,
                ),
            nextRecord,
          );
        }
      }
    }
    if (state.record !== null) return unchanged(toIdle(readyState));
    return startFirstRun(readyState, event.at);
  }

  if (event.type === "ELIGIBILITY_RESOLVED") {
    if (state.eligibilityResolved) {
      if (
        event.record !== null &&
        state.phase === "idle" &&
        !state.replayActive &&
        state.record !== event.record
      ) {
        return unchanged(toIdle({ ...state, record: event.record }));
      }
      return unchanged(state);
    }
    const resolved = {
      ...state,
      eligibilityResolved: true,
      record: event.record,
    };
    if (event.record === null && state.homeReadyAt !== null) {
      return startFirstRun(resolved, state.homeReadyAt);
    }
    return unchanged(toIdle(resolved));
  }

  if (!state.eligibilityResolved) return unchanged(state);

  switch (event.type) {
    case "WELCOME_BACK": {
      if (
        state.phase !== "welcome" ||
        state.activeWelcomeStepId !== "welcome.djs" ||
        state.record === null
      ) {
        return unchanged(state);
      }
      if (state.replayActive) {
        return unchanged(enterWelcome(
          { ...state, replayCursor: "welcome.intro" },
          "welcome.intro",
        ));
      }
      const nextRecord = cursorRecord(state.record, "welcome.intro", event.at);
      return persist(
        enterWelcome({ ...state, record: nextRecord }, "welcome.intro"),
        nextRecord,
      );
    }

    case "WELCOME_CONTINUED":
      if (state.phase !== "welcome" || state.record === null) {
        return unchanged(state);
      }
      if (state.activeWelcomeStepId === "welcome.intro") {
        if (state.replayActive) {
          return unchanged(enterWelcome(
            { ...state, replayCursor: "welcome.djs" },
            "welcome.djs",
          ));
        }
        const nextRecord = cursorRecord(state.record, "welcome.djs", event.at);
        return persist(
          enterWelcome({ ...state, record: nextRecord }, "welcome.djs"),
          nextRecord,
        );
      }
      if (state.activeWelcomeStepId === "welcome.djs") {
        const firstStepId = state.homeStepIds[0] ?? null;
        if (state.replayActive) {
          return unchanged(firstStepId === null
            ? withPhase(
                { ...state, replayCursor: COMPLETION_STEP_ID },
                "completion_prompt",
              )
            : enterHomeSpotlights(
                { ...state, replayCursor: firstStepId },
                0,
              ));
        }
        if (firstStepId === null) {
          const completedCursor = cursorRecord(
            state.record,
            COMPLETION_STEP_ID,
            event.at,
          );
          return persist(
            withPhase({ ...state, record: completedCursor }, "completion_prompt"),
            completedCursor,
          );
        }
        const nextRecord = cursorRecord(
          state.record,
          firstStepId,
          event.at,
        );
        return persist(
          enterHomeSpotlights({ ...state, record: nextRecord }, 0),
          nextRecord,
        );
      }
      return unchanged(state);

    case "STEP_ADVANCED": {
      if (
        state.phase !== "home_spotlights" ||
        state.record === null ||
        !isExactHomeStep(state.homeStepIds, event.stepId, event.index)
      ) {
        return unchanged(state);
      }
      if (state.replayActive) {
        return unchanged({
          ...state,
          replayCursor: event.stepId,
          activeStepIndex: event.index,
        });
      }
      const nextRecord = cursorRecord(state.record, event.stepId, event.at);
      const nextState = {
        ...state,
        record: nextRecord,
        activeStepIndex: event.index,
      };
      return persist(nextState, nextRecord);
    }

    case "SPOTLIGHTS_FINISHED": {
      if (state.phase !== "home_spotlights" || state.record === null) {
        return unchanged(state);
      }
      if (state.replayActive) {
        return unchanged(withPhase(
          { ...state, replayCursor: COMPLETION_STEP_ID },
          "completion_prompt",
        ));
      }
      const nextRecord = cursorRecord(
        state.record,
        COMPLETION_STEP_ID,
        event.at,
      );
      return persist(
        withPhase({ ...state, record: nextRecord }, "completion_prompt"),
        nextRecord,
      );
    }

    case "SKIPPED": {
      if (state.record === null || !isGuidedPhase(state.phase)) {
        return unchanged(state);
      }
      if (state.replayActive) {
        return unchanged(toIdle({
          ...state,
          replayActive: false,
          replayCursor: null,
          replayPending: false,
        }));
      }
      if (state.record.status !== "in_progress") {
        return unchanged(toIdle({ ...state, replayPending: false }));
      }
      const nextRecord: OnboardingRecord = {
        ...state.record,
        status: "skipped",
        completedAt: null,
        skippedAt: event.at,
        updatedAt: event.at,
      };
      return persist(toIdle({ ...state, record: nextRecord }), nextRecord);
    }

    case "CONTINUE_REQUESTED": {
      if (state.phase !== "idle" || !state.homeReady) return unchanged(state);
      if (state.replayActive) return unchanged(resumeReplay(state));
      if (state.record?.status !== "in_progress") return unchanged(state);
      const resumed = resumeFromLastStep(state);
      const lastStep = state.record.lastStep;
      const removedHomeCursor =
        lastStep !== null &&
        HOME_TOUR_STEPS.some((step) => step.id === lastStep) &&
        homeStepIndex(state.homeStepIds, lastStep) === null;
      if (!removedHomeCursor) return unchanged(resumed);
      const adaptedCursor =
        resumed.phase === "completion_prompt"
          ? COMPLETION_STEP_ID
          : resumed.phase === "home_spotlights" &&
              resumed.activeStepIndex !== null
            ? state.homeStepIds[resumed.activeStepIndex] ?? null
            : null;
      if (adaptedCursor === null) return unchanged(resumed);
      const nextRecord = cursorRecord(
        state.record,
        adaptedCursor,
        event.at ?? state.record.updatedAt,
      );
      return persist({ ...resumed, record: nextRecord }, nextRecord);
    }

    case "REPLAY_REQUESTED": {
      if (
        state.phase !== "idle" ||
        state.record === null ||
        state.record.status === "in_progress" ||
        state.replayPending
      ) {
        return unchanged(state);
      }
      const nextRecord: OnboardingRecord = {
        ...state.record,
        replayCount: state.record.replayCount + 1,
        lastReplayedAt: event.at,
      };
      const replayState = {
        ...state,
        record: nextRecord,
        replayPending: !state.homeReady,
        replayActive: true,
        replayCursor: "welcome.intro",
      };
      return persist(
        state.homeReady
          ? startReplay(replayState)
          : toIdle(replayState),
        nextRecord,
      );
    }

    case "COMPLETED": {
      if (state.phase !== "completion_prompt" || state.record === null) {
        return unchanged(state);
      }
      if (state.replayActive) {
        return {
          state: toIdle({
            ...state,
            replayActive: false,
            replayCursor: null,
          }),
          effects: [{ type: "HAPTIC_COMPLETION" }],
        };
      }
      const nextRecord: OnboardingRecord = {
        ...state.record,
        status: "completed",
        completedAt: state.record.completedAt ?? event.at,
        skippedAt: null,
        firstPlayAt:
          event.played && state.record.firstPlayAt === null
            ? event.at
            : state.record.firstPlayAt,
        updatedAt: event.at,
      };
      return {
        state: toIdle({ ...state, record: nextRecord }),
        effects: [
          { type: "PERSIST", record: nextRecord },
          { type: "HAPTIC_COMPLETION" },
        ],
      };
    }

    case "CONTEXT_TARGET_READY": {
      if (!canShowTip(state, event.tipId)) return unchanged(state);
      return {
        state: {
          ...withPhase(state, "contextual_tip"),
          activeTipId: event.tipId,
          sessionTipIds: [...state.sessionTipIds, event.tipId],
        },
        effects: [{ type: "MARK_SESSION_TIP", tipId: event.tipId }],
      };
    }

    case "CONTEXT_TIP_DISMISSED": {
      if (
        state.phase !== "contextual_tip" ||
        state.activeTipId !== event.tipId ||
        state.record?.status !== "completed"
      ) {
        return unchanged(state);
      }
      const nextRecord: OnboardingRecord = {
        ...state.record,
        contextualTips: {
          ...state.record.contextualTips,
          [event.tipId]: event.at,
        },
        updatedAt: event.at,
      };
      return persist(toIdle({ ...state, record: nextRecord }), nextRecord);
    }

    case "CONTEXT_TARGET_UNAVAILABLE":
      return state.phase === "contextual_tip" &&
        state.activeTipId === event.tipId
        ? unchanged(toIdle(state))
        : unchanged(state);

    case "INTERRUPTED":
      return isGuidedPhase(state.phase) || state.phase === "contextual_tip"
        ? unchanged(toIdle(state))
        : unchanged(state);
  }
}

function unchanged(state: OnboardingState): OnboardingTransition {
  return { state, effects: [] };
}

function persist(
  state: OnboardingState,
  record: OnboardingRecord,
): OnboardingTransition {
  return { state, effects: [{ type: "PERSIST", record }] };
}

function cursorRecord(
  record: OnboardingRecord,
  lastStep: string,
  at: string,
): OnboardingRecord {
  return {
    ...record,
    lastStep,
    updatedAt: nextUpdatedAt(record.updatedAt, at),
  };
}

function withPhase(
  state: OnboardingState,
  phase: OnboardingPhase,
): OnboardingState {
  return {
    ...state,
    phase,
    canContinue:
      phase === "idle" &&
      (state.record?.status === "in_progress" || state.replayActive),
    activeTipId: phase === "contextual_tip" ? state.activeTipId : null,
    activeWelcomeStepId:
      phase === "welcome" ? state.activeWelcomeStepId : null,
    activeStepIndex:
      phase === "home_spotlights" ? state.activeStepIndex : null,
  };
}

function toIdle(state: OnboardingState): OnboardingState {
  return withPhase(state, "idle");
}

function startFirstRun(
  state: OnboardingState,
  at: string,
): OnboardingTransition {
  const nextRecord: OnboardingRecord = {
    userId: state.userId,
    version: state.version,
    status: "in_progress",
    lastStep: "welcome.intro",
    startedAt: at,
    completedAt: null,
    skippedAt: null,
    firstPlayAt: null,
    contextualTips: {},
    replayCount: 0,
    lastReplayedAt: null,
    updatedAt: at,
  };
  return persist(
    enterWelcome({ ...state, record: nextRecord }, "welcome.intro"),
    nextRecord,
  );
}

function enterWelcome(
  state: OnboardingState,
  stepId: WelcomeStepId,
): OnboardingState {
  return withPhase({ ...state, activeWelcomeStepId: stepId }, "welcome");
}

function enterHomeSpotlights(
  state: OnboardingState,
  index: number,
): OnboardingState {
  return withPhase({ ...state, activeStepIndex: index }, "home_spotlights");
}

function startReplay(state: OnboardingState): OnboardingState {
  return enterWelcome(
    {
      ...state,
      replayPending: false,
      replayActive: true,
      replayCursor: "welcome.intro",
      activeStepIndex: null,
    },
    "welcome.intro",
  );
}

function resumeFromLastStep(state: OnboardingState): OnboardingState {
  const lastStep = state.record?.lastStep ?? null;
  if (lastStep === null) return enterWelcome(state, "welcome.intro");
  if (lastStep === "welcome.intro") return enterWelcome(state, "welcome.intro");
  if (lastStep === "welcome.djs") return enterWelcome(state, "welcome.djs");
  if (lastStep === COMPLETION_STEP_ID) {
    return withPhase(state, "completion_prompt");
  }
  const index = homeStepIndex(state.homeStepIds, lastStep);
  if (index !== null) return enterHomeSpotlights(state, index);
  const persistedOrder = HOME_TOUR_STEPS.findIndex((step) => step.id === lastStep);
  if (persistedOrder === -1) return enterWelcome(state, "welcome.intro");
  const nextAvailableIndex = nearestAvailableHomeStepIndex(
    state.homeStepIds,
    lastStep,
  );
  return nextAvailableIndex === null
    ? withPhase(state, "completion_prompt")
    : enterHomeSpotlights(state, nextAvailableIndex);
}

function resumeReplay(state: OnboardingState): OnboardingState {
  const cursor = state.replayCursor;
  if (cursor === "welcome.djs") return enterWelcome(state, "welcome.djs");
  if (cursor === COMPLETION_STEP_ID) return withPhase(state, "completion_prompt");
  const index = cursor === null ? null : homeStepIndex(state.homeStepIds, cursor);
  if (index !== null) return enterHomeSpotlights(state, index);
  const knownHomeCursor =
    cursor !== null && HOME_TOUR_STEPS.some((step) => step.id === cursor);
  if (knownHomeCursor) {
    const fallbackIndex = nearestAvailableHomeStepIndex(
      state.homeStepIds,
      cursor,
    );
    return fallbackIndex === null
      ? withPhase(
          { ...state, replayCursor: COMPLETION_STEP_ID },
          "completion_prompt",
        )
      : enterHomeSpotlights(
          { ...state, replayCursor: state.homeStepIds[fallbackIndex] },
          fallbackIndex,
        );
  }
  return enterWelcome(
    { ...state, replayCursor: "welcome.intro" },
    "welcome.intro",
  );
}

function homeStepIndex(stepIds: readonly string[], stepId: string): number | null {
  const index = stepIds.findIndex((candidate) => candidate === stepId);
  return index === -1 ? null : index;
}

export function nearestAvailableHomeStepIndex(
  stepIds: readonly string[],
  removedStepId: string,
): number | null {
  const removedOrder = HOME_TOUR_STEPS.findIndex(
    (step) => step.id === removedStepId,
  );
  let next: { index: number; order: number } | null = null;
  let previous: { index: number; order: number } | null = null;

  for (const [index, stepId] of stepIds.entries()) {
    const order = HOME_TOUR_STEPS.findIndex((step) => step.id === stepId);
    if (order === -1) continue;
    if (order > removedOrder && (next === null || order < next.order)) {
      next = { index, order };
    }
    if (
      order < removedOrder &&
      (previous === null || order > previous.order)
    ) {
      previous = { index, order };
    }
  }

  return next?.index ?? previous?.index ?? null;
}

function isExactHomeStep(
  stepIds: readonly string[],
  stepId: string,
  index: number,
): boolean {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < stepIds.length &&
    stepIds[index] === (stepId as HomeTourStepId)
  );
}

function sameSteps(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((step, index) => step === right[index]);
}

function isGuidedPhase(phase: OnboardingPhase): boolean {
  return (
    phase === "welcome" ||
    phase === "home_spotlights" ||
    phase === "completion_prompt"
  );
}

function routeMatchesTip(route: string, tipId: ContextualTipId): boolean {
  if (tipId === "discover.search") {
    return route === "discover" || route.endsWith("/discover");
  }
  return (
    route === "dj" ||
    route.startsWith("dj/") ||
    route.includes("/dj/")
  );
}

function canShowTip(
  state: OnboardingState,
  tipId: ContextualTipId,
): boolean {
  return (
    state.phase === "idle" &&
    state.record?.status === "completed" &&
    state.record.contextualTips[tipId] === undefined &&
    state.sessionTipIds.length === 0 &&
    routeMatchesTip(state.currentRoute, tipId)
  );
}
