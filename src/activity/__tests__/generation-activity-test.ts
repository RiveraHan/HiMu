import {
  normalizeGenerationJob,
  primaryActivity,
  sortPanelActivities,
  upsertQueuedGenerationActivity,
} from "@/src/activity/generation-activity";
import type {
  ActivityItem,
  GenerationJobRow,
} from "@/src/activity/types";

const CREATED_AT = "2026-07-29T12:00:00.000Z";

const base: GenerationJobRow = {
  id: "job-1",
  user_id: "user-1",
  dj_id: "dj-1",
  status: "generating",
  prompt: null,
  error: null,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
  drop_date: null,
  track_id: null,
  is_public: false,
  djs: { id: "dj-1", name: "Nova" },
  tracks: null,
};

const activity: ActivityItem = {
  id: "base",
  source: "server",
  kind: "mix",
  status: "queued",
  title: "Nova",
  djId: "dj-1",
  trackId: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  error: null,
  failureReason: null,
  recoveryAvailable: false,
  retryLyrics: null,
  visibility: "private",
  detail: null,
  seen: false,
};

describe("normalizeGenerationJob", () => {
  it("normalizes a manual generating job into a running mix", () => {
    expect(
      normalizeGenerationJob(base, Date.parse("2026-07-29T12:01:29.000Z")),
    ).toMatchObject({
      id: "generation:job-1",
      source: "server",
      status: "running",
      kind: "mix",
      title: "Nova",
      djId: "dj-1",
      retryLyrics: null,
    });
  });

  it("keeps a generating job running at exactly the 90-second boundary", () => {
    expect(
      normalizeGenerationJob(base, Date.parse("2026-07-29T12:01:30.000Z")),
    ).toMatchObject({ status: "running", recoveryAvailable: false });
  });

  it("marks a generating job slow only after the 90-second boundary", () => {
    expect(
      normalizeGenerationJob(base, Date.parse("2026-07-29T12:01:30.001Z")),
    ).toMatchObject({ status: "slow", recoveryAvailable: false });
  });

  it("keeps recovery unavailable at exactly the 15-minute lease boundary", () => {
    expect(
      normalizeGenerationJob(base, Date.parse("2026-07-29T12:15:00.000Z")),
    ).toMatchObject({
      status: "slow",
      recoveryAvailable: false,
      failureReason: null,
    });
  });

  it("offers recovery after the lease without declaring an active row failed", () => {
    expect(
      normalizeGenerationJob(base, Date.parse("2026-07-29T12:15:00.001Z")),
    ).toMatchObject({
      status: "slow",
      recoveryAvailable: true,
      failureReason: null,
    });
  });

  it("excludes Daily Drop jobs", () => {
    expect(
      normalizeGenerationJob(
        { ...base, drop_date: "2026-07-29" },
        Date.parse(CREATED_AT),
      ),
    ).toBeNull();
  });

  it("rejects an unexpected raw server status", () => {
    expect(
      normalizeGenerationJob(
        { ...base, status: "unexpected-provider-state" },
        Date.parse(CREATED_AT),
      ),
    ).toBeNull();
  });

  it("maps ready jobs without a track to a safe failure", () => {
    expect(
      normalizeGenerationJob(
        { ...base, status: "ready", track_id: null },
        Date.parse(CREATED_AT),
      ),
    ).toMatchObject({
      status: "failed",
      failureReason: "generationFailed",
      recoveryAvailable: false,
    });
  });

  it("maps a stalled raw failure to the stalled presentation reason", () => {
    expect(
      normalizeGenerationJob(
        { ...base, status: "failed", error: "generation_stalled" },
        Date.parse(CREATED_AT),
      ),
    ).toMatchObject({
      status: "failed",
      error: "generation_stalled",
      failureReason: "stalled",
    });
  });

  it("maps every other raw failure to a safe presentation reason", () => {
    const rawError = "provider secret: upstream stack trace";
    const result = normalizeGenerationJob(
      { ...base, status: "failed", error: rawError },
      Date.parse(CREATED_AT),
    );

    expect(result).toMatchObject({
      status: "failed",
      error: rawError,
      failureReason: "generationFailed",
    });
    expect(result?.failureReason).not.toContain(rawError);
    expect(result?.title).not.toContain(rawError);
  });

  it("normalizes persisted private and public visibility", () => {
    expect(normalizeGenerationJob(base, Date.parse(CREATED_AT))).toMatchObject({
      visibility: "private",
    });
    expect(
      normalizeGenerationJob(
        { ...base, is_public: true },
        Date.parse(CREATED_AT),
      ),
    ).toMatchObject({ visibility: "public" });
  });

  it("falls back deterministically when database timestamps are invalid", () => {
    expect(
      normalizeGenerationJob(
        {
          ...base,
          created_at: null,
          updated_at: null,
        } as unknown as GenerationJobRow,
        Date.parse(CREATED_AT),
      ),
    ).toMatchObject({
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
  });

  it("uses the validated created timestamp when only updated_at is invalid", () => {
    expect(
      normalizeGenerationJob(
        {
          ...base,
          created_at: "2026-07-29T11:59:00.000Z",
          updated_at: "not-an-iso-date",
        },
        Date.parse(CREATED_AT),
      ),
    ).toMatchObject({
      createdAt: "2026-07-29T11:59:00.000Z",
      updatedAt: "2026-07-29T11:59:00.000Z",
    });
  });
});

describe("upsertQueuedGenerationActivity", () => {
  const input = {
    jobId: "job-1",
    djId: "dj-1",
    title: "Nova",
    retryLyrics: "midnight pulse",
    nowMs: Date.parse("2026-07-29T12:05:00.000Z"),
    visibility: "public" as const,
  };

  it("adds a server-confirmed queued job to an undefined cache", () => {
    expect(upsertQueuedGenerationActivity(undefined, input)).toEqual([
      {
        ...activity,
        id: "generation:job-1",
        retryLyrics: "midnight pulse",
        visibility: "public",
        createdAt: "2026-07-29T12:05:00.000Z",
        updatedAt: "2026-07-29T12:05:00.000Z",
      },
    ]);
  });

  it("preserves a same-ID running item instead of downgrading it", () => {
    const running = {
      ...activity,
      id: "generation:job-1",
      status: "running" as const,
    };

    expect(upsertQueuedGenerationActivity([running], input)).toEqual([running]);
  });

  it("clears recovery and refreshes time without changing slow presentation", () => {
    const recoverable = {
      ...activity,
      id: "generation:job-1",
      status: "slow" as const,
      recoveryAvailable: true,
    };

    expect(upsertQueuedGenerationActivity([recoverable], input)).toEqual([
      {
        ...recoverable,
        status: "slow",
        recoveryAvailable: false,
        updatedAt: "2026-07-29T12:05:00.000Z",
      },
    ]);
  });

  it("replaces a completed mutation activity when the server confirms a job", () => {
    const mutation = {
      ...activity,
      id: "mutation:create-dj",
      source: "mutation" as const,
      kind: "create-dj" as const,
      status: "ready" as const,
    };

    expect(
      upsertQueuedGenerationActivity([mutation], {
        ...input,
        replaceActivityId: mutation.id,
      }).map(({ id }) => id),
    ).toEqual(["generation:job-1"]);
  });
});

describe("activity priority", () => {
  it("selects unseen failed before ready and active activities", () => {
    expect(
      primaryActivity([
        { ...activity, id: "running", status: "running" },
        { ...activity, id: "ready", status: "ready" },
        { ...activity, id: "failed", status: "failed" },
      ])?.id,
    ).toBe("failed");
  });

  it("sorts active panel activities before unseen ready activities", () => {
    expect(
      sortPanelActivities([
        { ...activity, id: "ready", status: "ready" },
        { ...activity, id: "active", status: "running" },
      ]).map(({ id }) => id),
    ).toEqual(["active", "ready"]);
  });

  it("sorts newer activities first within the same priority", () => {
    expect(
      sortPanelActivities([
        {
          ...activity,
          id: "older",
          status: "running",
          updatedAt: "2026-07-29T12:00:00.000Z",
        },
        {
          ...activity,
          id: "newer",
          status: "running",
          updatedAt: "2026-07-29T12:01:00.000Z",
        },
      ]).map(({ id }) => id),
    ).toEqual(["newer", "older"]);
  });

  it("uses ascending ID as the final tie-breaker", () => {
    expect(
      sortPanelActivities([
        { ...activity, id: "generation:z", status: "running" },
        { ...activity, id: "generation:a", status: "running" },
      ]).map(({ id }) => id),
    ).toEqual(["generation:a", "generation:z"]);
  });
});
