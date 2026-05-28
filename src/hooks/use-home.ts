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
export function useFavoriteTrackCount() {
  return useQuery({
    queryKey: [...queryKeys.tracks.all, "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true });

      if (error) throw error;

      return count ?? 0;
    },
  });
}
export function useRecommendedTracks() {
  return useQuery({
    queryKey: queryKeys.tracks.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, artist, album_art_url, genre")
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
