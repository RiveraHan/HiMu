export type CoverTrack = {
  id: string;
  genre: string | null;
  moodTags: string[] | null;
  djId: string;
  source: string | null;
  ownerId: string | null;
};

type CoverReservation =
  | { outcome: "reserved"; reservationId: string; dailyLimit: number }
  | { outcome: "quota"; reservationId: null; dailyLimit: number };

export function mapCoverReservation(
  data: unknown,
  error: unknown,
): CoverReservation {
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("invalid cover reservation result");
  }
  const row = data[0] as Record<string, unknown>;
  if (typeof row.daily_limit !== "number") {
    throw new Error("invalid cover reservation result");
  }
  if (row.outcome === "quota") {
    return {
      outcome: "quota",
      reservationId: null,
      dailyLimit: row.daily_limit,
    };
  }
  if (
    row.outcome === "reserved" &&
    typeof row.reservation_id === "string" &&
    row.reservation_id.length > 0
  ) {
    return {
      outcome: "reserved",
      reservationId: row.reservation_id,
      dailyLimit: row.daily_limit,
    };
  }
  throw new Error("invalid cover reservation result");
}

export function mapCoverFinalization(
  data: unknown,
  error: unknown,
): string | null {
  if (error) throw error;
  if (data === null) return null;
  if (typeof data === "string") return data;
  throw new Error("invalid cover finalization result");
}

export function mapCoverReservationFailure(
  data: unknown,
  error: unknown,
): boolean {
  if (error) throw error;
  if (typeof data === "boolean") return data;
  throw new Error("invalid cover reservation failure result");
}

export type CoverDependencies = {
  getTrack: (trackId: string) => Promise<CoverTrack | null>;
  getDjConfig: (
    djId: string,
  ) => Promise<{ isInstrumental: boolean | null } | null>;
  reserveCover: (input: {
    userId: string;
    trackId: string;
  }) => Promise<unknown>;
  generateCover: (key: string, input: {
    genre: string;
    moods: string[];
    instrumental: boolean;
  }) => Promise<string>;
  finalizeCover: (input: {
    reservationId: string;
    userId: string;
    trackId: string;
    albumArtUrl: string;
    finishedAt: string;
  }) => Promise<string | null>;
  failReservation: (input: {
    reservationId: string;
    userId: string;
    failedAt: string;
  }) => Promise<boolean>;
  keyFromPublicUrl: (url: string) => string | null;
  r2Delete: (keys: string[]) => Promise<void>;
  now: () => string;
  logError?: (event: {
    stage:
      | "old_cover_cleanup"
      | "new_cover_cleanup"
      | "terminal_ambiguous"
      | "reservation_failure_persist";
  }) => void;
};

export type CoverResult = {
  status: number;
  body: Record<string, unknown>;
};

function result(status: number, body: Record<string, unknown>): CoverResult {
  return { status, body };
}

function parseReservation(value: unknown): CoverReservation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid cover reservation result");
  }

  const row = value as Record<string, unknown>;
  if (row.outcome === "quota") {
    if (typeof row.dailyLimit !== "number") {
      throw new Error("invalid cover reservation result");
    }
    return {
      outcome: "quota",
      reservationId: null,
      dailyLimit: row.dailyLimit,
    };
  }
  if (
    row.outcome === "reserved" &&
    typeof row.reservationId === "string" &&
    row.reservationId.length > 0 &&
    typeof row.dailyLimit === "number"
  ) {
    return {
      outcome: "reserved",
      reservationId: row.reservationId,
      dailyLimit: row.dailyLimit,
    };
  }
  throw new Error("invalid cover reservation result");
}

export async function handleRegenerateCoverRequest(
  rawBody: unknown,
  userId: string,
  deps: CoverDependencies,
): Promise<CoverResult> {
  const body = typeof rawBody === "object" && rawBody !== null &&
      !Array.isArray(rawBody)
    ? rawBody as Record<string, unknown>
    : {};
  const trackId = typeof body.trackId === "string" ? body.trackId : "";
  if (!trackId) {
    return result(400, { error: "trackId required", code: "invalid_input" });
  }

  const track = await deps.getTrack(trackId);
  if (!track) return result(404, { error: "track not found" });
  if (track.source) {
    return result(403, {
      error: "this track's cover can't be regenerated",
      code: "external_track",
    });
  }
  if (track.ownerId !== userId) {
    return result(403, {
      error: "you can't regenerate this cover",
      code: "track_not_allowed",
    });
  }

  const cfg = await deps.getDjConfig(track.djId);
  const reservation = parseReservation(
    await deps.reserveCover({ userId, trackId }),
  );
  if (reservation.outcome === "quota") {
    return result(429, {
      error: `daily limit of ${reservation.dailyLimit} generations reached`,
      code: "daily_quota_reached",
      dailyLimit: reservation.dailyLimit,
    });
  }

  const key =
    `covers/generated/${trackId}-${reservation.reservationId}.jpg`;
  try {
    const url = await deps.generateCover(key, {
      genre: track.genre ?? "",
      moods: track.moodTags ?? [],
      instrumental: cfg?.isInstrumental ?? true,
    });
    const oldUrl = await deps.finalizeCover({
      reservationId: reservation.reservationId,
      userId,
      trackId,
      albumArtUrl: url,
      finishedAt: deps.now(),
    });

    if (typeof oldUrl === "string") {
      const oldKey = deps.keyFromPublicUrl(oldUrl);
      if (oldKey) {
        try {
          await deps.r2Delete([oldKey]);
        } catch (_error) {
          deps.logError?.({ stage: "old_cover_cleanup" });
        }
      }
    }

    return result(200, { album_art_url: url });
  } catch (error) {
    let failed: boolean;
    try {
      failed = await deps.failReservation({
        reservationId: reservation.reservationId,
        userId,
        failedAt: deps.now(),
      });
    } catch (_failureError) {
      deps.logError?.({ stage: "reservation_failure_persist" });
      throw error;
    }

    if (!failed) {
      deps.logError?.({ stage: "terminal_ambiguous" });
      throw error;
    }

    try {
      await deps.r2Delete([key]);
    } catch (_cleanupError) {
      deps.logError?.({ stage: "new_cover_cleanup" });
    }
    throw error;
  }
}
