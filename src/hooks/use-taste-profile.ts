import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import type { TasteWeights } from "@/src/utils/weighted-shuffle";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentUser } from "./use-auth";
import { useMusicPreferences } from "./use-music-preferences";

const TOP_GENRE_DAYS = 14;
const EMPTY: ReadonlySet<string> = new Set();

/**
 * The user's taste, combined from explicit preferences and recent listening.
 * Neutral (empty sets, null topGenre) while loading or without data, so
 * consumers degrade to today's behavior.
 */
export function useTasteProfile(): TasteWeights {
  const user = useCurrentUser();
  const { data: prefs } = useMusicPreferences();

  const { data: topGenre } = useQuery({
    queryKey: queryKeys.stats.topGenre(user?.id ?? null),
    enabled: !!user,
    queryFn: async (): Promise<string | null> => {
      const since = new Date(Date.now() - TOP_GENRE_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const { data, error } = await supabase
        .from("listening_stats")
        .select("top_genre")
        .eq("user_id", user!.id)
        .gte("date", since)
        .not("top_genre", "is", null);

      if (error) throw error;

      // Mode of the daily top_genre values.
      const counts = new Map<string, number>();
      for (const row of data) {
        if (!row.top_genre) continue;
        counts.set(row.top_genre, (counts.get(row.top_genre) ?? 0) + 1);
      }

      let best: string | null = null;
      let bestCount = 0;
      for (const [genre, n] of counts) {
        if (n > bestCount) {
          best = genre;
          bestCount = n;
        }
      }
      return best;
    },
  });

  return useMemo(
    () => ({
      affineGenres: prefs ? new Set(prefs.genres) : EMPTY,
      excludedMoods: prefs ? new Set(prefs.excludedMoods) : EMPTY,
      topGenre: topGenre ?? null,
    }),
    [prefs, topGenre],
  );
}
