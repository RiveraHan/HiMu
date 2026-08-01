import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { activityMutationKeys } from "@/src/activity/mutation-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateDJInput } from "./use-create-dj";
import { useCurrentUser } from "./use-auth";

export type UpdateDJInput = CreateDJInput & {
  djId: string;
  regenerateAvatar?: boolean;
};

export function useUpdateDJ() {
  const queryClient = useQueryClient();
  const userId = useCurrentUser()?.id ?? "";

  return useMutation({
    mutationKey: activityMutationKeys.updateDj(userId),
    gcTime: Infinity,
    mutationFn: async (input: UpdateDJInput) => {
      const { data, error } = await supabase.functions.invoke<{
        djId: string;
        avatarUrl: string | null;
      }>("update-dj", {
        body: input,
      });

      if (error) throw error;
      if (!data?.djId) throw new Error("update-dj did not return a djId");

      return data;
    },
    onMutate: () => ({ submittedUserId: userId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.djs.all });
    },
  });
}
