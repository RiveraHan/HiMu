import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import {
  authMutationKey,
  captureAuthScope,
  invokeWithAuthScope,
} from "@/src/api/auth-scope";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { toPlayerTrack, useDJs } from "@/src/hooks/use-home";
import { useLocalDate } from "@/src/hooks/use-local-date";
import { useLocale } from "@/src/i18n/use-locale";
import type { PlayerTrack } from "@/src/stores/player-store";
import { OWN_DJ_HERO_WEIGHT, daySeed, weightedPick } from "@/src/utils/home-curation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DropDj = {
  id: string;
  name: string;
  avatar_url: string | null;
  genre: string | null;
};

type EnsureVariables = {
  identityKey: string;
  djId: string;
  dropDate: string;
};

type JobState = { identityKey: string; jobId: string | null };

export type DailyDrop = {
  status: "pending" | "ready" | "failed" | "idle";
  dj: DropDj | null;
  track: PlayerTrack | null;
  caption: string | null;
  captionAudioUrl: string | null;
  stale: boolean;
  retry: () => void;
};

// Lazily ensures today's drop exists (idempotent server-side) and polls it.
export function useDailyDrop(): DailyDrop {
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const dropDate = useLocalDate();
  const { data: djs } = useDJs();
  const { resolvedLanguage } = useLocale();
  const identity = useMemo(
    () => userId
      ? { key: `${userId}:${dropDate}`, userId, dropDate }
      : null,
    [dropDate, userId],
  );
  const identityKey = identity?.key ?? "anonymous";
  const currentIdentityKey = useRef(identity?.key ?? null);
  currentIdentityKey.current = identity?.key ?? null;
  const [jobState, setJobState] = useState<JobState>(() => ({
    identityKey,
    jobId: null,
  }));
  const lastTriggeredIdentity = useRef<string | null>(null);

  const proposedDj = useMemo(() => {
    if (!userId || !djs || djs.length === 0) return null;
    return weightedPick(
      djs,
      (dj) => (dj.owner_id === userId ? OWN_DJ_HERO_WEIGHT : 1),
      daySeed(userId, dropDate),
    ) ?? null;
  }, [djs, dropDate, userId]);

  const ensure = useMutation({
    mutationKey: authMutationKey("ensure-daily-drop", userId ?? ""),
    mutationFn: async ({ djId, dropDate: requestedDate }: EnsureVariables) => {
      if (!userId) throw new Error("missing drop identity");
      const scope = captureAuthScope(userId);
      const { data, error } = await invokeWithAuthScope<{ jobId: string }>(
        supabase.functions,
        scope,
        "generate-mix",
        {
          body: {
            djId,
            language: resolvedLanguage,
            dropDate: requestedDate,
            localHour: new Date().getHours(),
          },
        },
      );
      if (error) throw error;
      if (!data?.jobId) throw new Error("generate-mix did not return a jobId");
      return data.jobId;
    },
    onSuccess: (nextJobId, variables) => {
      if (currentIdentityKey.current !== variables.identityKey) return;
      setJobState({ identityKey: variables.identityKey, jobId: nextJobId });
    },
  });

  const resetEnsure = ensure.reset;
  useEffect(() => {
    setJobState({ identityKey, jobId: null });
    resetEnsure();
  }, [identityKey, resetEnsure]);

  const ensureDrop = ensure.mutate;
  useEffect(() => {
    if (!identity || !proposedDj || lastTriggeredIdentity.current === identity.key) return;
    lastTriggeredIdentity.current = identity.key;
    ensureDrop({
      identityKey: identity.key,
      djId: proposedDj.id,
      dropDate: identity.dropDate,
    });
  }, [ensureDrop, identity, proposedDj]);

  const jobId = jobState.identityKey === identity?.key ? jobState.jobId : null;
  const job = useQuery({
    queryKey: queryKeys.generationJobs.detail(userId, jobId),
    enabled: !!identity && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "ready" || status === "failed" ? false : 3000;
    },
    queryFn: async () => {
      if (!userId || !jobId) throw new Error("missing drop identity");
      const { data, error } = await supabase
        .from("generation_jobs")
        .select(
          "status, error, dj_id, track_id, caption, caption_audio_url, tracks(*), djs(id,name,avatar_url,genre_specialties)",
        )
        .eq("id", jobId)
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const refetchJob = job.refetch;
  const jobReadFailed = job.isError;
  const retry = useCallback(() => {
    const retryDjId = job.data?.dj_id ?? proposedDj?.id;
    if (!identity || !retryDjId) return;
    if (job.data?.status === "failed" || ensure.isError) {
      resetEnsure();
      ensureDrop({
        identityKey: identity.key,
        djId: retryDjId,
        dropDate: identity.dropDate,
      });
      return;
    }
    if (jobId && jobReadFailed) void refetchJob();
  }, [
    ensure.isError,
    ensureDrop,
    identity,
    job.data,
    jobId,
    jobReadFailed,
    proposedDj,
    refetchJob,
    resetEnsure,
  ]);

  return useMemo<DailyDrop>(() => {
    const empty = {
      dj: null,
      track: null,
      caption: null,
      captionAudioUrl: null,
      stale: false,
      retry,
    };
    if (
      !identity ||
      (!proposedDj && !jobId && !job.data && !ensure.isPending && !ensure.isError)
    ) {
      return { ...empty, status: "idle" };
    }

    const data = job.data;
    const stale = !!data && job.isError;
    const persisted = Array.isArray(data?.djs) ? data?.djs[0] : data?.djs;
    const dj: DropDj | null = persisted
      ? {
          id: persisted.id,
          name: persisted.name,
          avatar_url: persisted.avatar_url,
          genre: persisted.genre_specialties?.[0] ?? null,
        }
      : null;

    if (data?.status === "ready" && data.tracks?.audio_url) {
      return {
        status: "ready",
        dj,
        track: toPlayerTrack(data.tracks),
        caption: data.caption ?? null,
        captionAudioUrl: data.caption_audio_url ?? null,
        stale,
        retry,
      };
    }
    if (data?.status === "failed") return { ...empty, status: "failed", dj, stale };
    if (data) return { ...empty, status: "pending", dj, stale };
    if (ensure.isError || job.isError) return { ...empty, status: "failed" };
    return { ...empty, status: "pending" };
  }, [
    ensure.isError,
    ensure.isPending,
    identity,
    job.data,
    job.isError,
    jobId,
    proposedDj,
    retry,
  ]);
}
