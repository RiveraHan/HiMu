import type {
  ContextualTipId,
  OnboardingRecord,
  OnboardingStatus,
} from "./types";
import {
  normalizeOnboardingTimestamps,
  requireTimestamp,
  timestampEpoch,
} from "./timestamps";

const STATUS_PRECEDENCE: Record<OnboardingStatus, number> = {
  in_progress: 0,
  skipped: 1,
  completed: 2,
};

function earliestTimestamp(
  first: string | undefined,
  second: string | undefined,
): string | undefined {
  if (first === undefined) return second;
  if (second === undefined) return first;
  const firstNormalized = requireTimestamp(first, "contextual tip");
  const secondNormalized = requireTimestamp(second, "contextual tip");
  return timestampEpoch(firstNormalized, "contextual tip") <=
    timestampEpoch(secondNormalized, "contextual tip")
    ? firstNormalized
    : secondNormalized;
}

function latestNullableTimestamp(
  first: string | null,
  second: string | null,
): string | null {
  if (first === null && second === null) return null;
  if (first === null) return requireTimestamp(second!, "lastReplayedAt");
  if (second === null) return requireTimestamp(first, "lastReplayedAt");
  const firstNormalized = requireTimestamp(first, "lastReplayedAt");
  const secondNormalized = requireTimestamp(second, "lastReplayedAt");
  return timestampEpoch(firstNormalized, "lastReplayedAt") >=
    timestampEpoch(secondNormalized, "lastReplayedAt")
    ? firstNormalized
    : secondNormalized;
}

function mergeContextualTips(
  local: OnboardingRecord,
  server: OnboardingRecord,
): OnboardingRecord["contextualTips"] {
  const result: OnboardingRecord["contextualTips"] = {};
  for (const tipId of [
    "discover.search",
    "dj.hero",
  ] as const satisfies readonly ContextualTipId[]) {
    const timestamp = earliestTimestamp(
      local.contextualTips[tipId],
      server.contextualTips[tipId],
    );
    if (timestamp !== undefined) result[tipId] = timestamp;
  }
  return result;
}

export function reconcileOnboarding(
  local: OnboardingRecord | null,
  server: OnboardingRecord | null,
): OnboardingRecord | undefined {
  if (!local && !server) return undefined;
  const normalizedLocal = local
    ? normalizeOnboardingTimestamps(local)
    : null;
  const normalizedServer = server
    ? normalizeOnboardingTimestamps(server)
    : null;
  if (!normalizedLocal) return normalizedServer ?? undefined;
  if (!normalizedServer) return normalizedLocal;

  const localPrecedence = STATUS_PRECEDENCE[normalizedLocal.status];
  const serverPrecedence = STATUS_PRECEDENCE[normalizedServer.status];
  const winner =
    localPrecedence > serverPrecedence ||
    (localPrecedence === serverPrecedence &&
      timestampEpoch(normalizedLocal.updatedAt, "updatedAt") >
        timestampEpoch(normalizedServer.updatedAt, "updatedAt"))
      ? normalizedLocal
      : normalizedServer;

  return {
    ...winner,
    contextualTips: mergeContextualTips(normalizedLocal, normalizedServer),
    replayCount: Math.max(
      normalizedLocal.replayCount,
      normalizedServer.replayCount,
    ),
    lastReplayedAt: latestNullableTimestamp(
      normalizedLocal.lastReplayedAt,
      normalizedServer.lastReplayedAt,
    ),
  };
}
