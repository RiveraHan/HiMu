import {
  createOnboardingState,
  reduceOnboarding,
  type OnboardingEvent,
  type OnboardingState,
} from "../onboarding-machine";
import type { OnboardingRecord } from "../types";
import { nextUpdatedAt } from "../timestamps";

const STARTED_AT = "2026-07-16T10:00:00.000Z";
const LATER = "2026-07-16T11:00:00.000Z";

function record(
  overrides: Partial<OnboardingRecord> = {},
): OnboardingRecord {
  return {
    userId: "user-1",
    version: 1,
    status: "in_progress",
    lastStep: null,
    startedAt: STARTED_AT,
    completedAt: null,
    skippedAt: null,
    firstPlayAt: null,
    contextualTips: {},
    replayCount: 0,
    lastReplayedAt: null,
    updatedAt: STARTED_AT,
    ...overrides,
  };
}

function initial(
  overrides: Partial<Parameters<typeof createOnboardingState>[0]> = {},
): OnboardingState {
  return createOnboardingState({
    userId: "user-1",
    version: 1,
    currentRoute: "home",
    ...overrides,
  });
}

function dispatch(
  state: OnboardingState,
  ...events: OnboardingEvent[]
): ReturnType<typeof reduceOnboarding> {
  let transition = { state, effects: [] } as ReturnType<
    typeof reduceOnboarding
  >;
  for (const event of events) {
    transition = reduceOnboarding(transition.state, event);
  }
  return transition;
}

const ALL_HOME_STEP_IDS = [
  "home.daily-drop",
  "home.djs",
  "home.discover",
] as const;

function firstRunAtHomeStep(index: number): OnboardingState {
  let state = dispatch(
    initial(),
    { type: "ELIGIBILITY_RESOLVED", record: null },
    { type: "HOME_READY", at: STARTED_AT, stepIds: ALL_HOME_STEP_IDS },
    { type: "WELCOME_CONTINUED", at: LATER },
    { type: "WELCOME_CONTINUED", at: LATER },
  ).state;
  if (index > 0) {
    state = reduceOnboarding(state, {
      type: "STEP_ADVANCED",
      stepId: ALL_HOME_STEP_IDS[index],
      index,
      at: LATER,
    }).state;
  }
  return state;
}

function replayAtHomeStep(index: number): OnboardingState {
  let state = dispatch(
    initial(),
    {
      type: "ELIGIBILITY_RESOLVED",
      record: record({
        status: "completed",
        lastStep: "home.ready",
        completedAt: STARTED_AT,
      }),
    },
    { type: "HOME_READY", at: STARTED_AT, stepIds: ALL_HOME_STEP_IDS },
    { type: "REPLAY_REQUESTED", at: LATER },
    { type: "WELCOME_CONTINUED", at: LATER },
    { type: "WELCOME_CONTINUED", at: LATER },
  ).state;
  if (index > 0) {
    state = reduceOnboarding(state, {
      type: "STEP_ADVANCED",
      stepId: ALL_HOME_STEP_IDS[index],
      index,
      at: LATER,
    }).state;
  }
  return state;
}

