import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import {
  loadOnboardingRecord,
  saveOnboardingRecord,
} from "@/src/onboarding/onboarding-storage";
import { reconcileOnboarding } from "@/src/onboarding/reconcile-onboarding";
import { normalizeOnboardingTimestamps } from "@/src/onboarding/timestamps";
import type {
  ContextualTipId,
  OnboardingRecord,
  OnboardingStatus,
} from "@/src/onboarding/types";
import { useCurrentUser } from "./use-auth";

import type { OnboardingDatabase } from "@/src/types/onboarding-database";
import {
  type AuthScope,
  assertCurrentMutationUser,
  authMutationKey,
  captureAuthScope,
  setAuthScopeHeader,
} from "@/src/api/auth-scope";

type OnboardingRow = OnboardingDatabase["public"]["Tables"]["user_onboarding"]["Row"];

type OnboardingInsert = Omit<OnboardingRow, "contextual_tips"> & {
  contextual_tips: OnboardingRecord["contextualTips"];
};

const ONBOARDING_COLUMNS =
  "user_id, version, status, last_step, started_at, completed_at, skipped_at, first_play_at, contextual_tips, replay_count, last_replayed_at, updated_at";
const STATUSES: readonly OnboardingStatus[] = [
  "in_progress",
  "completed",
  "skipped",
];
const TIP_IDS: readonly ContextualTipId[] = ["discover.search", "dj.hero"];

function mapContextualTips(
  value: unknown,
): OnboardingRecord["contextualTips"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid timestamp map for contextualTips");
  }

  const result: OnboardingRecord["contextualTips"] = {};
  for (const tipId of TIP_IDS) {
    const timestamps = value as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(timestamps, tipId)) continue;
    const timestamp = timestamps[tipId];
    if (typeof timestamp !== "string") {
      throw new Error(`Invalid timestamp for contextualTips.${tipId}`);
    }
    result[tipId] = timestamp;
  }
  return result;
}

function mapOnboardingRow(row: OnboardingRow): OnboardingRecord {
  if (!STATUSES.includes(row.status as OnboardingStatus)) {
    throw new Error(`Invalid onboarding status: ${row.status}`);
  }

  return normalizeOnboardingTimestamps({
    userId: row.user_id,
    version: row.version,
    status: row.status as OnboardingStatus,
    lastStep: row.last_step,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    skippedAt: row.skipped_at,
    firstPlayAt: row.first_play_at,
    contextualTips: mapContextualTips(row.contextual_tips),
    replayCount: row.replay_count,
    lastReplayedAt: row.last_replayed_at,
    updatedAt: row.updated_at,
  });
}

function mapOnboardingInsert(record: OnboardingRecord): OnboardingInsert {
  return {
    user_id: record.userId,
    version: record.version,
    status: record.status,
    last_step: record.lastStep,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    skipped_at: record.skippedAt,
    first_play_at: record.firstPlayAt,
    contextual_tips: record.contextualTips,
    replay_count: record.replayCount,
    last_replayed_at: record.lastReplayedAt,
    updated_at: record.updatedAt,
  };
}

async function readServerOnboarding(
  userId: string,
  version: number,
  scope?: AuthScope,
): Promise<OnboardingRecord | null> {
  const builder = supabase
    .from("user_onboarding")
    .select(ONBOARDING_COLUMNS)
    .eq("user_id", userId)
    .eq("version", version)
    .maybeSingle();
  const { data, error } = await (scope
    ? setAuthScopeHeader(builder, scope)
    : builder);

  if (error) throw error;
  return data ? mapOnboardingRow(data) : null;
}

function reconcileAvailable(
  records: readonly (OnboardingRecord | null | undefined)[],
): OnboardingRecord | null {
  let reconciled: OnboardingRecord | null = null;
  for (const record of records) {
    if (record) reconciled = reconcileOnboarding(reconciled, record) ?? null;
  }
  return reconciled;
}

const localOperationTails = new Map<string, Promise<void>>();

function localOperationKey(userId: string, version: number): string {
  return JSON.stringify([userId, version]);
}

async function loadAvailableLocalRecord(
  userId: string,
  version: number,
): Promise<OnboardingRecord | null> {
  try {
    return await loadOnboardingRecord(userId, version);
  } catch {
    return null;
  }
}

