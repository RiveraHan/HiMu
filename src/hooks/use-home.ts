import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { usePlayerStore, type PlayerTrack } from "@/src/stores/player-store";
import { FOCUS_MOODS } from "@/src/types/music-preferences";
import {
  OWN_DJ_HERO_WEIGHT,
  TIME_OF_DAY_HEADLINES,
  TIME_OF_DAY_LABELS,
  TIME_OF_DAY_MOODS,
  daySeed,
  pickHeroTrack,
  timeOfDayBucket,
  weightedPick,
  type TimeOfDayBucket,
} from "@/src/utils/home-curation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

export type PlayableTrack = {
  id: string;
  title: string;
  artist: string;
  audio_url: string | null;
  album_art_url: string | null;
  duration: number | null;
  genre: string | null;
};

export type ContextualTrack = PlayableTrack & { mood_tags: string[] | null };

export type RecentTrack = PlayableTrack & {
  mood_tags: string[] | null;
  dj_id: string | null;
  created_at: string | null;
  dj: {
    id: string;
    name: string;
    avatar_url: string | null;
    genre_specialties: string[] | null;
    owner_id: string | null;
  } | null;
};

// Caller must guarantee audio_url != null (only playable tracks enter pools).
export function toPlayerTrack(t: PlayableTrack): PlayerTrack {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    audio_url: t.audio_url as string,
    album_art_url: t.album_art_url,
    duration: t.duration,
    genre: t.genre,
  };
}

export function useDJs() {
  return useQuery({
    queryKey: queryKeys.djs.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("djs")
        .select(
          "id, name, slug, avatar_url, genre_specialties, is_premium, owner_id",
        );

      if (error) throw error;

      return data;
    },
  });
}

export function useLiveDJIds() {
  return useQuery({
    queryKey: queryKeys.sessions.live,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("dj_id")
        .eq("status", "live");

      if (error) throw error;

      return new Set(data.map((s) => s.dj_id));
    },
  });
}

export function useAIMixTracks() {
  return useQuery({
    queryKey: queryKeys.tracks.aiMix,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select(
          "id, title, artist, audio_url, album_art_url, duration, genre, mood_tags",
        )
        .eq("is_ai_generated", true)
        .not("audio_url", "is", null)
        .limit(50);

      if (error) throw error;

      return data;
    },
  });
}

export function useFocusTracks() {
  return useQuery({
    queryKey: queryKeys.tracks.focus,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select(
          "id, title, artist, audio_url, album_art_url, duration, genre, energy_level, bpm, mood_tags",
        )
        .overlaps("mood_tags", FOCUS_MOODS)
        .not("audio_url", "is", null)
        .limit(50);

      if (error) throw error;

      return data;
    },
  });
}

// Workhorse: newest playable tracks with their DJ embedded. Powers the
// "Fresh from your DJs" shelf and the On-Air hero.
export function useRecentTracks(limit = 60) {
  return useQuery({
    queryKey: queryKeys.tracks.recent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select(
          "id, title, artist, audio_url, album_art_url, duration, genre, mood_tags, dj_id, created_at, dj:djs(id, name, avatar_url, genre_specialties, owner_id)",
        )
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<RecentTrack[]>();

      if (error) throw error;
      return data;
    },
  });
}

// Mood-appropriate tracks for the current hour. Keyed by bucket so a new
// time-of-day fetches its own set instead of serving a stale one from cache.
export function useTimeOfDayShelf() {
  const bucket: TimeOfDayBucket = timeOfDayBucket(new Date().getHours());
  const moods = TIME_OF_DAY_MOODS[bucket];

  return useQuery({
    queryKey: queryKeys.tracks.contextual(bucket),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select(
          "id, title, artist, audio_url, album_art_url, duration, genre, mood_tags",
        )
        .overlaps("mood_tags", moods)
        .not("audio_url", "is", null)
        .limit(24)
        .returns<ContextualTrack[]>();

      if (error) throw error;
      return { bucket, label: TIME_OF_DAY_LABELS[bucket], tracks: data ?? [] };
    },
  });
}

