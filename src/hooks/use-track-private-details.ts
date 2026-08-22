import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "./use-auth";

export type TrackPrivateDetails = {
  trackId: string;
  confirmedLyrics: string;
  djId: string;
};

export function useTrackPrivateDetails(
  trackId: string | undefined,
  isOwner: boolean,
) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tracks.privateDetails(user?.id ?? null, trackId ?? ""),
    enabled: !!user?.id && !!trackId && isOwner,
    queryFn: async (): Promise<TrackPrivateDetails | null> => {
      const { data: privateDetails, error: privateError } = await supabase
        .from("track_private_details")
        .select("track_id, confirmed_lyrics")
        .eq("track_id", trackId!)
        .maybeSingle();
      if (privateError) throw privateError;
      if (!privateDetails) return null;

      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select("dj_id")
        .eq("id", trackId!)
        .maybeSingle();
      if (trackError) throw trackError;
      if (!track?.dj_id) return null;
      return {
        trackId: privateDetails.track_id,
        confirmedLyrics: privateDetails.confirmed_lyrics,
        djId: track.dj_id,
      };
    },
  });
}
