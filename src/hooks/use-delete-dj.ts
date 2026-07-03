import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Deletes an owned DJ (edge function cleans DB via cascade + R2 assets).
export function useDeleteDJ() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ djId }: { djId: string }) => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean }>(
        "delete-dj",
        {
          body: { djId },
        },
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.djs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks.all });
    },
  });
}
