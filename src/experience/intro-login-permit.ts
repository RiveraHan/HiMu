const LOGIN_PERMIT_TTL_MS = 5_000;

type IntroLoginOrigin = symbol;
type ObservedRoute = "welcome" | "login" | "other";

type LoginHandoff = {
  origin: IntroLoginOrigin;
  issuedAt: number;
  ready: boolean;
};

let activeOrigin: IntroLoginOrigin | null = null;
let handoff: LoginHandoff | null = null;
let observedRoute: ObservedRoute = "other";

function routeFromSegments(segments: readonly string[]): ObservedRoute {
  if (segments[0] === "welcome") return "welcome";
  if (segments[0] === "(auth)" && segments[1] === "login") return "login";
  return "other";
}

function isExpired(candidate: LoginHandoff, nowMs: number): boolean {
  return nowMs < candidate.issuedAt || nowMs - candidate.issuedAt > LOGIN_PERMIT_TTL_MS;
}

function discardExpiredHandoff(nowMs: number): void {
  if (handoff && isExpired(handoff, nowMs)) handoff = null;
}

export function registerIntroLoginOrigin(origin: IntroLoginOrigin): void {
  if (activeOrigin !== origin) handoff = null;
  activeOrigin = origin;
}

export function abandonIntroLoginOrigin(origin: IntroLoginOrigin): void {
  if (activeOrigin === origin) activeOrigin = null;
  if (handoff?.origin === origin) handoff = null;
}

export function beginIntroLoginHandoff(
  origin: IntroLoginOrigin,
  nowMs = Date.now(),
): boolean {
  discardExpiredHandoff(nowMs);
  if (activeOrigin !== origin || observedRoute !== "welcome") return false;
  handoff = { origin, issuedAt: nowMs, ready: false };
  return true;
}

export function cancelIntroLoginHandoff(origin: IntroLoginOrigin): void {
  if (handoff?.origin === origin) handoff = null;
}

export function observeIntroRouteTransition(
  segments: readonly string[],
  nowMs = Date.now(),
): void {
  discardExpiredHandoff(nowMs);
  const nextRoute = routeFromSegments(segments);
  if (nextRoute === observedRoute) return;

  if (handoff) {
    const isExpectedTransition =
      observedRoute === "welcome" &&
      nextRoute === "login" &&
      activeOrigin === handoff.origin &&
      !handoff.ready;
    if (isExpectedTransition) {
      handoff = { ...handoff, ready: true };
    } else {
      handoff = null;
    }
  }
  observedRoute = nextRoute;
}

export function consumeIntroLoginPermit(nowMs = Date.now()): boolean {
  discardExpiredHandoff(nowMs);
  if (!handoff?.ready) return false;
  handoff = null;
  return true;
}
