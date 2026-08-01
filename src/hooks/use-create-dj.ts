import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { activityMutationKeys } from "@/src/activity/mutation-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";

export type CreateDJInput = {
  name: string;
  genres: string[];
  moods: string[];
  energy: number; // 1-10
  isInstrumental: boolean;
  vibe?: string;
};

export function useCreateDJ() {
  const queryClient = useQueryClient();
  const userId = useCurrentUser()?.id ?? "";

  return useMutation({
    mutationKey: activityMutationKeys.createDj(userId),
    gcTime: Infinity,
    mutationFn: async (input: CreateDJInput) => {
      const { data, error } = await supabase.functions.invoke<{
        djId: string;
        avatarReady: boolean;
      }>("create-dj", {
        body: input,
      });

      if (error) throw error;

      if (!data?.djId) throw new Error("create-dj did not return a djId");

      return data;
    },
    onMutate: () => ({ submittedUserId: userId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.djs.all });
    },
  });
}
