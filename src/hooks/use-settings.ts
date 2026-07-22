import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";
import { queryKeys } from "@/src/api/queries";
import {
  mergePreferences,
  type UserPreferences,
} from "@/src/types/preferences";
import { supabase } from "@/src/api/supabase";

export function useSettings() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: queryKeys.settings.me,
    enabled: !!user,
    queryFn: async (): Promise<UserPreferences> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;

      return mergePreferences(data?.preferences);
    },
  });
}

export function useUpdateSettings() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (next: UserPreferences) => {
      const { error } = await supabase
        .from("profiles")
        .update({ preferences: next })
        .eq("id", user!.id);

      if (error) throw error;
    },

    // Optimistically update the query data with the new value
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.me });

      const previous = queryClient.getQueryData<UserPreferences>(
        queryKeys.settings.me,
      );

      queryClient.setQueryData(queryKeys.settings.me, next);

      return { previous };
    },
    onError: (_err, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings.me, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.me });
    },
  });
}
