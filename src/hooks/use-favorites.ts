import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";
import type { PlayerTrack } from "@/src/stores/player-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type FavoriteTrack = PlayerTrack & { favoritedAt: string };

// All of the current user's favorites, newest-saved first. Powers the
// Favorites screen and the Home entry card's cover.
export function useFavorites() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.favorites.all,
    enabled: !!user,
    queryFn: async (): Promise<FavoriteTrack[]> => {
      const { data, error } = await supabase
        .from("favorites")
        .select(
          "track_id, title, artist, audio_url, album_art_url, duration, genre, created_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((f) => ({
        id: f.track_id,
        title: f.title,
        artist: f.artist,
        audio_url: f.audio_url,
        album_art_url: f.album_art_url,
        duration: f.duration,
        genre: f.genre,
        favoritedAt: f.created_at ?? "",
      }));
    },
  });
}

// Whether the given track is already in the current user's favorites. Drives
// the player's heart icon.
export function useIsFavorited(trackId: string | undefined) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.favorites.isFavorited(trackId ?? ""),
    enabled: !!trackId && !!user,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("favorites")
        .select("track_id")
        .eq("user_id", user!.id)
        .eq("track_id", trackId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

// Toggle a track's favorite state. Optimistically flips the isFavorited
// cache so the player's heart responds instantly; rolls back on error.
export function useToggleFavorite() {
  const user = useCurrentUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      track,
      isFavorited,
    }: {
      track: PlayerTrack;
      isFavorited: boolean;
    }) => {
      if (!user) throw new Error("not signed in");

      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("track_id", track.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          track_id: track.id,
          title: track.title,
          artist: track.artist,
          audio_url: track.audio_url,
          album_art_url: track.album_art_url,
          duration: track.duration,
          genre: track.genre ?? null,
        });
        if (error) throw error;
      }
    },
    onMutate: async ({ track, isFavorited }) => {
      const key = queryKeys.favorites.isFavorited(track.id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<boolean>(key);
      qc.setQueryData(key, !isFavorited);
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData(context.key, context.previous);
    },
    onSettled: () => {
      // favorites.all (["favorites"]) is a prefix of isFavorited's key, so
      // this alone also invalidates every isFavorited query.
      qc.invalidateQueries({ queryKey: queryKeys.favorites.all });
    },
  });
}
