import { reconcileOnboarding } from "../reconcile-onboarding";
import type { OnboardingRecord, OnboardingStatus } from "../types";

const record = (
  status: OnboardingStatus,
  overrides: Partial<OnboardingRecord> = {},
): OnboardingRecord => ({
  userId: "user-1",
  version: 1,
  status,
  lastStep: null,
  startedAt: "2026-07-16T10:00:00.000Z",
  completedAt: status === "completed" ? "2026-07-16T10:05:00.000Z" : null,
  skippedAt: status === "skipped" ? "2026-07-16T10:05:00.000Z" : null,
  firstPlayAt: null,
  contextualTips: {},
  replayCount: 0,
  lastReplayedAt: null,
  updatedAt: "2026-07-16T10:05:00.000Z",
  ...overrides,
});

describe("reconcileOnboarding", () => {
  it.each([
    ["completed", "in_progress", "completed"],
    ["skipped", "in_progress", "skipped"],
    ["in_progress", "completed", "completed"],
  ] as const)("never regresses %s against %s", (local, server, expected) => {
    expect(reconcileOnboarding(record(local), record(server))?.status).toBe(expected);
  });

  it("uses updatedAt only when lifecycle precedence is equal", () => {
    const older = record("in_progress", {
      lastStep: "older",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    const newer = record("in_progress", {
      lastStep: "newer",
      updatedAt: "2026-07-16T11:00:00.000Z",
    });

    expect(reconcileOnboarding(older, newer)?.lastStep).toBe("newer");
    expect(
      reconcileOnboarding(
        record("completed", { updatedAt: older.updatedAt }),
        record("skipped", { updatedAt: newer.updatedAt }),
      )?.status,
    ).toBe("completed");
  });

  it("compares offset timestamps by epoch rather than text", () => {
    const chronologicallyOlder = record("in_progress", {
      lastStep: "older",
      updatedAt: "2026-07-16T10:00:00+02:00",
    });
    const chronologicallyNewer = record("in_progress", {
      lastStep: "newer",
      updatedAt: "2026-07-16T09:00:00Z",
    });

    expect(
      reconcileOnboarding(chronologicallyOlder, chronologicallyNewer)?.lastStep,
    ).toBe("newer");
  });

  it("treats equivalent offset timestamps as the same instant", () => {
    const offset = record("in_progress", {
      lastStep: "local",
      updatedAt: "2026-07-16T10:00:00+02:00",
    });
    const utc = record("in_progress", {
      lastStep: "server",
      updatedAt: "2026-07-16T08:00:00Z",
    });

    expect(reconcileOnboarding(offset, utc)?.lastStep).toBe("server");
  });

  it("returns unknown when neither server nor local state exists and eligibility is unresolved", () => {
    expect(reconcileOnboarding(null, null)).toBeUndefined();
  });

  it("merges tip timestamps by earliest sighting and keeps maximum replay count", () => {
    const local = record("in_progress", {
      contextualTips: {
        "discover.search": "2026-07-16T10:30:00.000Z",
        "dj.hero": "2026-07-16T10:15:00.000Z",
      },
      replayCount: 3,
    });
    const server = record("in_progress", {
      contextualTips: { "discover.search": "2026-07-16T10:10:00.000Z" },
      replayCount: 1,
      updatedAt: "2026-07-16T11:00:00.000Z",
    });

    expect(reconcileOnboarding(local, server)).toMatchObject({
      contextualTips: {
        "discover.search": "2026-07-16T10:10:00.000Z",
        "dj.hero": "2026-07-16T10:15:00.000Z",
      },
      replayCount: 3,
    });
  });

  it.each([
    [null, "2026-07-16T10:00:00Z", "2026-07-16T10:00:00.000Z"],
    ["2026-07-16T12:00:00+02:00", null, "2026-07-16T10:00:00.000Z"],
    ["2026-07-16T09:30:00Z", "2026-07-16T11:00:00+01:00", "2026-07-16T10:00:00.000Z"],
    ["2026-07-16T11:00:00Z", "2026-07-16T10:00:00Z", "2026-07-16T11:00:00.000Z"],
  ])("merges lastReplayedAt independently to the latest instant", (localAt, serverAt, expected) => {
    const local = record("completed", { replayCount: 1, lastReplayedAt: localAt });
    const server = record("completed", { replayCount: 2, lastReplayedAt: serverAt });
    expect(reconcileOnboarding(local, server)).toMatchObject({
      replayCount: 2,
      lastReplayedAt: expected,
    });
  });

  it("compares and normalizes tip timestamps with offsets", () => {
    const local = record("in_progress", {
      contextualTips: { "discover.search": "2026-07-16T10:00:00+02:00" },
    });
    const server = record("in_progress", {
      contextualTips: { "discover.search": "2026-07-16T08:30:00Z" },
    });

    expect(reconcileOnboarding(local, server)?.contextualTips).toEqual({
      "discover.search": "2026-07-16T08:00:00.000Z",
    });
  });

  it.each([
    ["updatedAt", record("in_progress", { updatedAt: "not-a-date" })],
    [
      "contextual tip",
      record("in_progress", {
        contextualTips: { "discover.search": "2026-07-16 10:00:00" },
      }),
    ],
  ])("rejects an invalid %s", (_field, invalid) => {
    expect(() => reconcileOnboarding(invalid, record("in_progress"))).toThrow(
      /timestamp/i,
    );
  });

  it("returns the available record when only one persistence layer has state", () => {
    const local = record("in_progress");
    expect(reconcileOnboarding(local, null)).toEqual(local);
    expect(reconcileOnboarding(null, local)).toEqual(local);
  });
});
