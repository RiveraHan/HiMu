import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useTranslation } from "react-i18next";

import { queryKeys } from "@/src/api/queries";
import {
  AuthScopeChangedError,
  assertCurrentMutationUser,
  captureAuthScope,
  invokeWithAuthScope,
  isCurrentMutationUser,
} from "@/src/api/auth-scope";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useToast } from "@/src/hooks/use-toast";
import { useLocale } from "@/src/i18n/use-locale";
import { usePlayerStore } from "@/src/stores/player-store";
import {
  createActivityReceiptStore,
  markNotified as markReceiptNotified,
  markSeen as markReceiptSeen,
  type ActivityReceipts,
} from "./activity-receipts";
import {
  primaryActivity,
  sortPanelActivities,
  upsertQueuedGenerationActivity,
} from "./generation-activity";
import type { ActivityItem } from "./types";
import { useGenerationActivity } from "./use-generation-activity";
import { useSessionActivities } from "./use-session-activities";

const ACTIVE_STATUSES = new Set<ActivityItem["status"]>([
  "queued",
  "running",
  "slow",
]);

type ReceiptStore = ReturnType<typeof createActivityReceiptStore>;

type UserSessionState = {
  notified: Set<string>;
  seen: Set<string>;
};

type HydratedReceipts = {
  userId: string | null;
  receipts: ActivityReceipts;
};

