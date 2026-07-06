import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { toPlayerTrack, useDJs } from "@/src/hooks/use-home";
import type { PlayerTrack } from "@/src/stores/player-store";
import {
  OWN_DJ_HERO_WEIGHT,
  daySeed,
  localDateStr,
  weightedPick,
} from "@/src/utils/home-curation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

export type DailyDrop = {
  status: "pending" | "ready" | "failed" | "idle";
  dj: {
    id: string;
    name: string;
    avatar_url: string | null;
    genre: string | null;
  } | null;
  track: PlayerTrack | null;
  caption: string | null;
  captionAudioUrl: string | null;
};

// Lazily ensures today's drop exists (idempotent server-side) and polls it.
export function useDailyDrop(): DailyDrop {
  const user = useCurrentUser();
  const { data: djs } = useDJs();
  const [jobId, setJobId] = useState<string | null>(null);
  const triggered = useRef(false);

  // Resident DJ of the day: same day-seed pick as the hero, over all DJs
  // (no recent-track requirement — we generate one).
  const dj = useMemo(() => {
    if (!user || !djs || djs.length === 0) return null;
    const chosen = weightedPick(
      djs,
      (d) => (d.owner_id && d.owner_id === user.id ? OWN_DJ_HERO_WEIGHT : 1),
      daySeed(user.id, localDateStr()),
    );
    return chosen
      ? {
          id: chosen.id,
          name: chosen.name,
          avatar_url: chosen.avatar_url,
          genre: chosen.genre_specialties?.[0] ?? null,
        }
      : null;
  }, [user, djs]);

  const ensure = useMutation({
    mutationFn: async (djId: string) => {
      const { data, error } = await supabase.functions.invoke<{
        jobId: string;
      }>("generate-mix", {
        body: {
          djId,
          dropDate: localDateStr(),
          localHour: new Date().getHours(),
        },
      });
      if (error) throw error;
      if (!data?.jobId) throw new Error("generate-mix did not return a jobId");
      return data.jobId;
    },
    onSuccess: setJobId,
  });

  // Fire the ensure once per mount, as soon as a DJ is known.
  const mutate = ensure.mutate;
  useEffect(() => {
    if (triggered.current || !dj) return;
    triggered.current = true;
    mutate(dj.id);
  }, [dj, mutate]);

  const job = useQuery({
    queryKey: queryKeys.generationJobs.detail(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "ready" || s === "failed" ? false : 3000;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_jobs")
        .select("status, error, track_id, caption, caption_audio_url, tracks(*)")
        .eq("id", jobId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return useMemo<DailyDrop>(() => {
    if (!dj)
      return {
        status: "idle",
        dj: null,
        track: null,
        caption: null,
        captionAudioUrl: null,
      };
    const s = job.data?.status;
    const t = job.data?.tracks;
    const caption = job.data?.caption ?? null;
    const captionAudioUrl = job.data?.caption_audio_url ?? null;
    if (s === "ready" && t?.audio_url) {
      return {
        status: "ready",
        dj,
        track: toPlayerTrack(t),
        caption,
        captionAudioUrl,
      };
    }
    if (s === "failed")
      return {
        status: "failed",
        dj,
        track: null,
        caption: null,
        captionAudioUrl: null,
      };
    return {
      status: "pending",
      dj,
      track: null,
      caption: null,
      captionAudioUrl: null,
    };
  }, [dj, job.data]);
}
