import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { activityMutationKeys } from "@/src/activity/mutation-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";
import { captureAuthScope, invokeWithAuthScope, isCurrentMutationUser } from "@/src/api/auth-scope";

export type CreateDJInput = {
  name: string;
  // Becomes required by the creation screen when the identity step lands.
  identityConcept?: string;
  genres: string[];
  moods: string[];
  energy: number; // 1-10
  isInstrumental: boolean;
  vibe?: string;
  isPublic: boolean;
};

export function useCreateDJ() {
  const queryClient = useQueryClient();
  const userId = useCurrentUser()?.id ?? "";

  return useMutation({
    mutationKey: activityMutationKeys.createDj(userId),
    gcTime: Infinity,
    mutationFn: async (input: CreateDJInput) => {
      const scope = captureAuthScope(userId);
      const { data, error } = await invokeWithAuthScope<{
        djId: string;
        avatarReady: boolean;
      }>(supabase.functions, scope, "create-dj", {
        body: input,
      });

      if (error) throw error;

      if (!data?.djId) throw new Error("create-dj did not return a djId");

      return data;
    },
    onMutate: () => ({ submittedUserId: userId }),
    onSuccess: () => {
      if (!isCurrentMutationUser(userId)) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.djs.all });
    },
  });
}
