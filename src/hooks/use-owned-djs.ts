import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";

export type OwnedDj = {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
};

export async function fetchOwnedDjs(userId: string): Promise<OwnedDj[]> {
  const { data, error } = await supabase
    .from("djs")
    .select("id, name, created_at, owner_id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<OwnedDj[]>();

  if (error) throw error;
  return data ?? [];
}

export function useOwnedDjs() {
  const userId = useCurrentUser()?.id ?? null;

  return useQuery({
    queryKey: queryKeys.djs.owned(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (__DEV__ && process.env.EXPO_PUBLIC_BETA_SMOKE === "1") {
        if (userId === "beta-smoke-local-user") return [];
      }
      return fetchOwnedDjs(userId!);
    },
  });
}
