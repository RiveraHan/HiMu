import {
  boundedDefaultLyrics,
  buildCaptionInput,
  buildCaptionTtsInput,
  buildMusicInput,
  creativeTitle,
  type GenerationLanguage,
  parseGenerationLanguage,
  persistedAudiusArtistName,
  validateLyrics,
} from "./generation-models.ts";

type JobSummary = { id: string; status: string };

export const MANUAL_JOB_LEASE_MS = 15 * 60 * 1000;

export type ManualJobReservation =
  | { outcome: "created"; jobId: string; dailyLimit: number }
  | { outcome: "existing"; jobId: string; dailyLimit: number }
  | { outcome: "quota"; jobId: null; dailyLimit: number };

export function mapManualJobReservation(
  data: unknown,
  error: unknown,
): ManualJobReservation {
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("invalid manual job reservation result");
  }

  const row = data[0] as Record<string, unknown>;
  if (typeof row.daily_limit !== "number") {
    throw new Error("invalid manual job reservation result");
  }
  if (row.outcome === "quota") {
    return {
      outcome: "quota",
      jobId: null,
      dailyLimit: row.daily_limit,
    };
  }
  if (
    (row.outcome === "created" || row.outcome === "existing") &&
    typeof row.job_id === "string" &&
    row.job_id.length > 0
  ) {
    return {
      outcome: row.outcome,
      jobId: row.job_id,
      dailyLimit: row.daily_limit,
    };
  }
  throw new Error("invalid manual job reservation result");
}

export function mapUpdatedRow(data: unknown, error: unknown): boolean {
  if (error) throw error;
  if (data === null) return false;
  if (
    typeof data !== "object" || Array.isArray(data) ||
    typeof (data as Record<string, unknown>).id !== "string"
  ) {
    throw new Error("invalid generation job update result");
  }
  return true;
}

export function mapFinalizedGeneratedMix(
  data: unknown,
  error: unknown,
  expectedJobId: string,
  expectedTrackId: string,
): { id: string; title: string } {
  if (error) throw error;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("invalid generated mix finalization result");
  }
  const row = data as Record<string, unknown>;
  if (
    row.job_id !== expectedJobId ||
    row.track_id !== expectedTrackId ||
    typeof row.track_title !== "string"
  ) {
    throw new Error("generated mix finalization mismatch");
  }
  return { id: row.track_id, title: row.track_title };
}

export type RunGenerationInput = {
  jobId: string;
  cfg: any;
  lyrics: string | null;
  seasoning: string[];
  language: GenerationLanguage;
  drop?: { localHour: unknown };
};

export type RequestDependencies = {
  getDjConfig: (djId: unknown) => Promise<any | null>;
  buildSeasoning: (
    userId: string,
    dj: any,
    localHour: unknown,
  ) => Promise<string[]>;
  findDailyJob: (
    userId: string,
    dropDate: unknown,
  ) => Promise<JobSummary | null>;
  requeueDailyJob: (jobId: string, updatedAt: string) => Promise<void>;
  createDailyJob: (input: {
    userId: string;
    djId: unknown;
    dropDate: unknown;
  }) => Promise<{ job: JobSummary | null; error: unknown }>;
  findActiveManualJob: (
    userId: string,
    djId: unknown,
  ) => Promise<(JobSummary & { updatedAt: string }) | null>;
  failStaleManualJob: (
    jobId: string,
    observedUpdatedAt: string,
    failedAt: string,
  ) => Promise<boolean>;
  reserveManualJob: (input: {
    userId: string;
    djId: unknown;
    lyrics: string | null;
  }) => Promise<ManualJobReservation>;
  runGeneration: (input: RunGenerationInput) => Promise<void>;
  waitUntil: (promise: Promise<void>) => void;
  now: () => string;
};

export type RequestResult = {
  status: number;
  body: Record<string, unknown>;
};

function result(status: number, body: Record<string, unknown>): RequestResult {
  return { status, body };
}

function invalid(error: string): RequestResult {
  return result(400, { error, code: "invalid_input" });
}

