import { secureStorage } from "@/src/lib/secure-storage";
import {
  introStateStore,
  pendingIntentStore,
} from "../pending-intent";
import {
  introStateStore as publicIntroStateStore,
  pendingIntentStore as publicPendingIntentStore,
  PUBLIC_INTRO_VERSION,
} from "../index";
import type {
  ExperienceState,
  FirstTrackReturnIntent,
  PendingNavigationIntent,
} from "../index";

jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}));

jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: jest.fn() }));

const NOW = 1_777_000_000_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const firstTrackIntent = (createdAt = NOW): FirstTrackReturnIntent => ({
  version: 1,
  kind: "first_track",
  source: "public_intro_v2",
  createdAt: new Date(createdAt).toISOString(),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("versioned experience storage", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    jest.mocked(secureStorage.getItem).mockImplementation(async (key) => (
      values.get(key) ?? null
    ));
    jest.mocked(secureStorage.setItem).mockImplementation(async (key, value) => {
      values.set(key, value);
    });
    jest.mocked(secureStorage.removeItem).mockImplementation(async (key) => {
      values.delete(key);
    });
  });

  it("stores the greatest intro version under the stable dotted key", async () => {
    await introStateStore.markSeen(2, NOW);

    expect(secureStorage.setItem).toHaveBeenCalledWith(
      "himu.intro.v2",
      JSON.stringify({
        version: 2,
        completedAt: new Date(NOW).toISOString(),
      }),
    );
    await expect(introStateStore.isSeen(2)).resolves.toBe(true);
    await expect(introStateStore.isSeen(3)).resolves.toBe(false);

    await introStateStore.markSeen(1, NOW + 1);
    expect(JSON.parse(values.get("himu.intro.v2")!)).toEqual({
      version: 2,
      completedAt: new Date(NOW).toISOString(),
    });
  });

  it("round-trips a first-track intent through the exact dotted key until the TTL boundary", async () => {
    await pendingIntentStore.writeFirstTrack(NOW);

    expect(secureStorage.setItem).toHaveBeenCalledWith(
      "himu.pending-navigation.v1",
      JSON.stringify(firstTrackIntent()),
    );
    await expect(pendingIntentStore.read(NOW + ONE_DAY_MS - 1)).resolves.toEqual(
      firstTrackIntent(),
    );
    await expect(pendingIntentStore.read(NOW + ONE_DAY_MS)).resolves.toBeNull();
    expect(secureStorage.removeItem).toHaveBeenCalledWith(
      "himu.pending-navigation.v1",
    );
  });

  it("allows concurrent observers to consume a first-track intent exactly once", async () => {
    await pendingIntentStore.writeFirstTrack(NOW);

    await expect(Promise.all([
      pendingIntentStore.consume("first_track", NOW + 1),
      pendingIntentStore.consume("first_track", NOW + 2),
    ])).resolves.toEqual([true, false]);
    await expect(pendingIntentStore.read(NOW + 3)).resolves.toBeNull();
  });

  it.each([
    [1, 2],
    [2, 1],
  ])("keeps the greatest intro version when concurrent marks start in the %i/%i order", async (first, second) => {
    const firstRead = deferred<string | null>();
    let delayFirstRead = true;
    jest.mocked(secureStorage.getItem).mockImplementation(async (key) => {
      if (key === "himu.intro.v2" && delayFirstRead) {
        delayFirstRead = false;
        return firstRead.promise;
      }
      return values.get(key) ?? null;
    });

    const firstMark = introStateStore.markSeen(first, NOW);
    const secondMark = introStateStore.markSeen(second, NOW + 1);
    firstRead.resolve(null);

    await Promise.all([firstMark, secondMark]);
    expect(JSON.parse(values.get("himu.intro.v2")!)).toMatchObject({
      version: 2,
    });
  });

  it("clears a pending intent with the stable dotted key", async () => {
    await pendingIntentStore.writeFirstTrack(NOW);

    await pendingIntentStore.clear();

    expect(secureStorage.removeItem).toHaveBeenCalledWith(
      "himu.pending-navigation.v1",
    );
    await expect(pendingIntentStore.read(NOW + 1)).resolves.toBeNull();
  });

  it.each([
    ["malformed JSON", "{"],
    ["an unsupported version", JSON.stringify({ ...firstTrackIntent(), version: 2 })],
    ["an impossible timestamp", JSON.stringify({ ...firstTrackIntent(), createdAt: "not-a-date" })],
    ["a noncanonical ISO timestamp", JSON.stringify({ ...firstTrackIntent(), createdAt: new Date(NOW).toISOString().replace(".000Z", "Z") })],
    ["a future timestamp", JSON.stringify({ ...firstTrackIntent(), createdAt: new Date(NOW + 1).toISOString() })],
    ["another intent kind", JSON.stringify({ ...firstTrackIntent(), kind: "other" })],
    ["a wrong source", JSON.stringify({ ...firstTrackIntent(), source: "public_intro_v1" })],
    ["an unexpected key", JSON.stringify({ ...firstTrackIntent(), extra: true })],
  ])("deletes %s pending intent data", async (_case, serialized) => {
    values.set("himu.pending-navigation.v1", serialized);

    await expect(pendingIntentStore.read(NOW)).resolves.toBeNull();
    expect(secureStorage.removeItem).toHaveBeenCalledWith(
      "himu.pending-navigation.v1",
    );
    expect(values.has("himu.pending-navigation.v1")).toBe(false);
  });

  it("rejects when a pending-intent write fails", async () => {
    const failure = new Error("storage unavailable");
    jest.mocked(secureStorage.setItem).mockRejectedValueOnce(failure);

    await expect(pendingIntentStore.writeFirstTrack(NOW)).rejects.toThrow(failure);
  });

  it("continues a same-key queue after a rejected write", async () => {
    const failure = new Error("storage unavailable");
    jest.mocked(secureStorage.setItem).mockRejectedValueOnce(failure);

    await expect(pendingIntentStore.writeFirstTrack(NOW)).rejects.toThrow(failure);
    await expect(pendingIntentStore.writeFirstTrack(NOW + 1)).resolves.toBeUndefined();
    await expect(pendingIntentStore.read(NOW + 1)).resolves.toEqual(firstTrackIntent(NOW + 1));
  });

  it("rejects consume when removal fails without claiming the pending intent", async () => {
    await pendingIntentStore.writeFirstTrack(NOW);
    const failure = new Error("remove unavailable");
    jest.mocked(secureStorage.removeItem).mockRejectedValueOnce(failure);

    await expect(pendingIntentStore.consume("first_track", NOW + 1)).rejects.toThrow(failure);
    expect(values.get("himu.pending-navigation.v1")).toBe(JSON.stringify(firstTrackIntent()));
  });

  it("rejects a read when invalid-record cleanup fails", async () => {
    values.set("himu.pending-navigation.v1", "{");
    const failure = new Error("remove unavailable");
    jest.mocked(secureStorage.removeItem).mockRejectedValueOnce(failure);

    await expect(pendingIntentStore.read(NOW)).rejects.toThrow(failure);
    expect(values.get("himu.pending-navigation.v1")).toBe("{");
  });

  it("keeps the pending-intent key independent while an intro operation is blocked then rejects", async () => {
    const blockedRead = deferred<string | null>();
    const failure = new Error("intro unavailable");
    jest.mocked(secureStorage.getItem).mockImplementation(async (key) => (
      key === "himu.intro.v2" ? blockedRead.promise : values.get(key) ?? null
    ));

    const introRead = introStateStore.isSeen(2);
    await expect(pendingIntentStore.writeFirstTrack(NOW)).resolves.toBeUndefined();
    blockedRead.reject(failure);
    await expect(introRead).rejects.toThrow(failure);
    await expect(pendingIntentStore.read(NOW)).resolves.toEqual(firstTrackIntent());
  });

  it.each([NaN, Infinity, -Infinity])("rejects an invalid writer timestamp: %p", async (timestamp) => {
    await expect(pendingIntentStore.writeFirstTrack(timestamp)).rejects.toThrow(TypeError);
    await expect(pendingIntentStore.read(NOW)).resolves.toBeNull();
  });

  it.each([NaN, Infinity, -Infinity])("rejects an invalid injected clock without deleting or consuming a valid intent: %p", async (nowMs) => {
    await pendingIntentStore.writeFirstTrack(NOW);

    await expect(pendingIntentStore.read(nowMs)).rejects.toThrow(TypeError);
    await expect(pendingIntentStore.consume("first_track", nowMs)).rejects.toThrow(TypeError);
    await expect(pendingIntentStore.read(NOW)).resolves.toEqual(firstTrackIntent());
  });

  it("exports runtime and type contracts through the experience barrel", () => {
    const intent: PendingNavigationIntent = firstTrackIntent();
    const firstTrack: FirstTrackReturnIntent = intent;
    const state: ExperienceState = {
      introVersionSeen: PUBLIC_INTRO_VERSION,
      firstOwnedTrackId: null,
      firstOwnedTrackReadyAt: null,
      preferenceNudgeStatus: "ineligible",
      preferenceNudgeTrackId: null,
    };

    expect(publicIntroStateStore).toBe(introStateStore);
    expect(publicPendingIntentStore).toBe(pendingIntentStore);
    expect(PUBLIC_INTRO_VERSION).toBe(2);
    expect(firstTrack.kind).toBe("first_track");
    expect(state.introVersionSeen).toBe(2);
  });
});
