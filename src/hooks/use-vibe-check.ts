import { buildVibeCheck, toISODate } from "@/src/utils/vibe-stats";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";

const WINDOW_DAYS = 60;

export function useVibeCheck() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: queryKeys.stats.vibeCheck(user?.id ?? null),
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - (WINDOW_DAYS - 1));

      const { data, error } = await supabase
        .from("listening_stats")
        .select("date, minutes_listened, tracks_played, top_genre")
        .eq("user_id", user!.id)
        .gte("date", toISODate(since))
        .order("date", { ascending: true });

      if (error) throw error;
      return buildVibeCheck(data ?? [], new Date());
    },
  });
}