export async function handleGenerateMixRequest(
  rawBody: unknown,
  userId: string,
  deps: RequestDependencies,
): Promise<RequestResult> {
  const body = typeof rawBody === "object" && rawBody != null &&
      !Array.isArray(rawBody)
    ? rawBody as Record<string, unknown>
    : {};
  const {
    djId,
    lyrics: rawLyrics,
    language: rawLanguage,
    localHour,
    dropDate,
  } = body;

  let language: GenerationLanguage;
  let requestedLyrics: string | null;
  try {
    language = parseGenerationLanguage(rawLanguage);
    requestedLyrics = validateLyrics(rawLyrics);
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : "invalid generation input",
    );
  }

  if (!djId) return invalid("djId required");

  const isDrop = dropDate != null;
  if (isDrop && !/^\d{4}-\d{2}-\d{2}$/.test(String(dropDate))) {
    return invalid("dropDate must be YYYY-MM-DD");
  }

  const cfg = await deps.getDjConfig(djId);
  if (!cfg) return result(404, { error: "DJ config not found" });

  const owner: string | null = cfg.djs?.owner_id ?? null;
  if (owner !== null && owner !== userId) {
    return result(403, {
      error: "you can't generate with this DJ",
      code: "dj_not_allowed",
    });
  }

  let lyrics: string | null = null;
  if (!isDrop && requestedLyrics != null) {
    if (cfg.is_instrumental !== false || owner !== userId) {
      return invalid("lyrics are only allowed on your own vocal DJs");
    }
    lyrics = requestedLyrics;
  }

  if (isDrop) {
    const seasoning = await deps.buildSeasoning(userId, cfg.djs, localHour);
    const existing = await deps.findDailyJob(userId, dropDate);
    if (existing && existing.status !== "failed") {
      return result(200, { jobId: existing.id });
    }

    if (existing) {
      await deps.requeueDailyJob(existing.id, deps.now());
      deps.waitUntil(
        deps.runGeneration({
          jobId: existing.id,
          cfg,
          lyrics: null,
          seasoning,
          language,
          drop: { localHour },
        }),
      );
      return result(200, { jobId: existing.id });
    }

    const created = await deps.createDailyJob({ userId, djId, dropDate });
    if (!created.job) {
      const raced = await deps.findDailyJob(userId, dropDate);
      if (raced) return result(200, { jobId: raced.id });
      throw created.error ?? new Error("could not create drop job");
    }

    deps.waitUntil(
      deps.runGeneration({
        jobId: created.job.id,
        cfg,
        lyrics: null,
        seasoning,
        language,
        drop: { localHour },
      }),
    );
    return result(200, { jobId: created.job.id });
  }

  const active = await deps.findActiveManualJob(userId, djId);
  if (active) {
    const now = deps.now();
    const ageMs = Date.parse(now) - Date.parse(active.updatedAt);
    if (ageMs <= MANUAL_JOB_LEASE_MS) {
      return result(200, { jobId: active.id });
    }

    const released = await deps.failStaleManualJob(
      active.id,
      active.updatedAt,
      now,
    );
    if (!released) {
      const refreshed = await deps.findActiveManualJob(userId, djId);
      if (refreshed) return result(200, { jobId: refreshed.id });
    }
  }

  const reservation = await deps.reserveManualJob({ userId, djId, lyrics });
  if (reservation.outcome === "quota") {
    return result(429, {
      error: `daily limit of ${reservation.dailyLimit} mixes reached`,
      code: "daily_quota_reached",
    });
  }
  if (reservation.outcome === "existing") {
    return result(200, { jobId: reservation.jobId });
  }

  const seasoning = await deps.buildSeasoning(userId, cfg.djs, localHour);
  deps.waitUntil(
    deps.runGeneration({
      jobId: reservation.jobId,
      cfg,
      lyrics,
      seasoning,
      language,
    }),
  );
  return result(200, { jobId: reservation.jobId });
}

