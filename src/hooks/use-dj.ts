import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";

type DJDetails = {
  id: string;
  name: string;
  identity_concept: string | null;
  slug: string;
  avatar_url: string | null;
  character: string | null;
  genre_specialties: string[] | null;
  mood_tags: string[] | null;
  is_premium: boolean;
  voice_style: string | null;
  owner_id: string | null;
  is_public: boolean;
  personality_traits: unknown;
};

type DJTrack = {
  id: string;
  title: string;
  artist: string;
  audio_url: string | null;
  album_art_url: string | null;
  duration: number | null;
  genre: string | null;
  owner_id: string | null;
  is_public: boolean;
};

export function useDJ(id: string) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.djs.details(user?.id ?? null, id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("djs")
        .select(
          "id, name, slug, avatar_url, character, identity_concept, genre_specialties, mood_tags, is_premium, voice_style, owner_id, is_public, personality_traits",
        )
        .eq("id", id)
        .returns<DJDetails[]>()
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
        .select(
          "id, title, artist, audio_url, album_art_url, duration, genre, owner_id, is_public",
        )
        .eq("dj_id", id)
        .order("created_at", { ascending: false })
        .returns<DJTrack[]>();

      if (error) throw error;
      return data;
    },
  });
}