export type OnAirHero = {
  dj: {
    id: string;
    name: string;
    avatar_url: string | null;
    genre: string | null;
  };
  track: PlayerTrack;
  queue: PlayerTrack[];
  headline: string;
  isLive: boolean;
};

// Composes recent tracks + live sessions into the featured "On air" DJ.
// A live session always wins; otherwise a day-stable weighted pick tilted
// toward the user's own DJs (OWN_DJ_HERO_WEIGHT). Returns null when no DJ has
// a playable recent track (Home then hides the hero).
export function useOnAirHero(): { data: OnAirHero | null; isLoading: boolean } {
  const user = useCurrentUser();
  const { data: liveDJIds } = useLiveDJIds();
  const { data: recent, isLoading } = useRecentTracks();

  const hero = useMemo<OnAirHero | null>(() => {
    if (!recent || recent.length === 0) return null;
    const bucket = timeOfDayBucket(new Date().getHours());

    // Group playable recent tracks by DJ, newest-first order preserved.
    const byDj = new Map<string, RecentTrack[]>();
    for (const t of recent) {
      if (!t.dj || t.audio_url == null) continue;
      const arr = byDj.get(t.dj.id) ?? [];
      arr.push(t);
      byDj.set(t.dj.id, arr);
    }
    if (byDj.size === 0) return null;

    const candidates = [...byDj.values()].map((tracks) => ({
      dj: tracks[0].dj!,
      tracks,
    }));

    const live = candidates.filter((c) => liveDJIds?.has(c.dj.id));
    const pool = live.length > 0 ? live : candidates;
    const isLive = live.length > 0;

    const seed = daySeed(
      user?.id ?? "anon",
      new Date().toISOString().slice(0, 10),
    );
    const chosen = weightedPick(
      pool,
      (c) =>
        c.dj.owner_id && c.dj.owner_id === user?.id ? OWN_DJ_HERO_WEIGHT : 1,
      seed,
    );
    if (!chosen) return null;

    const heroTrack = pickHeroTrack(chosen.tracks, bucket);
    const queue = chosen.tracks
      .filter((t) => t.audio_url != null)
      .map(toPlayerTrack);
    const track = queue.find((q) => q.id === heroTrack.id) ?? queue[0];

    return {
      dj: {
        id: chosen.dj.id,
        name: chosen.dj.name,
        avatar_url: chosen.dj.avatar_url,
        genre: chosen.dj.genre_specialties?.[0] ?? null,
      },
      track,
      queue,
      headline: TIME_OF_DAY_HEADLINES[bucket],
      isLive,
    };
  }, [recent, liveDJIds, user?.id]);

  return { data: hero, isLoading };
}

// True when the track belongs to one of the current user's own DJs.
export function useTrackOwnership(trackId: string | undefined) {
  const user = useCurrentUser();
  const isExternal = trackId?.startsWith("audius:") ?? false;
  return useQuery({
    queryKey: queryKeys.tracks.ownership(trackId ?? ""),
    enabled: !!trackId && !!user && !isExternal,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("tracks")
        .select("dj_id, djs(owner_id)")
        .eq("id", trackId!)
        .maybeSingle();
      if (error) throw error;
      const owner = (data?.djs as { owner_id: string | null } | null)?.owner_id;
      return owner != null && owner === user!.id;
    },
  });
}

// Regenerate a track's cover, updating it in place on success.
export function useRegenerateCover() {
  const qc = useQueryClient();
  const setCoverForTrack = usePlayerStore((s) => s.setCoverForTrack);
  return useMutation({
    mutationFn: async (trackId: string) => {
      const { data, error } = await supabase.functions.invoke<{
        album_art_url: string;
      }>("regenerate-cover", { body: { trackId } });
      if (error) throw error;
      if (!data?.album_art_url) throw new Error("no cover returned");
      return { trackId, albumArtUrl: data.album_art_url };
    },
    onSuccess: ({ trackId, albumArtUrl }) => {
      setCoverForTrack(trackId, albumArtUrl);
      qc.invalidateQueries({ queryKey: ["tracks"] }); // refresh shelves/DJ page covers
    },
  });
}
