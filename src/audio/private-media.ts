import {
  type AuthScope,
  assertCurrentMutationUser,
  invokeWithAuthScope,
} from "@/src/api/auth-scope";
import type { PlayerTrack } from "@/src/stores/player-store";

type FunctionsLike = {
  invoke(functionName: string, options?: Record<string, unknown>): Promise<unknown>;
};

const PRIVATE_TRACK_REFERENCE =
  /^r2-private:\/\/tracks\/generated\/[A-Za-z0-9._%:-]+\/[A-Za-z0-9._%:-]+\.mp3$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validSignedResponse(data: unknown): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (
    typeof row.url !== "string" || !Number.isInteger(row.expiresIn) ||
    (row.expiresIn as number) < 60 || (row.expiresIn as number) > 300
  ) return null;
  try {
    return new URL(row.url).protocol === "https:" ? row.url : null;
  } catch {
    return null;
  }
}

export async function resolveTrackPlaybackUrl(
  track: Pick<PlayerTrack, "id" | "audio_url">,
  scope: AuthScope,
  functions: FunctionsLike,
): Promise<string> {
  if (!track.audio_url.startsWith("r2-private://")) return track.audio_url;
  if (!PRIVATE_TRACK_REFERENCE.test(track.audio_url) || !UUID.test(track.id)) {
    throw new Error("invalid private media reference");
  }

  const { data, error } = await invokeWithAuthScope<{
    url: string;
    expiresIn: number;
  }>(functions, scope, "private-media-url", {
    body: { kind: "track", trackId: track.id },
  });
  if (error) throw error;
  assertCurrentMutationUser(scope.userId);
  const url = validSignedResponse(data);
  if (!url) throw new Error("invalid private media response");
  return url;
}
