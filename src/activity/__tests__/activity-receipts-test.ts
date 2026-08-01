import * as SecureStore from "expo-secure-store";
import {
  createActivityReceiptStore,
  markNotified,
  markSeen,
  pruneActivityReceipts,
  type ActivityReceipts,
} from "../activity-receipts";
import { secureStorage } from "../../lib/secure-storage";

const mockSecureStoreValues = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreValues.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreValues.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreValues.delete(key);
  }),
}));

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const NOW_ISO = "2026-07-29T12:00:00.000Z";
const STORAGE_KEY = "activity-receipts.user-1";

describe("activity receipt pruning", () => {
  it("keeps only the 100 newest receipts", () => {
    const receipts = Object.fromEntries(
      Array.from({ length: 105 }, (_, index) => [
        `job-${index}`,
        {
          notifiedAt: new Date(NOW - index * 1000).toISOString(),
          seenAt: null,
        },
      ]),
    );

    const pruned = pruneActivityReceipts(receipts, NOW);

    expect(Object.keys(pruned)).toHaveLength(100);
    expect(Object.keys(pruned).sort()).toEqual(
      Array.from({ length: 100 }, (_, index) => `job-${index}`).sort(),
    );
  });

  it("removes receipts older than seven days", () => {
    expect(
      pruneActivityReceipts(
        {
          old: {
            notifiedAt: "2026-07-20T00:00:00.000Z",
            seenAt: null,
          },
        },
        NOW,
      ),
    ).toEqual({});
  });

  it("keeps the exact seven-day boundary and removes one millisecond older", () => {
    const boundary = new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString();
    const older = new Date(NOW - 7 * 24 * 60 * 60 * 1000 - 1).toISOString();

    expect(
      pruneActivityReceipts(
        {
          boundary: { notifiedAt: boundary, seenAt: null },
          older: { notifiedAt: older, seenAt: null },
        },
        NOW,
      ),
    ).toEqual({
      boundary: { notifiedAt: boundary, seenAt: null },
    });
  });
});

describe("activity receipt transitions", () => {
  it("preserves seenAt when a receipt is marked notified again", () => {
    const receipts: ActivityReceipts = {
      "job-1": {
        notifiedAt: "2026-07-29T10:00:00.000Z",
        seenAt: "2026-07-29T11:00:00.000Z",
      },
    };

    expect(markNotified(receipts, "job-1", NOW)).toEqual({
      "job-1": {
        notifiedAt: NOW_ISO,
        seenAt: "2026-07-29T11:00:00.000Z",
      },
    });
  });

  it("creates notifiedAt when an unseen receipt is marked seen", () => {
    expect(markSeen({}, "job-1", NOW)).toEqual({
      "job-1": {
        notifiedAt: NOW_ISO,
        seenAt: NOW_ISO,
      },
    });
  });
});

