import { queryKeys } from "@/src/api/queries";
import type { PublicTrackMoment } from "@/src/moment/moment-types";
import { useQuery } from "@tanstack/react-query";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublicTrackRequest = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

type PublicTrackRequestDependencies = Readonly<{
  supabaseUrl: string | undefined;
  publishableKey: string | undefined;
  request: PublicTrackRequest;
}>;

export class PublicTrackUnavailableError extends Error {
  constructor() {
    super("public_track_unavailable");
    this.name = "PublicTrackUnavailableError";
  }
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= maxLength && value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function validOptionalText(
  value: unknown,
  maxLength: number,
): value is string | null {
  return value === null || validText(value, maxLength);
}

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function parsePublicTrack(value: unknown): PublicTrackMoment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" || !UUID.test(row.id) ||
    !validText(row.title, 240) ||
    !validText(row.artist, 240) ||
    (row.albumArtUrl !== null && !validHttpsUrl(row.albumArtUrl)) ||
    !validHttpsUrl(row.audioUrl) ||
    (row.duration !== null && (!Number.isSafeInteger(row.duration) || (row.duration as number) < 0)) ||
    !validOptionalText(row.genre, 80) ||
    !Array.isArray(row.moods) ||
    row.moods.length > 16 ||
    !row.moods.every((mood) => validText(mood, 80))
  ) {
    return null;
  }
  return Object.freeze({
    id: row.id,
    title: row.title,
    artist: row.artist,
    albumArtUrl: row.albumArtUrl,
    audioUrl: row.audioUrl,
    duration: row.duration as number | null,
    genre: row.genre,
    moods: Object.freeze([...row.moods]) as readonly string[],
  });
}

export async function fetchPublicTrackMoment(
  trackId: string,
  dependencies: PublicTrackRequestDependencies = {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_KEY,
    request: (input, init) => fetch(input, init),
  },
): Promise<PublicTrackMoment> {
  if (
    !UUID.test(trackId) || !dependencies.supabaseUrl ||
    !dependencies.publishableKey
  ) {
    throw new PublicTrackUnavailableError();
  }
  let endpoint: URL;
  try {
    endpoint = new URL("/functions/v1/public-track", dependencies.supabaseUrl);
  } catch {
    throw new PublicTrackUnavailableError();
  }
  endpoint.searchParams.set("id", trackId);

  let response: Response;
  try {
    response = await dependencies.request(endpoint.toString(), {
      method: "GET",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        apikey: dependencies.publishableKey,
      },
    });
  } catch {
    throw new Error("public_track_request_failed");
  }
  if (!response.ok) {
    if (response.status === 404) throw new PublicTrackUnavailableError();
    throw new Error("public_track_request_failed");
  }
  try {
    const parsed = parsePublicTrack(await response.json());
    if (!parsed || parsed.id !== trackId) throw new PublicTrackUnavailableError();
    return parsed;
  } catch (error) {
    if (error instanceof PublicTrackUnavailableError) throw error;
    throw new PublicTrackUnavailableError();
  }
}

export function usePublicTrack(trackId: string | undefined) {
  const id = typeof trackId === "string" ? trackId : "";
  return useQuery({
    queryKey: queryKeys.publicTracks.detail(id),
    queryFn: () => fetchPublicTrackMoment(id),
    enabled: UUID.test(id),
    retry: (failureCount, error) =>
      !(error instanceof PublicTrackUnavailableError) && failureCount < 2,
  });
}
