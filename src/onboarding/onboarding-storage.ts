import { secureStorage } from "@/src/lib/secure-storage";
import { ONBOARDING_STORAGE_PREFIX } from "./constants";
import {
  normalizeOnboardingTimestamps,
  normalizeTimestamp,
} from "./timestamps";
import type {
  ContextualTipId,
  OnboardingRecord,
  OnboardingStatus,
} from "./types";

const STATUSES: readonly OnboardingStatus[] = [
  "in_progress",
  "completed",
  "skipped",
];
const TIP_IDS: readonly ContextualTipId[] = ["discover.search", "dj.hero"];

export function onboardingStorageKey(userId: string, version: number): string {
  return `${ONBOARDING_STORAGE_PREFIX}:${userId}:v${version}`;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || normalizeTimestamp(value) !== null;
}

function isContextualTips(
  value: unknown,
): value is OnboardingRecord["contextualTips"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.entries(value).every(
    ([key, timestamp]) =>
      TIP_IDS.includes(key as ContextualTipId) &&
      normalizeTimestamp(timestamp) !== null,
  );
}

function hasValidLifecycle(candidate: Record<string, unknown>): boolean {
  if (candidate.status === "completed") {
    return (
      typeof candidate.completedAt === "string" && candidate.skippedAt === null
    );
  }
  if (candidate.status === "skipped") {
    return (
      typeof candidate.skippedAt === "string" && candidate.completedAt === null
    );
  }
  return (
    candidate.status === "in_progress" &&
    candidate.completedAt === null &&
    candidate.skippedAt === null
  );
}

function isOnboardingRecord(value: unknown): value is OnboardingRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.userId === "string" &&
    typeof candidate.version === "number" &&
    Number.isInteger(candidate.version) &&
    candidate.version > 0 &&
    STATUSES.includes(candidate.status as OnboardingStatus) &&
    hasValidLifecycle(candidate) &&
    isNullableString(candidate.lastStep) &&
    normalizeTimestamp(candidate.startedAt) !== null &&
    isNullableTimestamp(candidate.completedAt) &&
    isNullableTimestamp(candidate.skippedAt) &&
    isNullableTimestamp(candidate.firstPlayAt) &&
    isContextualTips(candidate.contextualTips) &&
    typeof candidate.replayCount === "number" &&
    Number.isInteger(candidate.replayCount) &&
    candidate.replayCount >= 0 &&
    isNullableTimestamp(candidate.lastReplayedAt) &&
    normalizeTimestamp(candidate.updatedAt) !== null
  );
}

export async function loadOnboardingRecord(
  userId: string,
  version: number,
): Promise<OnboardingRecord | null> {
  const serialized = await secureStorage.getItem(
    onboardingStorageKey(userId, version),
  );
  if (serialized === null) return null;

  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !isOnboardingRecord(value) ||
      value.userId !== userId ||
      value.version !== version
    ) {
      return null;
    }
    return normalizeOnboardingTimestamps(value);
  } catch {
    return null;
  }
}

export async function saveOnboardingRecord(
  record: OnboardingRecord,
): Promise<void> {
  const normalized = normalizeOnboardingTimestamps(record);
  await secureStorage.setItem(
    onboardingStorageKey(record.userId, record.version),
    JSON.stringify(normalized),
  );
}
