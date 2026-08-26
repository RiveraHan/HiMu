import { secureStorage } from "@/src/lib/secure-storage";

const INTRO_KEY = "himu.intro.v2";
const PENDING_INTENT_KEY = "himu.pending-navigation.v1";
const FIRST_TRACK_TTL_MS = 24 * 60 * 60 * 1000;

export const PUBLIC_INTRO_VERSION = 2;

export type FirstTrackReturnIntent = {
  version: 1;
  kind: "first_track";
  source: "public_intro_v2";
  createdAt: string;
};

export type PendingNavigationIntent = FirstTrackReturnIntent;

type IntroState = {
  version: number;
  completedAt: string;
};

const pendingOperations = new Map<string, Promise<void>>();

function runForKey<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = pendingOperations.get(key) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  pendingOperations.set(key, result.then(() => undefined, () => undefined));
  return result;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => key in value);
}

function canonicalIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  try {
    return new Date(timestamp).toISOString() === value ? value : null;
  } catch {
    return null;
  }
}

function parseIntroState(value: string): IntroState | null {
  try {
    const candidate = record(JSON.parse(value));
    if (
      !candidate ||
      !hasExactKeys(candidate, ["version", "completedAt"]) ||
      !Number.isSafeInteger(candidate.version) ||
      (candidate.version as number) < 0
    ) {
      return null;
    }

    const completedAt = canonicalIsoTimestamp(candidate.completedAt);
    return completedAt
      ? { version: candidate.version as number, completedAt }
      : null;
  } catch {
    return null;
  }
}

function parsePendingIntent(value: string): PendingNavigationIntent | null {
  try {
    const candidate = record(JSON.parse(value));
    if (
      !candidate ||
      !hasExactKeys(candidate, ["version", "kind", "source", "createdAt"]) ||
      candidate.version !== 1 ||
      candidate.kind !== "first_track" ||
      candidate.source !== "public_intro_v2"
    ) {
      return null;
    }

    const createdAt = canonicalIsoTimestamp(candidate.createdAt);
    return createdAt
      ? { version: 1, kind: "first_track", source: "public_intro_v2", createdAt }
      : null;
  } catch {
    return null;
  }
}

function isFresh(intent: PendingNavigationIntent, nowMs: number): boolean {
  const createdAtMs = Date.parse(intent.createdAt);
  const age = nowMs - createdAtMs;
  return age >= 0 && age < FIRST_TRACK_TTL_MS;
}

function assertValidTimestamp(timestamp: number, label: string): void {
  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(new Date(timestamp).getTime())
  ) {
    throw new TypeError(`${label} must be a valid millisecond timestamp`);
  }
}

function timestampToIso(timestamp: number): string {
  assertValidTimestamp(timestamp, "Timestamp");
  return new Date(timestamp).toISOString();
}

async function loadIntroState(): Promise<IntroState | null> {
  const serialized = await secureStorage.getItem(INTRO_KEY);
  if (serialized === null) return null;

  const state = parseIntroState(serialized);
  if (!state) await secureStorage.removeItem(INTRO_KEY);
  return state;
}

async function loadPendingIntent(nowMs: number): Promise<PendingNavigationIntent | null> {
  assertValidTimestamp(nowMs, "Current time");
  const serialized = await secureStorage.getItem(PENDING_INTENT_KEY);
  if (serialized === null) return null;

  const intent = parsePendingIntent(serialized);
  if (!intent || !isFresh(intent, nowMs)) {
    await secureStorage.removeItem(PENDING_INTENT_KEY);
    return null;
  }

  return intent;
}

export const introStateStore = {
  markSeen: (version: number, completedAtMs: number) => runForKey(INTRO_KEY, async () => {
    if (!Number.isSafeInteger(version) || version < 0) {
      throw new TypeError("Intro version must be a non-negative safe integer");
    }

    const existing = await loadIntroState();
    if (existing && existing.version >= version) return;

    await secureStorage.setItem(INTRO_KEY, JSON.stringify({
      version,
      completedAt: timestampToIso(completedAtMs),
    }));
  }),

  isSeen: (version: number) => runForKey(INTRO_KEY, async () => {
    const state = await loadIntroState();
    return !!state && state.version >= version;
  }),
};

export const pendingIntentStore = {
  writeFirstTrack: (createdAtMs: number) => runForKey(PENDING_INTENT_KEY, () => (
    secureStorage.setItem(PENDING_INTENT_KEY, JSON.stringify({
      version: 1,
      kind: "first_track",
      source: "public_intro_v2",
      createdAt: timestampToIso(createdAtMs),
    } satisfies FirstTrackReturnIntent))
  )),

  read: (nowMs: number) => runForKey(
    PENDING_INTENT_KEY,
    () => loadPendingIntent(nowMs),
  ),

  consume: (kind: PendingNavigationIntent["kind"], nowMs: number) => runForKey(
    PENDING_INTENT_KEY,
    async () => {
      const intent = await loadPendingIntent(nowMs);
      if (!intent || intent.kind !== kind) return false;

      await secureStorage.removeItem(PENDING_INTENT_KEY);
      return true;
    },
  ),

  clear: () => runForKey(PENDING_INTENT_KEY, () => (
    secureStorage.removeItem(PENDING_INTENT_KEY)
  )),
};