function withSerializedLocalRecord<T>(
  userId: string,
  version: number,
  operation: (local: OnboardingRecord | null) => Promise<T>,
): Promise<T> {
  const key = localOperationKey(userId, version);
  const previous = localOperationTails.get(key) ?? Promise.resolve();
  const result = previous.then(
    () => loadAvailableLocalRecord(userId, version).then(operation),
    () => loadAvailableLocalRecord(userId, version).then(operation),
  );
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  localOperationTails.set(key, tail);
  void tail.finally(() => {
    if (localOperationTails.get(key) === tail) {
      localOperationTails.delete(key);
    }
  });
  return result;
}

export function useOnboarding(version: number) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.onboarding.current(user?.id ?? "anonymous", version),
    enabled: user !== null,
    queryFn: async (): Promise<OnboardingRecord | null> => {
      let local: OnboardingRecord | null = null;
      try {
        local = await loadOnboardingRecord(user!.id, version);
      } catch {
        // A malformed/unavailable mirror cannot establish eligibility.
      }
      if (local) {
        const userId = user!.id;
        const queryKey = queryKeys.onboarding.current(userId, version);
        void readServerOnboarding(userId, version)
          .then((server) =>
            withSerializedLocalRecord(userId, version, async (latestLocal) => {
              const latestCached =
                queryClient.getQueryData<OnboardingRecord | null>(queryKey) ??
                null;
              const reconciled =
                reconcileAvailable([latestCached, latestLocal, server]) ??
                local;
              queryClient.setQueryData(queryKey, reconciled);
              await saveOnboardingRecord(reconciled);
            }),
          )
          .catch(() => undefined);
        return local;
      }
      return readServerOnboarding(user!.id, version);
    },
  });
}

export function useSaveOnboarding() {
  const user = useCurrentUser();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: authMutationKey("save-onboarding", userId),
    mutationFn: async (next: OnboardingRecord): Promise<OnboardingRecord> => {
      if (!userId || next.userId !== userId) {
        throw new Error("Cannot save onboarding for a different user");
      }

      const queryKey = queryKeys.onboarding.current(userId, next.version);
      let localError: unknown;
      let reconciled = next;
      await withSerializedLocalRecord(
        userId,
        next.version,
        async (local) => {
          assertCurrentMutationUser(userId);
          const cached =
            queryClient.getQueryData<OnboardingRecord | null>(queryKey) ?? null;
          reconciled = reconcileAvailable([cached, local, next]) ?? next;
          queryClient.setQueryData(queryKey, reconciled);
          try {
            await saveOnboardingRecord(reconciled);
          } catch (error) {
            localError = error;
          }
        },
      );

      let server: OnboardingRecord | null = null;
      let serverError: unknown = null;
      const scope = captureAuthScope(userId);
      try {
        server = await readServerOnboarding(userId, next.version, scope);
      } catch (error) {
        serverError = error;
      }
      reconciled = reconcileAvailable([reconciled, server]) ?? reconciled;

      if (!serverError) {
        try {
          assertCurrentMutationUser(userId);
          const result = await setAuthScopeHeader(
            supabase
              .from("user_onboarding")
              .upsert(mapOnboardingInsert(reconciled), {
                onConflict: "user_id,version",
              })
              .select(ONBOARDING_COLUMNS)
              .single(),
            scope,
          );
          serverError = result.error;
          if (!serverError && result.data) {
            reconciled =
              reconcileOnboarding(reconciled, mapOnboardingRow(result.data)) ??
              reconciled;
          }
        } catch (error) {
          serverError = error;
        }
      }

      await withSerializedLocalRecord(
        userId,
        next.version,
        async (latestLocal) => {
          assertCurrentMutationUser(userId);
          const latestCached =
            queryClient.getQueryData<OnboardingRecord | null>(queryKey) ?? null;
          reconciled =
            reconcileAvailable([latestCached, latestLocal, reconciled]) ??
            reconciled;
          try {
            await saveOnboardingRecord(reconciled);
          } catch (error) {
            localError ??= error;
          }
          queryClient.setQueryData(queryKey, reconciled);
        },
      );

      if (serverError) throw serverError;
      if (localError) throw localError;
      return reconciled;
    },
  });
}
