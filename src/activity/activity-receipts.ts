import { secureStorage } from "@/src/lib/secure-storage";

export type ActivityReceipt = {
  notifiedAt: string;
  seenAt: string | null;
};

export type ActivityReceipts = Record<string, ActivityReceipt>;

const MAX_RECEIPTS = 100;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const storageKey = (userId: string) => `activity-receipts.${userId}`;

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isActivityReceipts(value: unknown): value is ActivityReceipts {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((receipt) => {
    if (
      receipt === null ||
      typeof receipt !== "object" ||
      Array.isArray(receipt)
    ) {
      return false;
    }

    const candidate = receipt as Record<string, unknown>;
    return (
      isValidTimestamp(candidate.notifiedAt) &&
      (candidate.seenAt === null || isValidTimestamp(candidate.seenAt))
    );
  });
}

function receiptTimestamp(receipt: ActivityReceipt): number {
  return Math.max(
    Date.parse(receipt.notifiedAt),
    receipt.seenAt === null ? Number.NEGATIVE_INFINITY : Date.parse(receipt.seenAt),
  );
}

export function pruneActivityReceipts(
  receipts: ActivityReceipts,
  nowMs: number,
): ActivityReceipts {
  const oldestRetainedAt = nowMs - RETENTION_MS;

  return Object.fromEntries(
    Object.entries(receipts)
      .filter(([, receipt]) => receiptTimestamp(receipt) >= oldestRetainedAt)
      .sort(([, left], [, right]) => receiptTimestamp(right) - receiptTimestamp(left))
      .slice(0, MAX_RECEIPTS),
  );
}

export function markNotified(
  receipts: ActivityReceipts,
  activityId: string,
  nowMs: number,
): ActivityReceipts {
  return {
    ...receipts,
    [activityId]: {
      notifiedAt: new Date(nowMs).toISOString(),
      seenAt: receipts[activityId]?.seenAt ?? null,
    },
  };
}

export function markSeen(
  receipts: ActivityReceipts,
  activityId: string,
  nowMs: number,
): ActivityReceipts {
  const timestamp = new Date(nowMs).toISOString();

  return {
    ...receipts,
    [activityId]: {
      notifiedAt: receipts[activityId]?.notifiedAt ?? timestamp,
      seenAt: timestamp,
    },
  };
}

async function loadActivityReceipts(userId: string): Promise<ActivityReceipts> {
  try {
    const serialized = await secureStorage.getItem(storageKey(userId));
    if (serialized === null) return {};

    const parsed: unknown = JSON.parse(serialized);
    if (!isActivityReceipts(parsed)) {
      throw new Error("Stored activity receipts have an invalid shape");
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load activity receipts", error);
    return {};
  }
}

async function saveActivityReceipts(
  userId: string,
  receipts: ActivityReceipts,
  nowMs: number,
): Promise<void> {
  const pruned = pruneActivityReceipts(receipts, nowMs);

  try {
    await secureStorage.setItem(storageKey(userId), JSON.stringify(pruned));
  } catch (error) {
    console.error("Failed to save activity receipts", error);
  }
}

type ReceiptUpdater = (receipts: ActivityReceipts) => ActivityReceipts;

export function createActivityReceiptStore(userId: string) {
  let current: ActivityReceipts = {};
  let updateChain: Promise<unknown> = loadActivityReceipts(userId).then(
    (loaded) => {
      current = loaded;
    },
  );

  return {
    async load(nowMs = Date.now()): Promise<ActivityReceipts> {
      await updateChain;
      current = pruneActivityReceipts(current, nowMs);
      return current;
    },

    update(
      updater: ReceiptUpdater,
      nowMs = Date.now(),
    ): Promise<ActivityReceipts> {
      const update = updateChain.catch(() => undefined).then(async () => {
        current = pruneActivityReceipts(updater(current), nowMs);
        await saveActivityReceipts(userId, current, nowMs);
        return current;
      });

      updateChain = update.then(
        () => undefined,
        () => undefined,
      );
      return update;
    },
  };
}
