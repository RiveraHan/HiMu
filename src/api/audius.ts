import type { PlayerTrack } from "@/src/stores/player-store";

const HOST = "https://api.audius.co";
const APP_NAME = "HiMu";

export type AudiusArtwork = {
  "150x150"?: string;
  "480x480"?: string;
  "1000x1000"?: string;
};

// Minimal shape of an Audius track — only the fields we consume.
export type AudiusTrack = {
  id: string;
  title: string;
  user: { name: string; handle: string };
  artwork: AudiusArtwork | null;
  genre: string | null;
  mood: string | null;
  duration: number | null;
  permalink: string | null;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_delete?: boolean;
};

// Only tracks that will actually play: streamable, not gated, not deleted.
export function isPlayable(t: AudiusTrack): boolean {
  return t.is_streamable !== false && !t.is_stream_gated && !t.is_delete;
}

// Audius track -> app PlayerTrack. Id is namespaced so external tracks never
// collide with our UUIDs and own-track features (regenerate cover) no-op.
// audio_url is the stable /stream endpoint; Audius 302-redirects and re-signs
// per play, so we must never persist the resolved CDN URL.
export function mapAudiusTrack(t: AudiusTrack): PlayerTrack {
  return {
    id: `audius:${t.id}`,
    title: t.title,
    artist: t.user?.name ?? "Unknown artist",
    album_art_url: t.artwork?.["480x480"] ?? t.artwork?.["1000x1000"] ?? null,
    duration: t.duration ?? null,
    genre: t.genre ?? null,
    audio_url: `${HOST}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`,
  };
}

type AudiusListResponse = { data?: AudiusTrack[] };

async function fetchTracks(
  path: string,
  params: Record<string, string>,
): Promise<PlayerTrack[]> {
  const qs = new URLSearchParams({ ...params, app_name: APP_NAME }).toString();
  const res = await fetch(`${HOST}${path}?${qs}`);
  if (!res.ok) throw new Error(`Audius ${path} (${res.status})`);
  const json = (await res.json()) as AudiusListResponse;
  return (json.data ?? []).filter(isPlayable).map(mapAudiusTrack);
}

// Trending tracks, optionally filtered by an Audius genre string.
export function getTrending(
  opts: { genre?: string; limit?: number } = {},
): Promise<PlayerTrack[]> {
  const params: Record<string, string> = { limit: String(opts.limit ?? 20) };
  if (opts.genre) params.genre = opts.genre;
  return fetchTracks("/v1/tracks/trending", params);
}

// Full-text track search.
export function searchTracks(
  query: string,
  opts: { limit?: number } = {},
): Promise<PlayerTrack[]> {
  return fetchTracks("/v1/tracks/search", {
    query,
    limit: String(opts.limit ?? 20),
  });
}
