import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";

export function useDJ(id: string) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.djs.details(user?.id ?? null, id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("djs")
        .select(
          "id, name, slug, avatar_url, character, genre_specialties, mood_tags, is_premium, voice_style, owner_id, personality_traits",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useDJTracks(id: string) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tracks.byDj(user?.id ?? null, id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, artist, audio_url, album_art_url, duration, genre")
        .eq("dj_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
