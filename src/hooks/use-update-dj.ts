import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateDJInput } from "./use-create-dj";

export type UpdateDJInput = CreateDJInput & {
  djId?: string;
  regenerateAvatar?: boolean;
};

export function useUpdateDJ() {
  const queryClient = useQueryClient();

  return useMutation({
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.djs.all }),
  });
}
