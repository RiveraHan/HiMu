import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useQuery } from "@tanstack/react-query";

export function useDJs() {
  return useQuery({
    queryKey: queryKeys.djs.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("djs")
        .select("id, name, slug, avatar_url, genre_specialties, is_premium");

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
export function useFavoritesPreview() {
  return useQuery({
    queryKey: [...queryKeys.tracks.all, "favorites-preview"],
    queryFn: async () => {
      // One round-trip: exact total count + first few covers for the stack.
      const { data, count, error } = await supabase
        .from("tracks")
        .select("id, album_art_url", { count: "exact" })
        .not("album_art_url", "is", null)
        .limit(3);

      if (error) throw error;

      return {
        count: count ?? 0,
        covers: data.map((t) => t.album_art_url).filter(Boolean) as string[],
      };
    },
  });
}
export function useRecommendedTracks() {
  return useQuery({
    queryKey: queryKeys.tracks.all,
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