describe("guided onboarding state machine", () => {
  it("keeps replay cursor and lifecycle entirely outside the historical record", () => {
    const historical = record({
      status: "completed",
      lastStep: "home.djs",
      completedAt: STARTED_AT,
      firstPlayAt: STARTED_AT,
      contextualTips: { "discover.search": STARTED_AT },
      replayCount: 2,
      lastReplayedAt: STARTED_AT,
    });
    let transition = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: historical },
      { type: "HOME_READY", at: LATER, stepIds: ["home.daily-drop"] },
      { type: "REPLAY_REQUESTED", at: LATER },
    );
    const replayStarted = transition.state.record!;
    expect(replayStarted).toEqual({
      ...historical,
      replayCount: 3,
      lastReplayedAt: LATER,
    });

    transition = dispatch(
      transition.state,
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "SPOTLIGHTS_FINISHED", at: LATER },
      { type: "COMPLETED", at: LATER, played: true },
    );
    expect(transition.state.record).toEqual(replayStarted);
    expect(transition.state.replayActive).toBe(false);
    expect(transition.effects).toEqual([{ type: "HAPTIC_COMPLETION" }]);
  });

  it("does not terminally skip or move the historical cursor when replay is dismissed", () => {
    const historical = record({ status: "skipped", skippedAt: STARTED_AT });
    const replay = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: historical },
      { type: "HOME_READY", at: LATER, stepIds: [] },
      { type: "REPLAY_REQUESTED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "SKIPPED", at: LATER },
    );
    expect(replay.state.record).toEqual({
      ...historical,
      replayCount: 1,
      lastReplayedAt: LATER,
    });
    expect(replay.effects).toEqual([]);
  });

  it("uses the available Home step subset and goes from welcome to completion when empty", () => {
    let state = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT, stepIds: ["home.djs", "home.discover"] },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;
    expect(state).toMatchObject({ phase: "home_spotlights", activeStepIndex: 0 });
    expect(state.record?.lastStep).toBe("home.djs");
    state = reduceOnboarding(state, {
      type: "STEP_ADVANCED",
      stepId: "home.discover",
      index: 1,
      at: LATER,
    }).state;
    expect(state.activeStepIndex).toBe(1);

    const empty = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT, stepIds: [] },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    );
    expect(empty.state.phase).toBe("completion_prompt");
    expect(empty.state.record?.lastStep).toBe("home.ready");
  });

  it("resumes at the next available step when the persisted target disappeared", () => {
    const resumed = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: record({ lastStep: "home.daily-drop" }) },
      { type: "HOME_READY", at: LATER, stepIds: ["home.djs", "home.discover"] },
      { type: "CONTINUE_REQUESTED" },
    );
    expect(resumed.state).toMatchObject({
      phase: "home_spotlights",
      activeStepIndex: 0,
    });

    const noTargets = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: record({ lastStep: "home.discover" }) },
      { type: "HOME_READY", at: LATER, stepIds: [] },
      { type: "CONTINUE_REQUESTED" },
    );
    expect(noTargets.state.phase).toBe("completion_prompt");
  });
  it("normalizes injected cursor time and rejects malformed timestamps", () => {
    expect(nextUpdatedAt(
      "2026-07-16T10:00:00.000Z",
      "2026-07-16T05:00:01-05:00",
    )).toBe("2026-07-16T10:00:01.000Z");
    expect(() => nextUpdatedAt(STARTED_AT, "invalid")).toThrow(/timestamp/i);
  });

  it("orders rapid cursor persistence strictly after the previous updatedAt", () => {
    const pageTwo = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: record({
        lastStep: "welcome.djs",
        updatedAt: LATER,
      }) },
      { type: "HOME_READY", at: LATER },
      { type: "CONTINUE_REQUESTED" },
    ).state;

    const backed = reduceOnboarding(pageTwo, { type: "WELCOME_BACK", at: LATER });
    const advanced = reduceOnboarding(backed.state, {
      type: "WELCOME_CONTINUED",
      at: STARTED_AT,
    });

    expect(backed.state.record?.updatedAt).toBe("2026-07-16T11:00:00.001Z");
    expect(advanced.state.record?.updatedAt).toBe("2026-07-16T11:00:00.002Z");
    expect(advanced.state.record?.lastStep).toBe("welcome.djs");
  });

  it("keeps replay request updatedAt unchanged", () => {
    const completed = record({ status: "completed", completedAt: STARTED_AT });
    const resolved = dispatch(initial(), {
      type: "ELIGIBILITY_RESOLVED",
      record: completed,
    }).state;
    const replay = reduceOnboarding(resolved, {
      type: "REPLAY_REQUESTED",
      at: LATER,
    });
    expect(replay.state.record?.updatedAt).toBe(completed.updatedAt);
  });

  it("advances updatedAt for every persisted cursor event with one injected instant", () => {
    const at = STARTED_AT;
    let transition = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at },
    );
    const timestamps = [transition.state.record!.updatedAt];
    for (const event of [
      { type: "WELCOME_CONTINUED", at },
      { type: "WELCOME_CONTINUED", at },
      { type: "STEP_ADVANCED", stepId: "home.djs", index: 1, at },
      { type: "SPOTLIGHTS_FINISHED", at },
    ] as const) {
      transition = reduceOnboarding(transition.state, event);
      timestamps.push(transition.state.record!.updatedAt);
    }
    expect(timestamps).toEqual([
      "2026-07-16T10:00:00.000Z",
      "2026-07-16T10:00:00.001Z",
      "2026-07-16T10:00:00.002Z",
      "2026-07-16T10:00:00.003Z",
      "2026-07-16T10:00:00.004Z",
    ]);
  });

  it("moves Welcome Back into reducer state and resumes page one after a route interruption", () => {
    const pageTwo = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;

    const backed = reduceOnboarding(pageTwo, { type: "WELCOME_BACK", at: LATER });
    expect(backed.state).toMatchObject({
      phase: "welcome",
      activeWelcomeStepId: "welcome.intro",
      record: { lastStep: "welcome.intro" },
    });
    expect(backed.effects).toEqual([{ type: "PERSIST", record: backed.state.record }]);

    const resumed = dispatch(
      backed.state,
      { type: "ROUTE_CHANGED", route: "profile" },
      { type: "ROUTE_CHANGED", route: "home" },
      { type: "HOME_READY", at: LATER },
      { type: "CONTINUE_REQUESTED" },
    );
    expect(resumed.state).toMatchObject({
      phase: "welcome",
      activeWelcomeStepId: "welcome.intro",
    });

    const rehydrated = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: backed.state.record },
      { type: "HOME_READY", at: LATER },
      { type: "CONTINUE_REQUESTED" },
    );
    expect(rehydrated.state).toMatchObject({
      phase: "welcome",
      activeWelcomeStepId: "welcome.intro",
    });
  });

  it("moves a replay Welcome Back without erasing completion", () => {
    const completed = record({ status: "completed", completedAt: STARTED_AT });
    const pageTwo = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: completed },
      { type: "HOME_READY", at: STARTED_AT },
      { type: "REPLAY_REQUESTED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;

    const backed = reduceOnboarding(pageTwo, { type: "WELCOME_BACK", at: LATER });
    expect(backed.state).toMatchObject({
      phase: "welcome",
      activeWelcomeStepId: "welcome.intro",
      record: { status: "completed", completedAt: STARTED_AT, lastStep: null },
    });
  });

  it("fails closed while eligibility is unresolved", () => {
    const state = initial();

    const transition = dispatch(
      state,
      { type: "HOME_READY", at: STARTED_AT },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    );

    expect(transition.state).toMatchObject({
      phase: "resolving",
      record: null,
      canContinue: false,
    });
    expect(transition.effects).toEqual([]);
  });

  it("adopts a background-reconciled terminal record while idle", () => {
    const local = record({ lastStep: "home.djs" });
    const server = record({
      status: "completed",
      completedAt: LATER,
      lastStep: "home.ready",
      updatedAt: LATER,
    });
    const resolved = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: local },
      { type: "HOME_READY", at: LATER },
    ).state;
    expect(resolved.canContinue).toBe(true);

    const refreshed = reduceOnboarding(resolved, {
      type: "ELIGIBILITY_RESOLVED",
      record: server,
    });
    expect(refreshed.state.record).toEqual(server);
    expect(refreshed.state.canContinue).toBe(false);
  });

  it("opens welcome for a known eligible user only when Home is ready", () => {
    const resolved = reduceOnboarding(initial(), {
      type: "ELIGIBILITY_RESOLVED",
      record: null,
    });

    expect(resolved.state.phase).toBe("idle");
    expect(resolved.effects).toEqual([]);

    const ready = reduceOnboarding(resolved.state, {
      type: "HOME_READY",
      at: STARTED_AT,
    });

    expect(ready.state.phase).toBe("welcome");
    expect(ready.state.record).toEqual(record({ lastStep: "welcome.intro" }));
    expect(ready.effects).toEqual([
      { type: "PERSIST", record: record({ lastStep: "welcome.intro" }) },
    ]);
  });

  it("persists the current step on every advance", () => {
    const started = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;

    const first = reduceOnboarding(started, {
      type: "STEP_ADVANCED",
      stepId: "home.daily-drop",
      index: 0,
      at: LATER,
    });
    const second = reduceOnboarding(first.state, {
      type: "STEP_ADVANCED",
      stepId: "home.djs",
      index: 1,
      at: LATER,
    });

    expect(first.state.record?.lastStep).toBe("home.daily-drop");
    expect(first.effects).toEqual([
      { type: "PERSIST", record: first.state.record },
    ]);
    expect(second.state.record?.lastStep).toBe("home.djs");
    expect(second.state.activeStepIndex).toBe(1);
    expect(second.effects).toEqual([
      { type: "PERSIST", record: second.state.record },
    ]);
  });

  it("turns welcome skip and interruption dismissal into skipped", () => {
    const welcome = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
    ).state;
    const skippedFromWelcome = reduceOnboarding(welcome, {
      type: "SKIPPED",
      at: LATER,
    });

    const spotlights = dispatch(welcome, {
      type: "WELCOME_CONTINUED",
      at: LATER,
    }, {
      type: "WELCOME_CONTINUED",
      at: LATER,
    }).state;
    const skippedFromSpotlights = reduceOnboarding(spotlights, {
      type: "SKIPPED",
      at: LATER,
    });

    for (const transition of [skippedFromWelcome, skippedFromSpotlights]) {
      expect(transition.state).toMatchObject({ phase: "idle" });
      expect(transition.state.record).toMatchObject({
        status: "skipped",
        skippedAt: LATER,
        completedAt: null,
        updatedAt: LATER,
      });
      expect(transition.effects).toEqual([
        { type: "PERSIST", record: transition.state.record },
      ]);
    }
  });

  it("keeps an interrupted in-progress tour idle until Continue is pressed", () => {
    const inProgress = record({ lastStep: "home.daily-drop" });
    const resolved = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: inProgress },
      { type: "HOME_READY", at: LATER },
    );

    expect(resolved.state).toMatchObject({
      phase: "idle",
      canContinue: true,
    });

    const continued = reduceOnboarding(resolved.state, {
      type: "CONTINUE_REQUESTED",
    });
    expect(continued.state.phase).toBe("home_spotlights");

    const interrupted = reduceOnboarding(continued.state, {
      type: "INTERRUPTED",
    });
    expect(interrupted.state).toMatchObject({
      phase: "idle",
      record: inProgress,
      canContinue: true,
    });
    expect(interrupted.effects).toEqual([]);
  });

  it("replays without erasing prior completion or tip history", () => {
    const completed = record({
      status: "completed",
      completedAt: STARTED_AT,
      firstPlayAt: STARTED_AT,
      contextualTips: { "discover.search": STARTED_AT },
      updatedAt: STARTED_AT,
    });
    const resolved = dispatch(initial({ currentRoute: "profile" }), {
      type: "ELIGIBILITY_RESOLVED",
      record: completed,
    }).state;

    const requested = reduceOnboarding(resolved, {
      type: "REPLAY_REQUESTED",
      at: LATER,
    });

    expect(requested.state.phase).toBe("idle");
    expect(requested.state.replayPending).toBe(true);
    expect(requested.state.record).toEqual({
      ...completed,
      replayCount: 1,
      lastReplayedAt: LATER,
    });
    expect(requested.effects).toEqual([
      { type: "PERSIST", record: requested.state.record },
    ]);

    const ready = reduceOnboarding(requested.state, {
      type: "HOME_READY",
      at: LATER,
    });
    expect(ready.state).toMatchObject({
      phase: "welcome",
      replayPending: false,
      activeWelcomeStepId: "welcome.intro",
      activeStepIndex: null,
    });
    expect(ready.state.record).toMatchObject({
      completedAt: STARTED_AT,
      firstPlayAt: STARTED_AT,
      contextualTips: { "discover.search": STARTED_AT },
    });
  });

  it("allows contextual tips only after completion", () => {
    const inProgress = dispatch(
      initial({ currentRoute: "discover" }),
      { type: "ELIGIBILITY_RESOLVED", record: record() },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    );
    expect(inProgress.state.phase).toBe("idle");
    expect(inProgress.effects).toEqual([]);

    const completed = dispatch(
      initial({ currentRoute: "discover" }),
      {
        type: "ELIGIBILITY_RESOLVED",
        record: record({ status: "completed", completedAt: STARTED_AT }),
      },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    );
    expect(completed.state).toMatchObject({
      phase: "contextual_tip",
      activeTipId: "discover.search",
    });
    expect(completed.effects).toEqual([
      { type: "MARK_SESSION_TIP", tipId: "discover.search" },
    ]);
  });

  it.each([
    ["discover.search", "discover"],
    ["dj.hero", "dj/one"],
  ] as const)("does not offer the %s contextual tip to a skipped record", (tipId, currentRoute) => {
    const skipped = dispatch(
      initial({ currentRoute }),
      {
        type: "ELIGIBILITY_RESOLVED",
        record: record({ status: "skipped", skippedAt: STARTED_AT }),
      },
    ).state;

    const ready = reduceOnboarding(skipped, {
      type: "CONTEXT_TARGET_READY",
      tipId,
    });

    expect(ready.state).toBe(skipped);
    expect(ready.state.phase).toBe("idle");
    expect(ready.effects).toEqual([]);
  });

  it.each([
    ["discover.search", "discover"],
    ["dj.hero", "dj/one"],
  ] as const)("does not offer an already-seen %s contextual tip", (tipId, currentRoute) => {
    const resolved = dispatch(
      initial({ currentRoute }),
      {
        type: "ELIGIBILITY_RESOLVED",
        record: record({
          status: "completed",
          completedAt: STARTED_AT,
          contextualTips: { [tipId]: STARTED_AT },
        }),
      },
    ).state;

    const ready = reduceOnboarding(resolved, {
      type: "CONTEXT_TARGET_READY",
      tipId,
    });

    expect(ready.state).toBe(resolved);
    expect(ready.state.phase).toBe("idle");
    expect(ready.effects).toEqual([]);
  });

  it("allows no more than one contextual tip in a session", () => {
    const completed = record({
      status: "completed",
      completedAt: STARTED_AT,
    });
    const first = dispatch(
      initial({ currentRoute: "discover" }),
      { type: "ELIGIBILITY_RESOLVED", record: completed },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    );
    const dismissed = reduceOnboarding(first.state, {
      type: "CONTEXT_TIP_DISMISSED",
      tipId: "discover.search",
      at: LATER,
    });
    const onDj = reduceOnboarding(dismissed.state, {
      type: "ROUTE_CHANGED",
      route: "dj",
    });
    const second = reduceOnboarding(onDj.state, {
      type: "CONTEXT_TARGET_READY",
      tipId: "dj.hero",
    });

    expect(dismissed.state.record?.contextualTips).toEqual({
      "discover.search": LATER,
    });
    expect(dismissed.effects).toEqual([
      { type: "PERSIST", record: dismissed.state.record },
    ]);
    expect(second.state.phase).toBe("idle");
    expect(second.effects).toEqual([]);
  });

  it("does not offer a tip until its target is ready", () => {
    const completed = record({
      status: "completed",
      completedAt: STARTED_AT,
    });
    const resolved = dispatch(initial({ currentRoute: "discover" }), {
      type: "ELIGIBILITY_RESOLVED",
      record: completed,
    });

    expect(resolved.state.phase).toBe("idle");
    expect(resolved.effects).toEqual([]);

    const wrongRoute = dispatch(
      resolved.state,
      { type: "ROUTE_CHANGED", route: "home" },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    );
    expect(wrongRoute.state.phase).toBe("idle");
    expect(wrongRoute.effects).toEqual([]);
  });

  it("completes a previously skipped replay without changing its historical result", () => {
    const skipped = record({
      status: "skipped",
      skippedAt: STARTED_AT,
    });
    const replaying = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: skipped },
      { type: "HOME_READY", at: LATER },
      { type: "REPLAY_REQUESTED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "SPOTLIGHTS_FINISHED", at: LATER },
    ).state;

    const completed = reduceOnboarding(replaying, {
      type: "COMPLETED",
      at: LATER,
      played: true,
    });

    expect(completed.state.record).toMatchObject({
      status: "skipped",
      skippedAt: STARTED_AT,
      completedAt: null,
      firstPlayAt: null,
      replayCount: 1,
      lastReplayedAt: LATER,
    });
    expect(completed.effects).toEqual([{ type: "HAPTIC_COMPLETION" }]);
  });

  it("keeps duplicate Home readiness idempotent in every active guided phase", () => {
    const welcome = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
    ).state;
    const spotlights = dispatch(
      welcome,
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;
    const completion = dispatch(spotlights, {
      type: "SPOTLIGHTS_FINISHED",
      at: LATER,
    }).state;

    for (const state of [welcome, spotlights, completion]) {
      const duplicate = reduceOnboarding(state, {
        type: "HOME_READY",
        at: LATER,
      });
      expect(duplicate.state).toBe(state);
      expect(duplicate.effects).toEqual([]);
    }
  });

  it("keeps the current Home spotlight active when registration adds another step", () => {
    const spotlight = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      {
        type: "HOME_READY",
        at: STARTED_AT,
        stepIds: ["home.djs", "home.discover"],
      },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
      {
        type: "STEP_ADVANCED",
        stepId: "home.discover",
        index: 1,
        at: LATER,
      },
    ).state;

    const registrationChanged = reduceOnboarding(spotlight, {
      type: "HOME_READY",
      at: "2026-07-16T12:00:00.000Z",
      stepIds: ["home.daily-drop", "home.djs", "home.discover"],
    });

    expect(registrationChanged.state).toMatchObject({
      phase: "home_spotlights",
      activeStepIndex: 2,
      homeStepIds: ["home.daily-drop", "home.djs", "home.discover"],
    });
    expect(registrationChanged.state.record).toBe(spotlight.record);
    expect(registrationChanged.effects).toEqual([]);
  });

  it.each([
    {
      name: "next canonical target",
      currentIndex: 1,
      stepIds: ["home.daily-drop", "home.discover"],
      phase: "home_spotlights",
      activeStepIndex: 1,
      lastStep: "home.discover",
    },
    {
      name: "nearest previous target when no next target remains",
      currentIndex: 2,
      stepIds: ["home.daily-drop"],
      phase: "home_spotlights",
      activeStepIndex: 0,
      lastStep: "home.daily-drop",
    },
    {
      name: "completion when no targets remain",
      currentIndex: 0,
      stepIds: [],
      phase: "completion_prompt",
      activeStepIndex: null,
      lastStep: "home.ready",
    },
  ] as const)(
    "moves an active first-run spotlight to the $name after target removal",
    ({ currentIndex, stepIds, phase, activeStepIndex, lastStep }) => {
      const active = firstRunAtHomeStep(currentIndex);
      const changed = reduceOnboarding(active, {
        type: "HOME_READY",
        at: "2026-07-16T12:00:00.000Z",
        stepIds,
      });

      expect(changed.state).toMatchObject({
        phase,
        activeStepIndex,
        homeStepIds: stepIds,
      });
      expect(changed.state.record).toMatchObject({
        status: "in_progress",
        lastStep,
      });
      expect(changed.state.record).not.toBe(active.record);
      expect(changed.effects).toEqual([
        { type: "PERSIST", record: changed.state.record },
      ]);
    },
  );

  it.each([
    {
      name: "next canonical target",
      currentIndex: 1,
      stepIds: ["home.daily-drop", "home.discover"],
      phase: "home_spotlights",
      activeStepIndex: 1,
      replayCursor: "home.discover",
    },
    {
      name: "nearest previous target when no next target remains",
      currentIndex: 2,
      stepIds: ["home.daily-drop"],
      phase: "home_spotlights",
      activeStepIndex: 0,
      replayCursor: "home.daily-drop",
    },
    {
      name: "completion when no targets remain",
      currentIndex: 0,
      stepIds: [],
      phase: "completion_prompt",
      activeStepIndex: null,
      replayCursor: "home.ready",
    },
  ] as const)(
    "moves an active replay spotlight to the $name after target removal",
    ({ currentIndex, stepIds, phase, activeStepIndex, replayCursor }) => {
      const active = replayAtHomeStep(currentIndex);
      const historical = active.record;
      const changed = reduceOnboarding(active, {
        type: "HOME_READY",
        at: "2026-07-16T12:00:00.000Z",
        stepIds,
      });

      expect(changed.state).toMatchObject({
        phase,
        activeStepIndex,
        homeStepIds: stepIds,
        replayActive: true,
        replayCursor,
      });
      expect(changed.state.record).toBe(historical);
      expect(changed.effects).toEqual([]);
    },
  );

  it("persists an adapted first-run cursor when Continue follows target removal", () => {
    const active = firstRunAtHomeStep(2);
    const interrupted = reduceOnboarding(active, { type: "INTERRUPTED" }).state;
    const registered = reduceOnboarding(interrupted, {
      type: "HOME_READY",
      at: "2026-07-16T12:00:00.000Z",
      stepIds: ["home.daily-drop"],
    }).state;

    const continued = reduceOnboarding(registered, {
      type: "CONTINUE_REQUESTED",
      at: "2026-07-16T12:01:00.000Z",
    });

    expect(continued.state).toMatchObject({
      phase: "home_spotlights",
      activeStepIndex: 0,
    });
    expect(continued.state.record).toMatchObject({
      status: "in_progress",
      lastStep: "home.daily-drop",
    });
    expect(continued.effects).toEqual([
      { type: "PERSIST", record: continued.state.record },
    ]);
  });

  it("adapts only the runtime replay cursor when Continue follows target removal", () => {
    const active = replayAtHomeStep(0);
    const historical = active.record;
    const interrupted = reduceOnboarding(active, { type: "INTERRUPTED" }).state;
    const registered = reduceOnboarding(interrupted, {
      type: "HOME_READY",
      at: "2026-07-16T12:00:00.000Z",
      stepIds: ["home.djs", "home.discover"],
    }).state;

    const continued = reduceOnboarding(registered, {
      type: "CONTINUE_REQUESTED",
      at: "2026-07-16T12:01:00.000Z",
    });

    expect(continued.state).toMatchObject({
      phase: "home_spotlights",
      activeStepIndex: 0,
      replayActive: true,
      replayCursor: "home.djs",
    });
    expect(continued.state.record).toBe(historical);
    expect(continued.effects).toEqual([]);
  });

  it("keeps duplicate eligibility readiness idempotent in every active guided phase", () => {
    const welcome = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
    ).state;
    const spotlights = dispatch(
      welcome,
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;
    const completion = dispatch(spotlights, {
      type: "SPOTLIGHTS_FINISHED",
      at: LATER,
    }).state;
    const replacement = record({
      status: "completed",
      completedAt: LATER,
    });

    for (const state of [welcome, spotlights, completion]) {
      for (const duplicateRecord of [null, replacement]) {
        const duplicate = reduceOnboarding(state, {
          type: "ELIGIBILITY_RESOLVED",
          record: duplicateRecord,
        });
        expect(duplicate.state).toBe(state);
        expect(duplicate.effects).toEqual([]);
      }
    }
  });

  it("interrupts each guided phase when leaving Home", () => {
    const welcome = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
    ).state;
    const spotlights = dispatch(
      welcome,
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;
    const completion = dispatch(spotlights, {
      type: "SPOTLIGHTS_FINISHED",
      at: LATER,
    }).state;

    for (const state of [welcome, spotlights, completion]) {
      const leftHome = reduceOnboarding(state, {
        type: "ROUTE_CHANGED",
        route: "profile",
      });
      expect(leftHome.state).toMatchObject({
        phase: "idle",
        homeReady: false,
        canContinue: true,
        record: state.record,
      });
      expect(leftHome.effects).toEqual([]);
    }
  });

  it.each([
    [null, "welcome", "welcome.intro", null],
    ["welcome.intro", "welcome", "welcome.intro", null],
    ["welcome.djs", "welcome", "welcome.djs", null],
    ["home.daily-drop", "home_spotlights", null, 0],
    ["home.djs", "home_spotlights", null, 1],
    ["home.discover", "home_spotlights", null, 2],
    ["home.ready", "completion_prompt", null, null],
  ] as const)(
    "resumes lastStep %s at its deterministic phase and position",
    (lastStep, phase, activeWelcomeStepId, activeStepIndex) => {
      const ready = dispatch(
        initial(),
        { type: "ELIGIBILITY_RESOLVED", record: record({ lastStep }) },
        { type: "HOME_READY", at: LATER },
      ).state;

      const continued = reduceOnboarding(ready, {
        type: "CONTINUE_REQUESTED",
      });
      expect(continued.state).toMatchObject({
        phase,
        activeWelcomeStepId,
        activeStepIndex,
      });
    },
  );

  it("persists accepted welcome advances and the completion transition", () => {
    const intro = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
    ).state;

    const djs = reduceOnboarding(intro, { type: "WELCOME_CONTINUED", at: LATER });
    expect(djs.state).toMatchObject({
      phase: "welcome",
      activeWelcomeStepId: "welcome.djs",
    });
    expect(djs.state.record?.lastStep).toBe("welcome.djs");
    expect(djs.effects).toEqual([
      { type: "PERSIST", record: djs.state.record },
    ]);

    const home = reduceOnboarding(djs.state, { type: "WELCOME_CONTINUED", at: LATER });
    expect(home.state).toMatchObject({
      phase: "home_spotlights",
      activeWelcomeStepId: null,
      activeStepIndex: 0,
    });
    expect(home.state.record?.lastStep).toBe("home.daily-drop");
    expect(home.effects).toEqual([
      { type: "PERSIST", record: home.state.record },
    ]);

    const completion = reduceOnboarding(home.state, {
      type: "SPOTLIGHTS_FINISHED",
      at: LATER,
    });
    expect(completion.state).toMatchObject({
      phase: "completion_prompt",
      activeStepIndex: null,
    });
    expect(completion.state.record?.lastStep).toBe("home.ready");
    expect(completion.effects).toEqual([
      { type: "PERSIST", record: completion.state.record },
    ]);
  });

  it.each(["completed", "skipped"] as const)(
    "starts a %s replay from welcome intro and ignores duplicate requests",
    (status) => {
      const terminal = record({
        status,
        completedAt: status === "completed" ? STARTED_AT : null,
        skippedAt: status === "skipped" ? STARTED_AT : null,
      });
      const resolved = dispatch(initial({ currentRoute: "profile" }), {
        type: "ELIGIBILITY_RESOLVED",
        record: terminal,
      }).state;
      const requested = reduceOnboarding(resolved, {
        type: "REPLAY_REQUESTED",
        at: LATER,
      });
      const duplicate = reduceOnboarding(requested.state, {
        type: "REPLAY_REQUESTED",
        at: "2026-07-16T12:00:00.000Z",
      });

      expect(duplicate.state).toBe(requested.state);
      expect(duplicate.effects).toEqual([]);
      expect(duplicate.state.record).toEqual({
        ...terminal,
        replayCount: 1,
        lastReplayedAt: LATER,
      });

      const ready = reduceOnboarding(duplicate.state, {
        type: "HOME_READY",
        at: LATER,
      });
      expect(ready.state).toMatchObject({
        phase: "welcome",
        activeWelcomeStepId: "welcome.intro",
        activeStepIndex: null,
        replayPending: false,
      });
      const duplicateActive = reduceOnboarding(ready.state, {
        type: "REPLAY_REQUESTED",
        at: "2026-07-16T13:00:00.000Z",
      });
      expect(duplicateActive.state).toBe(ready.state);
      expect(duplicateActive.effects).toEqual([]);
    },
  );

  it.each([
    ["completed", []],
    [
      "skipped",
      [
        { type: "WELCOME_CONTINUED", at: LATER },
        { type: "WELCOME_CONTINUED", at: LATER },
        { type: "SPOTLIGHTS_FINISHED", at: LATER },
      ],
    ],
  ] as const)(
    "dismisses a %s replay without changing or persisting its terminal record",
    (status, replayEvents) => {
      const terminal = record({
        status,
        completedAt: status === "completed" ? STARTED_AT : null,
        skippedAt: status === "skipped" ? STARTED_AT : null,
      });
      const replaying = dispatch(
        initial(),
        { type: "ELIGIBILITY_RESOLVED", record: terminal },
        { type: "HOME_READY", at: LATER },
        { type: "REPLAY_REQUESTED", at: LATER },
        ...replayEvents,
      ).state;

      const dismissed = reduceOnboarding(replaying, {
        type: "SKIPPED",
        at: "2026-07-16T14:00:00.000Z",
      });

      expect(dismissed.state).toMatchObject({
        phase: "idle",
        replayPending: false,
        activeWelcomeStepId: null,
        activeStepIndex: null,
        activeTipId: null,
        canContinue: false,
      });
      expect(dismissed.state.record).toBe(replaying.record);
      expect(dismissed.effects).toEqual([]);
    },
  );

  it("closes an active contextual tip when its route or target disappears", () => {
    const completed = record({
      status: "completed",
      completedAt: STARTED_AT,
    });
    const activeFromRoute = dispatch(
      initial({ currentRoute: "discover" }),
      { type: "ELIGIBILITY_RESOLVED", record: completed },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    ).state;
    const routeLost = reduceOnboarding(activeFromRoute, {
      type: "ROUTE_CHANGED",
      route: "home",
    });
    expect(routeLost.state).toMatchObject({
      phase: "idle",
      activeTipId: null,
      sessionTipIds: ["discover.search"],
      record: completed,
    });
    expect(routeLost.effects).toEqual([]);

    const activeFromTarget = dispatch(
      initial({ currentRoute: "discover" }),
      { type: "ELIGIBILITY_RESOLVED", record: completed },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    ).state;
    const targetLost = reduceOnboarding(activeFromTarget, {
      type: "CONTEXT_TARGET_UNAVAILABLE",
      tipId: "discover.search",
    });
    expect(targetLost.state).toMatchObject({
      phase: "idle",
      activeTipId: null,
      sessionTipIds: ["discover.search"],
      record: completed,
    });
    expect(targetLost.effects).toEqual([]);

    const activeFromInterruption = dispatch(
      initial({ currentRoute: "discover" }),
      { type: "ELIGIBILITY_RESOLVED", record: completed },
      { type: "CONTEXT_TARGET_READY", tipId: "discover.search" },
    ).state;
    const interrupted = reduceOnboarding(activeFromInterruption, {
      type: "INTERRUPTED",
    });
    expect(interrupted.state).toMatchObject({
      phase: "idle",
      activeTipId: null,
      sessionTipIds: ["discover.search"],
      record: completed,
    });
    expect(interrupted.effects).toEqual([]);
  });

  it.each([
    ["home.daily-drop", 1],
    ["home.djs", 0],
    ["home.discover", 3],
    ["unknown", 0],
    ["home.daily-drop", 0.5],
  ])("rejects invalid home step pair %s/%s", (stepId, index) => {
    const home = dispatch(
      initial(),
      { type: "ELIGIBILITY_RESOLVED", record: null },
      { type: "HOME_READY", at: STARTED_AT },
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "WELCOME_CONTINUED", at: LATER },
    ).state;
    const advanced = reduceOnboarding(home, {
      type: "STEP_ADVANCED",
      stepId,
      index,
      at: LATER,
    });

    expect(advanced.state).toBe(home);
    expect(advanced.effects).toEqual([]);
  });

  it("does not regress terminal records through ordinary flow events", () => {
    const completed = record({
      status: "completed",
      completedAt: STARTED_AT,
    });
    const idle = dispatch(initial(), {
      type: "ELIGIBILITY_RESOLVED",
      record: completed,
    }).state;

    const result = dispatch(
      idle,
      { type: "WELCOME_CONTINUED", at: LATER },
      { type: "STEP_ADVANCED", stepId: "home.daily-drop", index: 0, at: LATER },
      { type: "SPOTLIGHTS_FINISHED", at: LATER },
      { type: "SKIPPED", at: LATER },
      { type: "COMPLETED", at: LATER, played: true },
    );
    expect(result.state.record).toBe(completed);
    expect(result.state.phase).toBe("idle");
    expect(result.effects).toEqual([]);
  });

  it("never mutates caller-owned state, record, tips, or session inputs", () => {
    const contextualTips = Object.freeze({});
    const sourceRecord = Object.freeze(
      record({
        status: "completed",
        completedAt: STARTED_AT,
        contextualTips,
      }),
    );
    const sessionTipIds = Object.freeze([]) as readonly [];
    const sourceState = Object.freeze(
      initial({ currentRoute: "discover", sessionTipIds }),
    );
    const resolved = reduceOnboarding(sourceState, {
      type: "ELIGIBILITY_RESOLVED",
      record: sourceRecord,
    });
    const shown = reduceOnboarding(Object.freeze(resolved.state), {
      type: "CONTEXT_TARGET_READY",
      tipId: "discover.search",
    });
    const dismissed = reduceOnboarding(Object.freeze(shown.state), {
      type: "CONTEXT_TIP_DISMISSED",
      tipId: "discover.search",
      at: LATER,
    });

    expect(sourceRecord.contextualTips).toEqual({});
    expect(sessionTipIds).toEqual([]);
    expect(dismissed.state.record).not.toBe(sourceRecord);
    expect(dismissed.state.sessionTipIds).not.toBe(sessionTipIds);
  });
});
