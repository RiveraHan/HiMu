// Server-side Audius client (Deno) + pure drop-selection helpers.
// Mirrors src/api/audius.ts (different runtime — cannot import across). The pure
// helpers (mapDjGenre, parsePickResponse) use no Deno APIs, so a Node/tsx check
// can exercise them.

const HOST = "https://api.audius.co";
const APP_NAME = "HiMu";

export type AudiusArtwork = {
  "150x150"?: string;
  "480x480"?: string;
  "1000x1000"?: string;
};

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

// The stable /stream endpoint (Audius 302-redirects + re-signs per play).
export function streamUrl(externalId: string): string {
  return `${HOST}/v1/tracks/${externalId}/stream?app_name=${APP_NAME}`;
}

// DJ genre_specialties -> a valid Audius genre string. Walks specialties in
// order; returns null when none map (caller falls back to overall trending).
const DJ_TO_AUDIUS_GENRE: Record<string, string> = {
  ambient: "Ambient",
  "lo-fi": "Lo-Fi",
  indie: "Alternative",
  "dream pop": "Alternative",
  techno: "Techno",
  house: "House",
  "deep house": "House",
  classical: "Classical",
  piano: "Classical",
  reggaeton: "Latin",
  "latin pop": "Latin",
  bachata: "Latin",
  salsa: "Latin",
  cumbia: "Latin",
  merengue: "Latin",
  "bossa nova": "Latin",
  "latin jazz": "Jazz",
  synthwave: "Electronic",
  afrobeat: "Electronic",
  soul: "R&B/Soul",
  "r&b": "R&B/Soul",
  funk: "Funk",
};

export function mapDjGenre(
  specialties: string[] | null | undefined,
): string | null {
  for (const g of specialties ?? []) {
    const mapped = DJ_TO_AUDIUS_GENRE[String(g).trim().toLowerCase()];
    if (mapped) return mapped;
  }
  return null;
}

// Trending playable Audius tracks in a genre (or overall when genre is null).
export async function fetchTrending(
  genre: string | null,
  limit = 12,
): Promise<AudiusTrack[]> {
  const params: Record<string, string> = {
    app_name: APP_NAME,
    limit: String(limit),
  };
  if (genre) params.genre = genre;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${HOST}/v1/tracks/trending?${qs}`);
  if (!res.ok) throw new Error(`Audius trending (${res.status})`);
  const json = (await res.json()) as { data?: AudiusTrack[] };
  return (json.data ?? []).filter(isPlayable);
}

// Parse the DJ's LLM response ("PICK: <n>\nCAPTION: <line>") into a 0-based,
// clamped index and a sanitized caption. Falls back to index 0 / null caption
// when the format is missing or garbled (the caller supplies a templated caption).
export function parsePickResponse(
  raw: string,
  count: number,
): { index: number; caption: string | null } {
  const pick = raw.match(/PICK:\s*(\d+)/i);
  const n = pick ? parseInt(pick[1], 10) : NaN;
  const index = Number.isFinite(n) && n >= 1 && n <= count ? n - 1 : 0;

  const cap = raw.match(/CAPTION:\s*([\s\S]+)/i);
  const caption = cap
    ? cap[1].trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 140).trim() ||
      null
    : null;

  return { index, caption };
}
