import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import {
  authMutationKey,
  captureAuthScope,
  setAuthScopeHeader,
} from "@/src/api/auth-scope";
import {
  mergeMusicPreferences,
  MusicPreferences,
} from "@/src/types/music-preferences";
import { useCurrentUser } from "./use-auth";

export function useMusicPreferences() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: queryKeys.musicPreferences.me(user?.id ?? null),
    enabled: !!user,
    queryFn: async (): Promise<MusicPreferences> => {
      const { data, error } = await supabase
        .from("music_preferences")
        .select("genres, moods, vibe_mapping, ai_frequency, discovery_depth")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      return mergeMusicPreferences(data);
    },
  });
}

export function useUpdateMusicPreferences() {
  const user = useCurrentUser();
  const userId = user?.id ?? "";

  return useMutation({
    mutationKey: authMutationKey("update-music-preferences", userId),
    mutationFn: async (next: MusicPreferences) => {
      const scope = captureAuthScope(userId);
      const { error } = await setAuthScopeHeader(
        supabase.from("music_preferences").upsert(
          {
            user_id: scope.userId,
            genres: next.genres,
            moods: next.excludedMoods,
            vibe_mapping: {
              organic_electronic: next.vibeMapping.organicElectronic,
              melancholic_euphoric: next.vibeMapping.melancholicEuphoric,
            },
            ai_frequency: next.aiFrequency,
            discovery_depth: next.discoveryDepth,
          },
          { onConflict: "user_id" },
        ),
        scope,
      );
      if (error) throw error;
    },
  });
}