export type ActivityContextValue = {
  items: ActivityItem[];
  primary: ActivityItem | null;
  activeCount: number;
  isInitialLoading: boolean;
  isOffline: boolean;
  queryError: Error | null;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  refetch: () => Promise<unknown>;
  markSeen: (activity: ActivityItem) => Promise<void>;
  canOpenActivity: (activity: ActivityItem) => boolean;
  openActivity: (activity: ActivityItem) => Promise<void>;
  retryActivity: (activity: ActivityItem) => Promise<void>;
  retryingIds: ReadonlySet<string>;
  activeMixForDj: (djId: string) => ActivityItem | null;
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

function isActive(activity: ActivityItem): boolean {
  return ACTIVE_STATUSES.has(activity.status);
}

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

function logActivityFailure(activity: ActivityItem): void {
  if (!activity.error) return;
  console.error("Activity generation failed", {
    id: activity.id,
    error: activity.error.slice(0, 500),
  });
}

export function ActivityProvider({ children }: PropsWithChildren) {
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const generationActivity = useGenerationActivity();
  const mutationActivities = useSessionActivities();
  const queryClient = useQueryClient();
  const currentTrackId = usePlayerStore((state) => state.currentTrack?.id ?? null);
  const { resolvedLanguage } = useLocale();
  const toast = useToast();
  const { t } = useTranslation();
  const [panelOpen, setPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState<HydratedReceipts>({
    userId: null,
    receipts: {},
  });
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [mutationReceiptVersion, setMutationReceiptVersion] = useState(0);
  const storesRef = useRef(new Map<string, ReceiptStore>());
  const userSessionsRef = useRef(new Map<string, UserSessionState>());
  const notifiedMutationIdsByUserRef = useRef(
    new Map<string, Set<string>>(),
  );
  const seenMutationIdsByUserRef = useRef(new Map<string, Set<string>>());
  const generationRef = useRef(0);
  const currentUserIdRef = useRef(userId);
  const retryFlightsRef = useRef(new Map<string, Map<string, symbol>>());
  currentUserIdRef.current = userId;

  const sessionFor = useCallback((id: string): UserSessionState => {
    let session = userSessionsRef.current.get(id);
    if (!session) {
      session = { notified: new Set(), seen: new Set() };
      userSessionsRef.current.set(id, session);
    }
    return session;
  }, []);

  const retryFlightsFor = useCallback((id: string): Map<string, symbol> => {
    let flights = retryFlightsRef.current.get(id);
    if (!flights) {
      flights = new Map();
      retryFlightsRef.current.set(id, flights);
    }
    return flights;
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    setPanelOpen(false);
    setHydrated({ userId: null, receipts: {} });
    setRetryingIds(userId ? new Set(retryFlightsFor(userId).keys()) : new Set());

    if (!userId) return;

    sessionFor(userId);
    let store = storesRef.current.get(userId);
    if (!store) {
      store = createActivityReceiptStore(userId);
      storesRef.current.set(userId, store);
    }

    void store.load().then((receipts) => {
      if (
        generationRef.current !== generation ||
        currentUserIdRef.current !== userId
      ) {
        return;
      }
      setHydrated({ userId, receipts });
    });
  }, [retryFlightsFor, sessionFor, userId]);

  useEffect(
    () => () => {
      generationRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!userId || hydrated.userId !== userId) return;
    const store = storesRef.current.get(userId);
    if (!store) return;
    const session = sessionFor(userId);
    const pending = (generationActivity.data ?? []).filter(
      (activity) =>
        activity.source === "server" &&
        activity.kind === "mix" &&
        (activity.status === "ready" || activity.status === "failed") &&
        !hydrated.receipts[activity.id] &&
        !session.notified.has(activity.id),
    );
    if (pending.length === 0) return;

    pending.forEach((activity) => session.notified.add(activity.id));
    const generation = generationRef.current;
    const nowMs = Date.now();
    void store
      .update(
        (current) =>
          pending.reduce(
            (next, activity) =>
              markReceiptNotified(next, activity.id, nowMs),
            current,
          ),
        nowMs,
      )
      .then((receipts) => {
        if (
          generationRef.current !== generation ||
          currentUserIdRef.current !== userId ||
          !isCurrentMutationUser(userId)
        ) {
          return;
        }

        setHydrated({ userId, receipts });
        for (const activity of pending) {
          void queryClient
            .invalidateQueries({ queryKey: queryKeys.tracks.all })
            .catch((error) =>
              console.error("Activity refresh failed", boundedError(error)),
            );
          if (activity.djId) {
            void queryClient
              .invalidateQueries({
                queryKey: queryKeys.tracks.byDj(userId, activity.djId),
              })
              .catch((error) =>
                console.error("Activity refresh failed", boundedError(error)),
              );
            void queryClient
              .invalidateQueries({
                queryKey: queryKeys.djs.details(userId, activity.djId),
              })
              .catch((error) =>
                console.error("Activity refresh failed", boundedError(error)),
              );
          }

          if (activity.status === "ready") {
            toast.info(
              t("activity.mixReady"),
              t("activity.mixReadyMessage", { name: activity.title }),
            );
          } else {
            logActivityFailure(activity);
            toast.error(
              t("activity.mixFailed"),
              t(`activity.${activity.failureReason ?? "operationFailed"}`),
            );
          }
        }
      })
      .catch((error) => {
        pending.forEach((activity) => session.notified.delete(activity.id));
        console.error("Activity receipt update failed", boundedError(error));
      });
  }, [
    generationActivity.data,
    hydrated,
    queryClient,
    sessionFor,
    t,
    toast,
    userId,
  ]);

  useEffect(() => {
    if (!userId) return;
    let notified = notifiedMutationIdsByUserRef.current.get(userId);
    if (!notified) {
      notified = new Set();
      notifiedMutationIdsByUserRef.current.set(userId, notified);
    }
    const pending = mutationActivities.filter(
      (activity) =>
        (activity.status === "ready" || activity.status === "failed") &&
        !notified.has(activity.id),
    );
    if (pending.length === 0) return;

    for (const activity of pending) {
      notified.add(activity.id);
      if (activity.kind === "cover") {
        void queryClient
          .invalidateQueries({ queryKey: queryKeys.tracks.all })
          .catch((error) =>
            console.error("Activity refresh failed", boundedError(error)),
          );
      } else {
        void queryClient
          .invalidateQueries({ queryKey: queryKeys.djs.all })
          .catch((error) =>
            console.error("Activity refresh failed", boundedError(error)),
          );
      }

      const titleKey =
        activity.kind === "create-dj"
          ? activity.status === "ready"
            ? "createDjReady"
            : "createDjFailed"
          : activity.kind === "update-dj"
            ? activity.status === "ready"
              ? "updateDjReady"
              : "updateDjFailed"
            : activity.status === "ready"
              ? "coverReady"
              : "coverFailed";
      const title = t(`activity.${titleKey}`, { name: activity.title });
      if (
        activity.status === "ready" &&
        activity.detail === "portraitUnavailable"
      ) {
        toast.warning(title, t("activity.portraitUnavailable"));
      } else if (activity.status === "ready") {
        toast.info(title);
      } else {
        logActivityFailure(activity);
        toast.error(title, t("activity.operationFailed"));
      }
    }
  }, [mutationActivities, queryClient, t, toast, userId]);

  const mergedActivities = useMemo(() => {
    void mutationReceiptVersion;
    const activities = generationActivity.data ?? [];
    const seenMutationIds = userId
      ? seenMutationIdsByUserRef.current.get(userId)
      : undefined;
    const mutations = mutationActivities.map((activity) => ({
      ...activity,
      seen: activity.seen || seenMutationIds?.has(activity.id) === true,
    }));
    if (!userId || hydrated.userId !== userId) {
      return [...activities.filter(isActive), ...mutations];
    }
    return [
      ...activities.map((activity) => ({
        ...activity,
        seen:
          activity.seen ||
          (activity.source === "server" &&
            activity.kind === "mix" &&
            hydrated.receipts[activity.id]?.seenAt !== null &&
            hydrated.receipts[activity.id]?.seenAt !== undefined),
      })),
      ...mutations,
    ];
  }, [
    generationActivity.data,
    hydrated,
    mutationActivities,
    mutationReceiptVersion,
    userId,
  ]);

  const visibleActivities = useMemo(
    () =>
      mergedActivities.filter(
        (activity) => isActive(activity) || !activity.seen,
      ),
    [mergedActivities],
  );
  const items = useMemo(
    () => sortPanelActivities(visibleActivities),
    [visibleActivities],
  );
  const primary = useMemo(
    () => primaryActivity(visibleActivities) ?? null,
    [visibleActivities],
  );
  const activeCount = useMemo(
    () => mergedActivities.filter(isActive).length,
    [mergedActivities],
  );

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const markSeen = useCallback(
    async (activity: ActivityItem) => {
      if (activity.source === "mutation") {
        if (!userId) return;
        let seen = seenMutationIdsByUserRef.current.get(userId);
        if (!seen) {
          seen = new Set();
          seenMutationIdsByUserRef.current.set(userId, seen);
        }
        if (!seen.has(activity.id)) {
          seen.add(activity.id);
          setMutationReceiptVersion((version) => version + 1);
        }
        return;
      }
      if (
        !userId ||
        hydrated.userId !== userId ||
        activity.source !== "server" ||
        activity.kind !== "mix"
      ) {
        return;
      }
      const store = storesRef.current.get(userId);
      if (!store) return;
      const session = sessionFor(userId);
      if (
        session.seen.has(activity.id) ||
        hydrated.receipts[activity.id]?.seenAt
      ) {
        return;
      }

      session.seen.add(activity.id);
      const generation = generationRef.current;
      const nowMs = Date.now();
      try {
        const receipts = await store.update(
          (current) => markReceiptSeen(current, activity.id, nowMs),
          nowMs,
        );
        if (
          generationRef.current === generation &&
          currentUserIdRef.current === userId
        ) {
          setHydrated({ userId, receipts });
        }
      } catch (error) {
        session.seen.delete(activity.id);
        console.error("Activity receipt update failed", boundedError(error));
      }
    },
    [hydrated, sessionFor, userId],
  );

  const canOpenActivity = useCallback(
    (activity: ActivityItem) => {
      if (activity.kind === "mix") return activity.djId !== null;
      if (activity.kind === "cover") {
        return activity.trackId !== null && currentTrackId === activity.trackId;
      }
      return activity.djId !== null;
    },
    [currentTrackId],
  );

  const openActivity = useCallback(
    async (activity: ActivityItem) => {
      if (!canOpenActivity(activity)) return;

      if (activity.kind === "create-dj" || activity.kind === "update-dj") {
        if (!activity.djId) return;
        closePanel();
        router.push(`/dj/${activity.djId}`);
        if (activity.status === "ready" || activity.status === "failed") {
          await markSeen(activity);
        }
        return;
      }
      if (activity.kind === "cover") {
        if (currentTrackId !== activity.trackId) return;
        closePanel();
        router.push("/player");
        if (activity.status === "ready" || activity.status === "failed") {
          await markSeen(activity);
        }
        return;
      }
      if (!activity.djId) return;

      if (activity.status === "ready" && activity.trackId) {
        await markSeen(activity);
        closePanel();
        router.push({
          pathname: "/dj/[id]",
          params: { id: activity.djId, highlightTrackId: activity.trackId },
        });
        return;
      }

      if (activity.status === "ready" && !activity.trackId) {
        console.error("Malformed ready mix activity", { id: activity.id });
      }
      if (activity.status === "ready" || activity.status === "failed") {
        await markSeen(activity);
      }
      closePanel();
      router.push({ pathname: "/dj/[id]", params: { id: activity.djId } });
    },
    [canOpenActivity, closePanel, currentTrackId, markSeen],
  );

  const retryActivity = useCallback(
    async (activity: ActivityItem) => {
      const djId = activity.djId;
      const userRetryFlights = userId ? retryFlightsFor(userId) : null;
      if (
        !userId ||
        !userRetryFlights ||
        activity.source !== "server" ||
        activity.kind !== "mix" ||
        !djId ||
        (activity.status !== "failed" &&
          !(activity.status === "slow" && activity.recoveryAvailable)) ||
        userRetryFlights.has(activity.id)
      ) {
        return;
      }
      if (
        activity.visibility !== "private" &&
        activity.visibility !== "public"
      ) {
        toast.error(t("activity.operationFailed"));
        return;
      }

      const retryToken = Symbol(activity.id);
      userRetryFlights.set(activity.id, retryToken);
      setRetryingIds(new Set(userRetryFlights.keys()));
      const generation = generationRef.current;
      try {
        const scope = captureAuthScope(userId);
        assertCurrentMutationUser(userId);
        const { data, error } = await invokeWithAuthScope<{
          jobId: string;
          isPublic: boolean;
          brief?: ActivityItem["retryBrief"];
          sourceTrackId?: string | null;
        }>(supabase.functions, scope, "generate-mix", {
          body: activity.retryBrief
            ? {
              djId,
              brief: activity.retryBrief,
              sourceTrackId: activity.sourceTrackId,
              language: resolvedLanguage,
              localHour: new Date().getHours(),
            }
            : {
              djId,
              legacyJobId: activity.id.startsWith("generation:")
                ? activity.id.slice("generation:".length)
                : activity.id,
              language: resolvedLanguage,
              localHour: new Date().getHours(),
              isPublic: activity.visibility === "public",
              ...(activity.retryLyrics
                ? { lyrics: activity.retryLyrics }
                : {}),
            },
        });
        if (error) throw error;
        if (
          typeof data?.jobId !== "string" ||
          data.jobId.trim().length === 0 ||
          typeof data.isPublic !== "boolean" ||
          (activity.retryBrief &&
            (!data.brief || data.brief.version !== 1 ||
              (data.sourceTrackId !== null &&
                typeof data.sourceTrackId !== "string")))
        ) {
          throw new Error("generate-mix returned an invalid response");
        }
        if (
          generationRef.current !== generation ||
          currentUserIdRef.current !== userId ||
          !isCurrentMutationUser(userId)
        ) {
          return;
        }

        queryClient.setQueryData<ActivityItem[]>(
          queryKeys.generationJobs.activity(userId),
          (current) =>
            upsertQueuedGenerationActivity(current, {
              jobId: data.jobId,
              djId,
              title: data.brief?.title ?? activity.title,
              retryLyrics: data.brief ? null : activity.retryLyrics,
              retryBrief: data.brief ?? activity.retryBrief,
              sourceTrackId: data.sourceTrackId !== undefined
                ? data.sourceTrackId
                : activity.sourceTrackId,
              visibility: data.isPublic ? "public" : "private",
              nowMs: Date.now(),
              replaceActivityId: activity.id,
            }),
        );
        if (`generation:${data.jobId}` !== activity.id) {
          await markSeen(activity);
        }
        await queryClient
          .invalidateQueries({
            queryKey: queryKeys.generationJobs.activity(userId),
          })
          .catch((refreshError) =>
            console.error("Activity refresh failed", boundedError(refreshError)),
          );
      } catch (error) {
        if (error instanceof AuthScopeChangedError) return;
        console.error("Activity retry failed", boundedError(error));
        if (
          generationRef.current === generation &&
          currentUserIdRef.current === userId &&
          isCurrentMutationUser(userId)
        ) {
          toast.error(t("activity.operationFailed"));
        }
      } finally {
        if (userRetryFlights.get(activity.id) === retryToken) {
          userRetryFlights.delete(activity.id);
          if (
            currentUserIdRef.current === userId &&
            isCurrentMutationUser(userId)
          ) {
            setRetryingIds(new Set(userRetryFlights.keys()));
          }
        }
      }
    },
    [
      markSeen,
      queryClient,
      resolvedLanguage,
      retryFlightsFor,
      t,
      toast,
      userId,
    ],
  );

  const activeMixForDj = useCallback(
    (djId: string) =>
      items.find(
        (activity) =>
          activity.kind === "mix" && activity.djId === djId && isActive(activity),
      ) ?? null,
    [items],
  );

  const value = useMemo<ActivityContextValue>(
    () => ({
      items,
      primary,
      activeCount,
      isInitialLoading: generationActivity.isLoading,
      isOffline: generationActivity.fetchStatus === "paused",
      queryError:
        generationActivity.error instanceof Error
          ? generationActivity.error
          : null,
      panelOpen,
      openPanel,
      closePanel,
      refetch: generationActivity.refetch,
      markSeen,
      canOpenActivity,
      openActivity,
      retryActivity,
      retryingIds,
      activeMixForDj,
    }),
    [
      activeCount,
      activeMixForDj,
      canOpenActivity,
      closePanel,
      generationActivity.error,
      generationActivity.fetchStatus,
      generationActivity.isLoading,
      generationActivity.refetch,
      items,
      markSeen,
      openActivity,
      openPanel,
      panelOpen,
      primary,
      retryActivity,
      retryingIds,
    ],
  );

  return <ActivityContext value={value}>{children}</ActivityContext>;
}

export function useActivity(): ActivityContextValue {
  const value = useContext(ActivityContext);
  if (!value) {
    throw new Error("useActivity must be used within ActivityProvider");
  }
  return value;
}
