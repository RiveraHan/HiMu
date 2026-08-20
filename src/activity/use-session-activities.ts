import {
  useMutationState,
  useQueryClient,
  type MutationStatus,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { CreateDJInput } from "@/src/hooks/use-create-dj";
import type { UpdateDJInput } from "@/src/hooks/use-update-dj";
import { useCurrentUser } from "@/src/hooks/use-auth";
import type { ActivityItem, ActivityKind } from "./types";
import { activityMutationKeys } from "./mutation-keys";

const SLOW_AFTER_MS = 30_000;
const TERMINAL_RETENTION_MS = 5 * 60_000;

type CreateDJResult = { djId: string; avatarReady: boolean };
type UpdateDJResult = { djId: string; avatarUrl: string | null };
type RegenerateCoverInput = { trackId: string; title: string };
type RegenerateCoverResult = RegenerateCoverInput & { albumArtUrl: string };

type MutationVariables =
  | CreateDJInput
  | UpdateDJInput
  | RegenerateCoverInput
  | { name: string };
type MutationResult =
  | CreateDJResult
  | UpdateDJResult
  | RegenerateCoverResult
  | undefined;

export type MutationActivityState = {
  mutationId: number;
  kind: Exclude<ActivityKind, "mix">;
  keyUserId: string | undefined;
  submittedUserId: string | undefined;
  status: MutationStatus;
  isPaused: boolean;
  submittedAt: number;
  variables: MutationVariables;
  data: MutationResult;
  error: unknown;
};

export type NormalizedMutationActivities = {
  items: ActivityItem[];
  expiredMutationIds: number[];
};

type NormalizeMutationActivitiesInput = {
  states: readonly MutationActivityState[];
  userId: string | null;
  nowMs: number;
  settledAtById: ReadonlyMap<number, number>;
};

function isTerminal(status: MutationStatus): boolean {
  return status === "success" || status === "error";
}

function titleFor(state: MutationActivityState): string {
  const variables = state.variables as { name?: string; title?: string };
  return variables.name ?? variables.title ?? "";
}

function djIdFor(state: MutationActivityState): string | null {
  if (state.status !== "success" || state.kind === "cover") return null;
  const data = state.data as CreateDJResult | UpdateDJResult | undefined;
  return data?.djId ?? null;
}

function trackIdFor(state: MutationActivityState): string | null {
  if (state.status !== "success" || state.kind !== "cover") return null;
  return (state.data as RegenerateCoverResult | undefined)?.trackId ?? null;
}

function detailFor(state: MutationActivityState): ActivityItem["detail"] {
  if (state.status !== "success") return null;
  if (state.kind === "create-dj") {
    return (state.data as CreateDJResult | undefined)?.avatarReady === false
      ? "portraitUnavailable"
      : null;
  }
  if (state.kind === "update-dj") {
    const variables = state.variables as UpdateDJInput;
    const data = state.data as UpdateDJResult | undefined;
    return variables.regenerateAvatar === true && data?.avatarUrl === null
      ? "portraitUnavailable"
      : null;
  }
  return null;
}

export function normalizeMutationActivities({
  states,
  userId,
  nowMs,
  settledAtById,
}: NormalizeMutationActivitiesInput): NormalizedMutationActivities {
  const items: ActivityItem[] = [];
  const expiredMutationIds: number[] = [];

  for (const state of states) {
    const terminal = isTerminal(state.status);
    const settledAtMs = settledAtById.get(state.mutationId) ?? nowMs;
    if (terminal && nowMs - settledAtMs >= TERMINAL_RETENTION_MS) {
      expiredMutationIds.push(state.mutationId);
      continue;
    }
    if (
      !userId ||
      state.keyUserId !== userId ||
      state.submittedUserId !== userId
    ) {
      continue;
    }

    const createdAt = new Date(state.submittedAt).toISOString();
    const rawError =
      state.error instanceof Error
        ? state.error.message
        : state.error == null
          ? null
          : String(state.error);
    const status: ActivityItem["status"] =
      state.status === "pending"
        ? state.isPaused
          ? "queued"
          : nowMs - state.submittedAt >= SLOW_AFTER_MS
            ? "slow"
            : "running"
        : state.status === "success"
          ? "ready"
          : "failed";

    items.push({
      id: `mutation:${state.kind}:${state.mutationId}`,
      source: "mutation",
      kind: state.kind,
      status,
      title: titleFor(state),
      djId: djIdFor(state),
      trackId: trackIdFor(state),
      createdAt,
      updatedAt: terminal ? new Date(settledAtMs).toISOString() : createdAt,
      error: rawError,
      failureReason: state.status === "error" ? "operationFailed" : null,
      recoveryAvailable: false,
      retryLyrics: null,
      retryBrief: null,
      sourceTrackId: null,
      visibility:
        state.kind === "create-dj"
          ? (state.variables as CreateDJInput).isPublic
            ? "public"
            : "private"
          : null,
      detail: detailFor(state),
      seen: false,
    });
  }

  return { items, expiredMutationIds };
}

function selectedState(
  kind: MutationActivityState["kind"],
  mutation: {
    mutationId: number;
    options: { mutationKey?: readonly unknown[] };
    state: {
      context: unknown;
      status: MutationStatus;
      isPaused: boolean;
      submittedAt: number;
      variables: unknown;
      data: unknown;
      error: unknown;
    };
  },
): MutationActivityState {
  const key = mutation.options.mutationKey;
  return {
    mutationId: mutation.mutationId,
    kind,
    keyUserId: typeof key?.[2] === "string" ? key[2] : undefined,
    submittedUserId: (
      mutation.state.context as { submittedUserId?: string } | undefined
    )?.submittedUserId,
    status: mutation.state.status,
    isPaused: mutation.state.isPaused,
    submittedAt: mutation.state.submittedAt,
    variables: mutation.state.variables as MutationVariables,
    data: mutation.state.data as MutationResult,
    error: mutation.state.error,
  };
}

export function useSessionActivities(): ActivityItem[] {
  const userId = useCurrentUser()?.id ?? null;
  const queryClient = useQueryClient();
  const createDjStates = useMutationState({
    filters: { mutationKey: activityMutationKeys.createDjRoot, exact: false },
    select: (mutation) => selectedState("create-dj", mutation),
  });
  const updateDjStates = useMutationState({
    filters: { mutationKey: activityMutationKeys.updateDjRoot, exact: false },
    select: (mutation) => selectedState("update-dj", mutation),
  });
  const coverStates = useMutationState({
    filters: {
      mutationKey: activityMutationKeys.regenerateCoverRoot,
      exact: false,
    },
    select: (mutation) => selectedState("cover", mutation),
  });
  const allStates = useMemo(
    () => [...createDjStates, ...updateDjStates, ...coverStates],
    [coverStates, createDjStates, updateDjStates],
  );
  const [settledAtById, setSettledAtById] = useState<ReadonlyMap<number, number>>(
    () => new Map(),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasObservedStates = allStates.length > 0;

  useEffect(() => {
    if (!hasObservedStates) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [hasObservedStates]);

  useEffect(() => {
    const currentIds = new Set(allStates.map((state) => state.mutationId));
    setSettledAtById((current) => {
      const next = new Map(current);
      let changed = false;

      for (const state of allStates) {
        if (isTerminal(state.status) && !next.has(state.mutationId)) {
          next.set(state.mutationId, Date.now());
          changed = true;
        }
      }
      for (const mutationId of next.keys()) {
        if (!currentIds.has(mutationId)) {
          next.delete(mutationId);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [allStates]);

  const effectiveNowMs = Math.max(nowMs, Date.now());
  const normalized = useMemo(
    () =>
      normalizeMutationActivities({
        states: allStates,
        userId,
        nowMs: effectiveNowMs,
        settledAtById,
      }),
    [allStates, effectiveNowMs, settledAtById, userId],
  );

  useEffect(() => {
    if (normalized.expiredMutationIds.length === 0) return;
    const expiredIds = new Set(normalized.expiredMutationIds);
    const cache = queryClient.getMutationCache();
    const roots = [
      activityMutationKeys.createDjRoot,
      activityMutationKeys.updateDjRoot,
      activityMutationKeys.regenerateCoverRoot,
    ];
    for (const root of roots) {
      for (const mutation of cache.findAll({ mutationKey: root, exact: false })) {
        if (expiredIds.has(mutation.mutationId)) cache.remove(mutation);
      }
    }
    setSettledAtById((current) => {
      const next = new Map(current);
      let changed = false;
      for (const mutationId of expiredIds) {
        changed = next.delete(mutationId) || changed;
      }
      return changed ? next : current;
    });
  }, [normalized.expiredMutationIds, queryClient]);

  return normalized.items;
}
