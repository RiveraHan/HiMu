import { getTrending, searchTracks } from "@/src/api/audius";
import { queryKeys } from "@/src/api/queries";
import type { PlayerTrack } from "@/src/stores/player-store";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const TEN_MIN = 10 * 60 * 1000;

// Trending Audius tracks. Pass a genre to filter, or omit for overall trending.
export function useAudiusTrending(genre?: string) {
  return useQuery<PlayerTrack[]>({
    queryKey: queryKeys.audius.trending(genre ?? "all"),
    queryFn: () => getTrending({ genre }),
    staleTime: TEN_MIN,
  });
}

// Track search. Disabled until the trimmed query has at least 2 characters.
export function useAudiusSearch(query: string) {
  const q = query.trim();
  return useQuery<PlayerTrack[]>({
    queryKey: queryKeys.audius.search(q),
    queryFn: () => searchTracks(q),
    enabled: q.length >= 2,
    staleTime: TEN_MIN,
    placeholderData: keepPreviousData,
  });
}
