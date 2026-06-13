import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./use-auth";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";

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
        name:
          data?.display_name ??
          meta.full_name ??
          meta.name ??
          ("Listener" as string),
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
      const [stats, follows] = await Promise.all([
        supabase
          .from("listening_stats")
          .select("minutes_listened, tracks_played, top_genre"),
        supabase
          .from("follows")
          .select("creator_id", { count: "exact", head: true }),
      ]);

      if (stats.error) throw stats.error;
      if (follows.error) throw follows.error;

      const minutes = stats.data.reduce(
        (s, r) => s + (r.minutes_listened ?? 0),
        0,
      );
      const tracks = stats.data.reduce((s, r) => s + (r.tracks_played ?? 0), 0);

      const frequency = new Map<string, number>();
      stats.data.forEach((r) => {
        if (r.top_genre)
          frequency.set(r.top_genre, (frequency.get(r.top_genre) ?? 0) + 1);
      });

      // Get the top genre by frequency
      // Sort by frequency in descending order and get the first entry
      const topGenre =
        [...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        hours: minutes / 60,
        tracks,
        topGenre,
        following: follows.count ?? 0,
      };
    },
  });
}