describe("activity receipt storage", () => {
  beforeEach(() => {
    mockSecureStoreValues.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("loads an empty map when storage has no JSON", async () => {
    jest.spyOn(secureStorage, "getItem").mockResolvedValue(null);

    const store = createActivityReceiptStore("user-1");

    await expect(store.load(NOW)).resolves.toEqual({});
    expect(secureStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it.each([
    ["malformed JSON", "{"],
    ["an array", JSON.stringify([])],
    [
      "a wrong-shaped receipt",
      JSON.stringify({ "job-1": { notifiedAt: 42, seenAt: null } }),
    ],
  ])("loads an empty map and logs %s", async (_description, raw) => {
    jest.spyOn(secureStorage, "getItem").mockResolvedValue(raw);
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const store = createActivityReceiptStore("user-1");

    await expect(store.load(NOW)).resolves.toEqual({});
    expect(log).toHaveBeenCalled();
  });

  it("loads an empty map and logs a rejected storage read", async () => {
    jest
      .spyOn(secureStorage, "getItem")
      .mockRejectedValue(new Error("read unavailable"));
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const store = createActivityReceiptStore("user-1");

    await expect(store.load(NOW)).resolves.toEqual({});
    expect(log).toHaveBeenCalled();
  });

  it("serializes concurrent updates and persists both changes", async () => {
    jest.spyOn(secureStorage, "getItem").mockResolvedValue(null);
    let releaseFirstSave: (() => void) | undefined;
    const firstSaveBlocked = new Promise<void>((resolve) => {
      releaseFirstSave = resolve;
    });
    const savedValues: string[] = [];
    jest
      .spyOn(secureStorage, "setItem")
      .mockImplementationOnce(async (_key, value) => {
        savedValues.push(value);
        await firstSaveBlocked;
      })
      .mockImplementation(async (_key, value) => {
        savedValues.push(value);
      });
    const store = createActivityReceiptStore("user-1");
    await store.load(NOW);

    const first = store.update(
      (receipts) => markNotified(receipts, "job-1", NOW),
      NOW,
    );
    const second = store.update(
      (receipts) => markNotified(receipts, "job-2", NOW + 1),
      NOW + 1,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(secureStorage.setItem).toHaveBeenCalledTimes(1);
    releaseFirstSave?.();
    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        "job-1": { notifiedAt: NOW_ISO, seenAt: null },
      },
      {
        "job-1": { notifiedAt: NOW_ISO, seenAt: null },
        "job-2": {
          notifiedAt: "2026-07-29T12:00:00.001Z",
          seenAt: null,
        },
      },
    ]);
    expect(JSON.parse(savedValues.at(-1) ?? "null")).toEqual({
      "job-1": { notifiedAt: NOW_ISO, seenAt: null },
      "job-2": {
        notifiedAt: "2026-07-29T12:00:00.001Z",
        seenAt: null,
      },
    });
  });

  it("keeps UI state usable and continues after a rejected save", async () => {
    jest.spyOn(secureStorage, "getItem").mockResolvedValue(null);
    const save = jest
      .spyOn(secureStorage, "setItem")
      .mockRejectedValueOnce(new Error("write unavailable"))
      .mockResolvedValue(undefined);
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const store = createActivityReceiptStore("user-1");
    await store.load(NOW);

    await expect(
      store.update(
        (receipts) => markNotified(receipts, "job-1", NOW),
        NOW,
      ),
    ).resolves.toEqual({
      "job-1": { notifiedAt: NOW_ISO, seenAt: null },
    });
    await expect(
      store.update(
        (receipts) => markSeen(receipts, "job-2", NOW + 1),
        NOW + 1,
      ),
    ).resolves.toEqual({
      "job-1": { notifiedAt: NOW_ISO, seenAt: null },
      "job-2": {
        notifiedAt: "2026-07-29T12:00:00.001Z",
        seenAt: "2026-07-29T12:00:00.001Z",
      },
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalled();
    expect(JSON.parse(save.mock.calls[1][1])).toHaveProperty("job-1");
    expect(JSON.parse(save.mock.calls[1][1])).toHaveProperty("job-2");
  });

  it("persists a pruned map", async () => {
    const receipts = Object.fromEntries(
      Array.from({ length: 105 }, (_, index) => [
        `job-${index}`,
        {
          notifiedAt: new Date(NOW - index * 1000).toISOString(),
          seenAt: null,
        },
      ]),
    );
    jest
      .spyOn(secureStorage, "getItem")
      .mockResolvedValue(JSON.stringify(receipts));
    const save = jest
      .spyOn(secureStorage, "setItem")
      .mockResolvedValue(undefined);
    const store = createActivityReceiptStore("user-1");
    await store.load(NOW);

    await store.update((current) => current, NOW);

    expect(Object.keys(JSON.parse(save.mock.calls[0][1]))).toHaveLength(100);
  });

  it("uses only Expo SecureStore-safe generated chunk keys", async () => {
    const store = createActivityReceiptStore(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    await store.load(NOW);

    await store.update(
      (receipts) => markNotified(receipts, "job-1", NOW),
      NOW,
    );

    const touchedKeys = [
      ...jest.mocked(SecureStore.getItemAsync).mock.calls,
      ...jest.mocked(SecureStore.setItemAsync).mock.calls,
      ...jest.mocked(SecureStore.deleteItemAsync).mock.calls,
    ].map(([key]) => key);

    expect(touchedKeys.length).toBeGreaterThan(0);
    expect(touchedKeys.every((key) => /^[\w.-]+$/.test(key))).toBe(true);
  });
});
