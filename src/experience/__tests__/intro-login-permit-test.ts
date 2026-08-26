import {
  abandonIntroLoginOrigin,
  beginIntroLoginHandoff,
  cancelIntroLoginHandoff,
  consumeIntroLoginPermit,
  observeIntroRouteTransition,
  registerIntroLoginOrigin,
} from "@/src/experience/intro-login-permit";

const NOW = 1_000_000;

describe("intro Login navigation-transition permit", () => {
  it("does not let an unrelated Login mount consume a requested handoff inside the TTL", () => {
    const origin = Symbol("origin");
    observeIntroRouteTransition(["welcome"], NOW);
    registerIntroLoginOrigin(origin);

    expect(beginIntroLoginHandoff(origin, NOW)).toBe(true);
    expect(consumeIntroLoginPermit(NOW + 1)).toBe(false);

    cancelIntroLoginHandoff(origin);
    abandonIntroLoginOrigin(origin);
  });

  it("allows one immediate Login mount after the exact welcome-to-auth transition", () => {
    const origin = Symbol("origin");
    observeIntroRouteTransition(["other"], NOW);
    observeIntroRouteTransition(["welcome"], NOW);
    registerIntroLoginOrigin(origin);
    expect(beginIntroLoginHandoff(origin, NOW)).toBe(true);

    observeIntroRouteTransition(["(auth)", "login"], NOW + 1);

    expect(consumeIntroLoginPermit(NOW + 2)).toBe(true);
    expect(consumeIntroLoginPermit(NOW + 2)).toBe(false);
    abandonIntroLoginOrigin(origin);
  });

  it("invalidates an old handoff when a different welcome instance registers", () => {
    const oldOrigin = Symbol("old-origin");
    const newOrigin = Symbol("new-origin");
    observeIntroRouteTransition(["other"], NOW);
    observeIntroRouteTransition(["welcome"], NOW);
    registerIntroLoginOrigin(oldOrigin);
    expect(beginIntroLoginHandoff(oldOrigin, NOW)).toBe(true);

    registerIntroLoginOrigin(newOrigin);
    observeIntroRouteTransition(["(auth)", "login"], NOW + 1);

    expect(consumeIntroLoginPermit(NOW + 2)).toBe(false);
    abandonIntroLoginOrigin(oldOrigin);
    abandonIntroLoginOrigin(newOrigin);
  });

  it("cleans requested handoffs on route abandonment and router cancellation", () => {
    const abandonedOrigin = Symbol("abandoned-origin");
    observeIntroRouteTransition(["other"], NOW);
    observeIntroRouteTransition(["welcome"], NOW);
    registerIntroLoginOrigin(abandonedOrigin);
    expect(beginIntroLoginHandoff(abandonedOrigin, NOW)).toBe(true);
    abandonIntroLoginOrigin(abandonedOrigin);
    observeIntroRouteTransition(["other"], NOW + 1);
    observeIntroRouteTransition(["(auth)", "login"], NOW + 2);
    expect(consumeIntroLoginPermit(NOW + 3)).toBe(false);

    const cancelledOrigin = Symbol("cancelled-origin");
    observeIntroRouteTransition(["welcome"], NOW + 4);
    registerIntroLoginOrigin(cancelledOrigin);
    expect(beginIntroLoginHandoff(cancelledOrigin, NOW + 4)).toBe(true);
    cancelIntroLoginHandoff(cancelledOrigin);
    observeIntroRouteTransition(["(auth)", "login"], NOW + 5);
    expect(consumeIntroLoginPermit(NOW + 6)).toBe(false);
    abandonIntroLoginOrigin(cancelledOrigin);
  });
});
