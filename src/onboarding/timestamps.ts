import type { ContextualTipId, OnboardingRecord } from "./types";

const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const TIP_IDS: readonly ContextualTipId[] = ["discover.search", "dj.hero"];

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = RFC3339_PATTERN.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] =
    match;
  if (
    !isCalendarDate(Number(year), Number(month), Number(day)) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    (offsetHour !== undefined && Number(offsetHour) > 23) ||
    (offsetMinute !== undefined && Number(offsetMinute) > 59)
  ) {
    return null;
  }

  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? new Date(epoch).toISOString() : null;
}

export function requireTimestamp(value: unknown, field: string): string {
  const normalized = normalizeTimestamp(value);
  if (normalized === null) {
    throw new Error(`Invalid timestamp for ${field}`);
  }
  return normalized;
}

function normalizeNullableTimestamp(
  value: string | null,
  field: string,
): string | null {
  return value === null ? null : requireTimestamp(value, field);
}

export function timestampEpoch(value: string, field: string): number {
  return Date.parse(requireTimestamp(value, field));
}

export function nextUpdatedAt(previous: string, at: string): string {
  const previousEpoch = timestampEpoch(previous, "updatedAt");
  const normalizedAt = requireTimestamp(at, "cursor event at");
  const candidateEpoch = timestampEpoch(normalizedAt, "cursor event at");
  if (candidateEpoch > previousEpoch) return normalizedAt;
  return new Date(previousEpoch + 1).toISOString();
}

export function normalizeOnboardingTimestamps(
  record: OnboardingRecord,
): OnboardingRecord {
  const contextualTips: OnboardingRecord["contextualTips"] = {};
  for (const tipId of TIP_IDS) {
    const timestamp = record.contextualTips[tipId];
    if (timestamp !== undefined) {
      contextualTips[tipId] = requireTimestamp(
        timestamp,
        `contextualTips.${tipId}`,
      );
    }
  }

  return {
    ...record,
    startedAt: requireTimestamp(record.startedAt, "startedAt"),
    completedAt: normalizeNullableTimestamp(record.completedAt, "completedAt"),
    skippedAt: normalizeNullableTimestamp(record.skippedAt, "skippedAt"),
    firstPlayAt: normalizeNullableTimestamp(record.firstPlayAt, "firstPlayAt"),
    contextualTips,
    lastReplayedAt: normalizeNullableTimestamp(
      record.lastReplayedAt,
      "lastReplayedAt",
    ),
    updatedAt: requireTimestamp(record.updatedAt, "updatedAt"),
  };
}
