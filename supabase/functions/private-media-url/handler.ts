import {
  parsePrivateMediaReference,
  type PrivateMediaKind,
} from "../_shared/media-reference.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPIRES_SECONDS = 300;

export type PrivateMediaDependencies = {
  loadTrack: (trackId: string) => Promise<{
    ownerId: string | null;
    isPublic: boolean;
    audioRef: string | null;
  } | null>;
  loadCaption: (jobId: string) => Promise<{
    userId: string;
    audioRef: string | null;
  } | null>;
  signPrivateGet: (key: string, expiresSeconds: number) => Promise<string>;
};

export type PrivateMediaResult = {
  status: number;
  body: Record<string, unknown>;
};

function result(status: number, code: string): PrivateMediaResult {
  return { status, body: { error: code, code } };
}

export async function handlePrivateMediaUrlRequest(
  raw: unknown,
  userId: string,
  dependencies: PrivateMediaDependencies,
): Promise<PrivateMediaResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return result(400, "invalid_input");
  }
  const body = raw as Record<string, unknown>;
  const kind = body.kind;
  const id = kind === "track" ? body.trackId : kind === "caption" ? body.jobId : null;
  if ((kind !== "track" && kind !== "caption") || typeof id !== "string" || !UUID.test(id)) {
    return result(400, "invalid_input");
  }

  let audioRef: string | null;
  let expectedKind: PrivateMediaKind;
  try {
    if (kind === "track") {
      const track = await dependencies.loadTrack(id);
      if (!track) return result(404, "not_found");
      if (track.isPublic) return result(409, "public_media_direct");
      if (track.ownerId !== userId) return result(403, "not_owner");
      audioRef = track.audioRef;
      expectedKind = "track";
    } else {
      const caption = await dependencies.loadCaption(id);
      if (!caption) return result(404, "not_found");
      if (caption.userId !== userId) return result(403, "not_owner");
      audioRef = caption.audioRef;
      expectedKind = "caption";
    }
  } catch {
    return result(503, "media_unavailable");
  }

  const parsed = parsePrivateMediaReference(audioRef, expectedKind);
  if (!parsed) return result(409, "invalid_media_reference");

  try {
    const url = await dependencies.signPrivateGet(parsed.key, EXPIRES_SECONDS);
    if (!URL.canParse(url) || new URL(url).protocol !== "https:") {
      return result(503, "media_unavailable");
    }
    return { status: 200, body: { url, expiresIn: EXPIRES_SECONDS } };
  } catch {
    return result(503, "media_unavailable");
  }
}
