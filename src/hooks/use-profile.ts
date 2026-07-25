import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";

export function useProfile() {
  const user = useCurrentUser();

  return useQuery({
    queryKey: queryKeys.profile.me,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, subscription_tier")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;

      const meta = user!.user_metadata;

      // Fallback to user metadata if profile data is not available
      return {
        name: (
          data?.display_name ??
          meta.full_name ??
          meta.name ??
          null
        ) as string | null,
        username: (data?.username ??
          user!.email?.split("@")[0] ??
          "") as string,
        avatarUrl: (data?.avatar_url ?? meta.avatar_url ?? meta.picture) as
          | string
          | undefined,
        subscriptionTier: (data?.subscription_tier ?? "free") as
          | "free"
          | "premium",
      };
    },
  });
}

export function useListeningTotals() {
  return useQuery({
    queryKey: queryKeys.stats.listening,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listening_stats")
        .select("minutes_listened, tracks_played, top_genre");
      if (error) throw error;

      const minutes = data.reduce((s, r) => s + (r.minutes_listened ?? 0), 0);
      const tracks = data.reduce((s, r) => s + (r.tracks_played ?? 0), 0);

      const frequency = new Map<string, number>();
      data.forEach((r) => {
        if (r.top_genre)
          frequency.set(r.top_genre, (frequency.get(r.top_genre) ?? 0) + 1);
      });

      // Most frequent session genre → listening identity.
      const topGenre =
        [...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return { hours: minutes / 60, tracks, topGenre };
    },
  });
}

export function useDjsHeard() {
  return useQuery({
    queryKey: queryKeys.stats.djsHeard,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("dj_listens")
        .select("dj_id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}
