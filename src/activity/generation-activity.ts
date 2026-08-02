import type {
  ActivityItem,
  ActivityStatus,
  GenerationJobRow,
} from "@/src/activity/types";
import type { Visibility } from "@/src/types/content-visibility";

const MIX_SLOW_MS = 90_000;
const MANUAL_JOB_RECOVERY_MS = 15 * 60_000;

type GenerationJobStatus = "queued" | "generating" | "ready" | "failed";

function isGenerationJobStatus(value: string): value is GenerationJobStatus {
  switch (value) {
    case "queued":
    case "generating":
    case "ready":
    case "failed":
      return true;
    default:
      return false;
  }
}

function validTimestamp(value: string, fallback: string): string {
  return Number.isFinite(Date.parse(value)) ? value : fallback;
}

export function normalizeGenerationJob(
  row: GenerationJobRow,
  nowMs: number,
): ActivityItem | null {
  if (row.drop_date !== null || !isGenerationJobStatus(row.status)) {
    return null;
  }

  const rawStatus = row.status;
  const fallback = new Date(nowMs).toISOString();
  const createdAt = validTimestamp(row.created_at, fallback);
  const updatedAt = validTimestamp(row.updated_at, createdAt);
  const ageMs = nowMs - Date.parse(createdAt);
  const staleMs = nowMs - Date.parse(updatedAt);
  const active = rawStatus === "queued" || rawStatus === "generating";
  const recoveryAvailable = active && staleMs > MANUAL_JOB_RECOVERY_MS;
  const malformedReady = rawStatus === "ready" && !row.track_id;

  let status: ActivityStatus;
  if (malformedReady) {
    status = "failed";
  } else if (rawStatus === "queued") {
    status = ageMs > MIX_SLOW_MS ? "slow" : "queued";
  } else if (rawStatus === "generating") {
    status = ageMs > MIX_SLOW_MS ? "slow" : "running";
  } else {
    status = rawStatus;
  }

  return {
    id: `generation:${row.id}`,
    source: "server",
    kind: "mix",
    status,
    title: row.djs?.name ?? "HiMu DJ",
    djId: row.dj_id,
    trackId: row.track_id,
    createdAt,
    updatedAt,
    error: row.error,
    failureReason:
      rawStatus === "failed" && row.error === "generation_stalled"
        ? "stalled"
        : rawStatus === "failed" || malformedReady
          ? "generationFailed"
          : null,
    recoveryAvailable,
    retryLyrics: row.prompt,
    visibility: row.is_public ? "public" : "private",
    detail: null,
    seen: false,
  };
}

export function upsertQueuedGenerationActivity(
  current: ActivityItem[] | undefined,
  input: {
    jobId: string;
    djId: string;
    title: string;
    retryLyrics: string | null;
    visibility: Visibility;
    nowMs: number;
    replaceActivityId?: string;
  },
): ActivityItem[] {
  const id = `generation:${input.jobId}`;
  const items = (current ?? []).filter(
    (item) =>
      item.id !== input.replaceActivityId || input.replaceActivityId === id,
  );
  const existing = items.find((item) => item.id === id);
  const now = new Date(input.nowMs).toISOString();

  if (existing && existing.status !== "failed") {
    if (!existing.recoveryAvailable) {
      return items;
    }

    return items.map((item) =>
      item.id === id
        ? { ...item, recoveryAvailable: false, updatedAt: now }
        : item,
    );
  }

  const queued: ActivityItem = {
    id,
    source: "server",
    kind: "mix",
    status: "queued",
    title: input.title,
    djId: input.djId,
    trackId: null,
    createdAt: now,
    updatedAt: now,
    error: null,
    failureReason: null,
    recoveryAvailable: false,
    retryLyrics: input.retryLyrics,
    visibility: input.visibility,
    detail: null,
    seen: false,
  };

  return [queued, ...items.filter((item) => item.id !== id)];
}

function compareUpdatedAtThenId(a: ActivityItem, b: ActivityItem): number {
  const updatedDifference = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  return updatedDifference || a.id.localeCompare(b.id);
}

function primaryPriority(item: ActivityItem): number {
  if (item.status === "failed" && !item.seen) return 0;
  if (item.status === "ready" && !item.seen) return 1;
  if (item.status === "slow") return 2;
  if (item.status === "running") return 3;
  if (item.status === "queued") return 4;
  if (item.status === "ready") return 5;
  return 6;
}

export function primaryActivity(
  activities: ActivityItem[],
): ActivityItem | undefined {
  return [...activities].sort((a, b) => {
    const priorityDifference = primaryPriority(a) - primaryPriority(b);
    return priorityDifference || compareUpdatedAtThenId(a, b);
  })[0];
}

function panelPriority(item: ActivityItem): number {
  if (item.status === "slow") return 0;
  if (item.status === "running") return 1;
  if (item.status === "queued") return 2;
  if (item.status === "ready" && !item.seen) return 3;
  if (item.status === "failed" && !item.seen) return 4;
  if (item.status === "ready") return 5;
  return 6;
}

export function sortPanelActivities(
  activities: ActivityItem[],
): ActivityItem[] {
  return [...activities].sort((a, b) => {
    const priorityDifference = panelPriority(a) - panelPriority(b);
    return priorityDifference || compareUpdatedAtThenId(a, b);
  });
}
