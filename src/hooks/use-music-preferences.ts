import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import {
  mergeMusicPreferences,
  MusicPreferences,
} from "@/src/types/music-preferences";
import { useCurrentUser } from "./use-auth";

export function useMusicPreferences() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: queryKeys.musicPreferences.me,
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (next: MusicPreferences) => {
      const { error } = await supabase.from("music_preferences").upsert(
        {
          user_id: user!.id,
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
      );
      if (error) throw error;
    },

    onMutate: async (next) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.musicPreferences.me,
      });

      const previous = queryClient.getQueryData<MusicPreferences>(
        queryKeys.musicPreferences.me,
      );

      queryClient.setQueryData(queryKeys.musicPreferences.me, next);

      return { previous };
    },
    onError: (_err, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData<MusicPreferences>(
          queryKeys.musicPreferences.me,
          context.previous,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.musicPreferences.me,
      });
    },
  });
}
