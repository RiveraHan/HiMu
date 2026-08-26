import { secureStorage } from "@/src/lib/secure-storage";
import {
  introStateStore,
  pendingIntentStore,
} from "../pending-intent";

jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const NOW = 1_777_000_000_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const firstTrackIntent = (createdAt = NOW) => ({
  version: 1,
  kind: "first_track",
  source: "public_intro_v2",
  createdAt: new Date(createdAt).toISOString(),
});

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
    ["a future timestamp", JSON.stringify({ ...firstTrackIntent(), createdAt: new Date(NOW + 1).toISOString() })],
    ["another intent kind", JSON.stringify({ ...firstTrackIntent(), kind: "other" })],
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
});
