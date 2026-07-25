import { secureStorage } from "@/src/lib/secure-storage";
import {
  loadOnboardingRecord,
  onboardingStorageKey,
  saveOnboardingRecord,
} from "../onboarding-storage";
import type { OnboardingRecord } from "../types";

jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const record = (overrides: Partial<OnboardingRecord> = {}): OnboardingRecord => ({
  userId: "user-1",
  version: 1,
  status: "in_progress",
  lastStep: "home.daily-drop",
  startedAt: "2026-07-16T10:00:00.000Z",
  completedAt: null,
  skippedAt: null,
  firstPlayAt: null,
  contextualTips: {},
  replayCount: 0,
  lastReplayedAt: null,
  updatedAt: "2026-07-16T10:00:00.000Z",
  ...overrides,
});

describe("onboarding storage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes its key by user and version", () => {
    expect(onboardingStorageKey("user-1", 2)).toBe(
      "himu:onboarding:user-1:v2",
    );
  });

  it("round-trips a versioned record through secure storage", async () => {
    const saved = record();
    let serialized: string | undefined;
    jest.mocked(secureStorage.setItem).mockImplementation(async (_key, value) => {
      serialized = value;
    });
    jest.mocked(secureStorage.getItem).mockImplementation(async () => serialized ?? null);

    await saveOnboardingRecord(saved);
    await expect(loadOnboardingRecord(saved.userId, saved.version)).resolves.toEqual(saved);
    expect(secureStorage.setItem).toHaveBeenCalledWith(
      onboardingStorageKey(saved.userId, saved.version),
      JSON.stringify(saved),
    );
  });

  it("normalizes offset timestamps at the SecureStore boundary", async () => {
    const saved = record({
      startedAt: "2026-07-16T10:00:00+02:00",
      updatedAt: "2026-07-16T10:05:00+02:00",
      contextualTips: { "discover.search": "2026-07-16T09:30:00+02:00" },
    });
    let serialized: string | undefined;
    jest.mocked(secureStorage.setItem).mockImplementation(async (_key, value) => {
      serialized = value;
    });
    jest.mocked(secureStorage.getItem).mockImplementation(async () => serialized ?? null);

    await saveOnboardingRecord(saved);

    expect(JSON.parse(serialized!)).toMatchObject({
      startedAt: "2026-07-16T08:00:00.000Z",
      updatedAt: "2026-07-16T08:05:00.000Z",
      contextualTips: { "discover.search": "2026-07-16T07:30:00.000Z" },
    });
    await expect(loadOnboardingRecord("user-1", 1)).resolves.toMatchObject({
      startedAt: "2026-07-16T08:00:00.000Z",
      updatedAt: "2026-07-16T08:05:00.000Z",
    });
  });

  it.each([
    ["malformed JSON", "{"],
    ["wrong version", JSON.stringify(record({ version: 2 }))],
    ["wrong user", JSON.stringify(record({ userId: "user-2" }))],
    ["invalid record", JSON.stringify({ userId: "user-1", version: 1 })],
    [
      "an invalid lifecycle",
      JSON.stringify(record({ status: "completed", completedAt: null })),
    ],
    [
      "an invalid required timestamp",
      JSON.stringify(record({ updatedAt: "yesterday" })),
    ],
    [
      "an invalid contextual tip timestamp",
      JSON.stringify(
        record({ contextualTips: { "discover.search": "2026-07-16 10:00:00" } }),
      ),
    ],
  ])("ignores %s local data", async (_case, value) => {
    jest.mocked(secureStorage.getItem).mockResolvedValue(value);

    await expect(loadOnboardingRecord("user-1", 1)).resolves.toBeNull();
  });
});
