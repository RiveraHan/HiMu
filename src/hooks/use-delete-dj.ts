import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authMutationKey, captureAuthScope, invokeWithAuthScope, isCurrentMutationUser } from "@/src/api/auth-scope";
import { useCurrentUser } from "./use-auth";

// Deletes an owned DJ (edge function cleans DB via cascade + R2 assets).
export function useDeleteDJ() {
  const queryClient = useQueryClient();
  const userId = useCurrentUser()?.id ?? "";

  return useMutation({
    mutationKey: authMutationKey("delete-dj", userId),
    mutationFn: async ({ djId }: { djId: string }) => {
      const scope = captureAuthScope(userId);
      const { data, error } = await invokeWithAuthScope<{ ok: boolean }>(
        supabase.functions,
        scope,
        "delete-dj",
        {
          body: { djId },
        },
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (!isCurrentMutationUser(userId)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.djs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks.all });
    },
  });
}
