import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { FOCUS_MOODS } from "@/src/types/music-preferences";
import { useQuery } from "@tanstack/react-query";

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
export function useRecommendedTracks() {
  return useQuery({
    queryKey: queryKeys.tracks.recommended,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, artist, audio_url, album_art_url, duration, genre")
        .not("audio_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) throw error;

      return data;
    },
  });
}

export function useAIMixTracks() {
  return useQuery({
    queryKey: queryKeys.tracks.aiMix,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, artist, audio_url, album_art_url, duration, genre")
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
          "id, title, artist, audio_url, album_art_url, duration, genre, energy_level, bpm",
        )
        .overlaps("mood_tags", FOCUS_MOODS)
        .not("audio_url", "is", null)
        .limit(50);

      if (error) throw error;

      return data;
    },
  });
}

export function usePlaylists() {
  return useQuery({
    queryKey: queryKeys.playlists.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name, cover_url, playlist_tracks(count)")
        .eq("is_public", true);

      if (error) throw error;

      return data.map((p) => ({
        ...p,
        trackCount: p.playlist_tracks?.[0]?.count ?? 0,
      }));
    },
  });
}
