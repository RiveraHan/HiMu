import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

  return useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.djs.all });
    },
  });
}