type MediaResponse = {
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export async function downloadProviderMedia(
  url: string,
  fetchMedia: (url: string) => Promise<MediaResponse>,
): Promise<Uint8Array> {
  const response = await fetchMedia(url);
  if (!response.ok) {
    throw new Error(`provider media download failed (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("provider media download returned empty bytes");
  }
  return bytes;
}

type ModelRole = "audius" | "music" | "cover" | "caption" | "tts";
type ModelEvent = { role: ModelRole; language: GenerationLanguage };
type GenerationErrorStage =
  | "audius_pick"
  | "audius_materialize"
  | "caption"
  | "caption_audio"
  | "terminal_ambiguous"
  | "job_failure_persist";

export type RunDependencies = {
  updateJob: (
    jobId: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  markJobGenerating: (
    jobId: string,
    startedAt: string,
  ) => Promise<boolean>;
  finalizeGeneratedMix: (input: {
    jobId: string;
    trackId: string;
    title: string;
    artist: string;
    audioUrl: string;
    albumArtUrl: string | null;
    genre: string | null;
    moodTags: string[] | null;
    duration: number;
    djId: string;
    caption: string | null;
    captionAudioUrl: string | null;
    finishedAt: string;
  }) => Promise<{ id: string; title: string }>;
  failJobIfActive: (
    jobId: string,
    error: string,
    failedAt: string,
  ) => Promise<boolean>;
  findAudiusTrack: (externalId: string) => Promise<{ id: string } | null>;
  insertAudiusTrack: (
    track: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  pickAudiusDrop: (
    dj: any,
    localHour: unknown,
    language: GenerationLanguage,
  ) => Promise<{ pick: any; caption: string } | null>;
  replicateRun: (endpoint: string, body: object) => Promise<string>;
  replicateText: (endpoint: string, body: object) => Promise<string>;
  fetchMedia: (url: string) => Promise<MediaResponse>;
  r2Put: (
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ) => Promise<string>;
  r2Delete: (keys: string[]) => Promise<void>;
  generateCover: (
    jobId: string,
    dj: any,
    instrumental: boolean,
  ) => Promise<string | null>;
  streamUrl: (trackId: string) => string;
  logModel: (event: ModelEvent) => void;
  logError?: (event: { stage: GenerationErrorStage }) => void;
  now: () => string;
  randomId: () => string;
  random?: () => number;
};

function trackSeconds(cfg: any): number {
  return Math.min(Number(cfg.max_duration) || 150, 190);
}

function observe(
  deps: RunDependencies,
  role: ModelRole,
  language: GenerationLanguage,
): void {
  deps.logModel({ role, language });
}

function report(
  deps: RunDependencies,
  stage: GenerationErrorStage,
): void {
  deps.logError?.({ stage });
}

function parseCaption(raw: string): string | null {
  const marked =
    raw.match(/\[CAPTION_START\]\s*([\s\S]*?)\s*\[CAPTION_END\]/i)?.[1] ??
      raw;
  const line = marked
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .slice(0, 140)
    .trim();
  return line || null;
}

async function buildCaptionAudio(
  input: RunGenerationInput,
  deps: RunDependencies,
  caption: string,
): Promise<string> {
  const dj = input.cfg.djs;
  const request = buildCaptionTtsInput(
    input.language,
    dj?.voice_style,
    dj?.mood_tags,
    caption.slice(0, 300),
  );
  observe(deps, "tts", input.language);
  const tempUrl = await deps.replicateRun(request.endpoint, request.body);
  const bytes = await downloadProviderMedia(tempUrl, deps.fetchMedia);
  return await deps.r2Put(
    `captions/generated/${input.jobId}.mp3`,
    bytes,
    "audio/mpeg",
  );
}

async function tryAudiusDrop(
  input: RunGenerationInput,
  deps: RunDependencies,
): Promise<boolean> {
  const dj = input.cfg.djs;
  let picked: { pick: any; caption: string } | null;
  try {
    observe(deps, "audius", input.language);
    picked = await deps.pickAudiusDrop(
      dj,
      input.drop?.localHour,
      input.language,
    );
  } catch (_error) {
    report(deps, "audius_pick");
    return false;
  }
  if (!picked) return false;

  try {
    const { pick, caption } = picked;
    const existing = await deps.findAudiusTrack(pick.id);
    let trackId = existing?.id;
    if (!trackId) {
      const track = await deps.insertAudiusTrack({
        title: pick.title,
        artist: persistedAudiusArtistName(pick.user?.name),
        audio_url: deps.streamUrl(pick.id),
        album_art_url:
          pick.artwork?.["480x480"] ?? pick.artwork?.["1000x1000"] ?? null,
        genre: pick.genre ?? dj.genre_specialties?.[0] ?? null,
        mood_tags: dj.mood_tags,
        duration: pick.duration ?? null,
        is_ai_generated: false,
        source: "audius",
        external_id: pick.id,
        dj_id: input.cfg.dj_id,
      });
      trackId = track.id;
    }

    let captionAudioUrl: string | null = null;
    try {
      captionAudioUrl = await buildCaptionAudio(input, deps, caption);
    } catch (_error) {
      report(deps, "caption_audio");
    }

    await deps.updateJob(input.jobId, {
      status: "ready",
      track_id: trackId,
      caption,
      caption_audio_url: captionAudioUrl,
      updated_at: deps.now(),
    });
    return true;
  } catch (_error) {
    report(deps, "audius_materialize");
    return false;
  }
}

export async function runGeneration(
  input: RunGenerationInput,
  deps: RunDependencies,
): Promise<void> {
  const started = await deps.markJobGenerating(input.jobId, deps.now());
  if (!started) return;

  try {
    if (input.drop && await tryAudiusDrop(input, deps)) return;

    const musicRequest = buildMusicInput({
      basePrompt: String(input.cfg.base_prompt),
      seasoning: input.seasoning,
      instrumental: input.cfg.is_instrumental ?? true,
      durationSeconds: trackSeconds(input.cfg),
      language: input.language,
      lyrics: input.lyrics ?? boundedDefaultLyrics(input.cfg.default_lyrics),
    });
    observe(deps, "music", input.language);
    const musicUrl = await deps.replicateRun(
      musicRequest.endpoint,
      musicRequest.body,
    );
    const musicBytes = await downloadProviderMedia(
      musicUrl,
      deps.fetchMedia,
    );
    const publicUrl = await deps.r2Put(
      `tracks/generated/${input.jobId}.mp3`,
      musicBytes,
      "audio/mpeg",
    );

    const dj = input.cfg.djs;
    observe(deps, "cover", input.language);
    const cover = await deps.generateCover(
      input.jobId,
      dj,
      input.cfg.is_instrumental ?? true,
    );
    const trackId = deps.randomId();
    const title = creativeTitle(input.language, deps.random);

    let caption: string | null = null;
    let captionAudioUrl: string | null = null;
    if (input.drop) {
      try {
        const captionRequest = buildCaptionInput({
          dj,
          localHour: input.drop.localHour,
          trackTitle: title,
          language: input.language,
        });
        observe(deps, "caption", input.language);
        const raw = await deps.replicateText(
          captionRequest.endpoint,
          captionRequest.body,
        );
        caption = parseCaption(raw);
        if (caption) {
          try {
            captionAudioUrl = await buildCaptionAudio(input, deps, caption);
          } catch (_error) {
            report(deps, "caption_audio");
          }
        }
      } catch (_error) {
        report(deps, "caption");
      }
    }

    await deps.finalizeGeneratedMix({
      jobId: input.jobId,
      trackId,
      title,
      artist: dj.name,
      audioUrl: publicUrl,
      albumArtUrl: cover,
      genre: dj.genre_specialties?.[0] ?? null,
      moodTags: dj.mood_tags ?? null,
      duration: trackSeconds(input.cfg),
      djId: input.cfg.dj_id,
      caption,
      captionAudioUrl,
      finishedAt: deps.now(),
    });
  } catch (error) {
    let failed: boolean;
    try {
      failed = await deps.failJobIfActive(
        input.jobId,
        String(error).slice(0, 500),
        deps.now(),
      );
    } catch (_failureError) {
      report(deps, "job_failure_persist");
      return;
    }

    if (!failed) {
      report(deps, "terminal_ambiguous");
      return;
    }

    await deps.r2Delete([
      `tracks/generated/${input.jobId}.mp3`,
      `covers/generated/${input.jobId}.jpg`,
      `captions/generated/${input.jobId}.mp3`,
    ]);
  }
}
