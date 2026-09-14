import {
  parseGeneratedPublicKey,
  safePublicHttpsUrl,
} from "../_shared/media-reference.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_TRACK_FIELDS =
  "id,title,artist,album_art_url,audio_url,duration,genre,mood_tags,is_public";

type QueryError = Readonly<{ message?: string }>;

export type PublicTrackDatabase = {
  from(table: string): {
    select(fields: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: unknown; error: QueryError | null }>;
      };
    };
  };
};

export type PublicTrackDependencies = Readonly<{
  publicBase: string;
  loadTrack(trackId: string): Promise<unknown>;
}>;

export type PublicTrackResult = Readonly<{
  status: number;
  body: Record<string, unknown>;
}>;

function unavailable(): PublicTrackResult {
  return { status: 404, body: { code: "not_found" } };
}

function isSafeRequiredText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= maxLength && value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return isSafeRequiredText(value, maxLength) ? value : undefined;
}

function safeMoods(value: unknown): string[] | null {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > 16) return null;
  return value.every((mood) => isSafeRequiredText(mood, 80))
    ? [...value]
    : null;
}

function projectPublicTrack(
  raw: unknown,
  requestedId: string,
  publicBase: string,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (
    row.id !== requestedId || row.is_public !== true ||
    !isSafeRequiredText(row.title, 240) ||
    !isSafeRequiredText(row.artist, 240)
  ) {
    return null;
  }

  const audioUrl = safePublicHttpsUrl(row.audio_url);
  const audioKey = audioUrl
    ? parseGeneratedPublicKey(audioUrl, publicBase)
    : null;
  if (!audioUrl || audioKey?.kind !== "track") return null;

  const duration = row.duration;
  if (
    duration !== null &&
    (!Number.isSafeInteger(duration) || (duration as number) < 0)
  ) {
    return null;
  }
  const genre = optionalText(row.genre, 80);
  if (genre === undefined) return null;
  const moods = safeMoods(row.mood_tags);
  if (!moods) return null;

  return {
    id: requestedId,
    title: row.title,
    artist: row.artist,
    albumArtUrl: safePublicHttpsUrl(row.album_art_url),
    audioUrl,
    duration,
    genre,
    moods,
  };
}

export function createPublicTrackDependencies(
  database: PublicTrackDatabase,
  publicBase: string,
): PublicTrackDependencies {
  return {
    publicBase,
    loadTrack: async (trackId) => {
      const { data, error } = await database
        .from("tracks")
        .select(PUBLIC_TRACK_FIELDS)
        .eq("id", trackId)
        .maybeSingle();
      if (error) throw new Error("public_track_unavailable");
      return data;
    },
  };
}

export async function handlePublicTrackRequest(
  rawTrackId: unknown,
  dependencies: PublicTrackDependencies,
): Promise<PublicTrackResult> {
  if (typeof rawTrackId !== "string" || !UUID.test(rawTrackId)) {
    return unavailable();
  }
  try {
    const row = await dependencies.loadTrack(rawTrackId);
    const projection = projectPublicTrack(
      row,
      rawTrackId,
      dependencies.publicBase,
    );
    return projection
      ? { status: 200, body: projection }
      : unavailable();
  } catch {
    return { status: 503, body: { code: "unavailable" } };
  }
}

export async function handlePublicTrackHttpRequest(
  request: Pick<Request, "method" | "url">,
  dependencies: PublicTrackDependencies,
): Promise<PublicTrackResult> {
  if (request.method !== "GET") {
    return { status: 405, body: { code: "method_not_allowed" } };
  }
  const parameters = new URL(request.url).searchParams;
  if (
    [...parameters.keys()].some((key) => key !== "id") ||
    parameters.getAll("id").length !== 1
  ) {
    return unavailable();
  }
  return handlePublicTrackRequest(parameters.get("id"), dependencies);
}
