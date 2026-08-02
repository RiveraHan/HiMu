import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeGenerationJob } from "@/src/activity/generation-activity";
import type {
  ActivityItem,
  GenerationJobRow,
} from "@/src/activity/types";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";

export function useGenerationActivity(): UseQueryResult<ActivityItem[]> {
  const user = useCurrentUser();

  return useQuery({
    queryKey: queryKeys.generationJobs.activity(user?.id ?? null),
    enabled: !!user,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("generation_jobs")
        .select(
          "id,user_id,dj_id,status,prompt,error,created_at,updated_at,drop_date,track_id,is_public,djs(id,name),tracks(id,title,artist,audio_url,album_art_url,duration,genre)",
        )
        .eq("user_id", user!.id)
        .is("drop_date", null)
        .or(`status.in.(queued,generating),created_at.gte.${cutoff}`)
        .order("updated_at", { ascending: false })
        .returns<GenerationJobRow[]>();
      if (error) throw error;
      return data
        .map((row) => normalizeGenerationJob(row, Date.now()))
        .filter((item): item is ActivityItem => item !== null);
    },
    refetchInterval: (query) =>
      query.state.data?.some((item) =>
        ["queued", "running", "slow"].includes(item.status),
      )
        ? 3000
        : false,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
}
