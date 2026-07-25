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
  countDailyGenerations: (userId: string) => Promise<number>;
  dailyGenerationLimit?: number;
  createManualJob: (input: {
    userId: string;
    djId: unknown;
    lyrics: string | null;
  }) => Promise<{ job: JobSummary | null; error: unknown }>;
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

  const seasoning = await deps.buildSeasoning(userId, cfg.djs, localHour);

  if (isDrop) {
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

  const dailyLimit = deps.dailyGenerationLimit ?? Number.MAX_SAFE_INTEGER;
  if ((await deps.countDailyGenerations(userId)) >= dailyLimit) {
    return result(429, {
      error: `daily limit of ${dailyLimit} mixes reached`,
      code: "daily_quota_reached",
    });
  }

  const created = await deps.createManualJob({ userId, djId, lyrics });
  if (!created.job) {
    throw created.error ?? new Error("could not create job");
  }

  deps.waitUntil(
    deps.runGeneration({
      jobId: created.job.id,
      cfg,
      lyrics,
      seasoning,
      language,
    }),
  );
  return result(200, { jobId: created.job.id });
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
  | "caption_audio";

export type RunDependencies = {
  updateJob: (
    jobId: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  findAudiusTrack: (externalId: string) => Promise<{ id: string } | null>;
  insertAudiusTrack: (
    track: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  insertGeneratedTrack: (
    track: Record<string, unknown>,
  ) => Promise<{ id: string; title: string }>;
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
  const update = (patch: Record<string, unknown>) =>
    deps.updateJob(input.jobId, { ...patch, updated_at: deps.now() });

  try {
    await update({ status: "generating" });

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
    const track = await deps.insertGeneratedTrack({
      title: creativeTitle(input.language, deps.random),
      artist: dj.name,
      audio_url: publicUrl,
      album_art_url: cover,
      genre: dj.genre_specialties?.[0] ?? null,
      mood_tags: dj.mood_tags,
      duration: trackSeconds(input.cfg),
      is_ai_generated: true,
      dj_id: input.cfg.dj_id,
    });

    let caption: string | null = null;
    let captionAudioUrl: string | null = null;
    if (input.drop) {
      try {
        const captionRequest = buildCaptionInput({
          dj,
          localHour: input.drop.localHour,
          trackTitle: track.title,
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

    await update({
      status: "ready",
      track_id: track.id,
      caption,
      caption_audio_url: captionAudioUrl,
    });
  } catch (error) {
    await update({ status: "failed", error: String(error).slice(0, 500) });
    await deps.r2Delete([
      `tracks/generated/${input.jobId}.mp3`,
      `covers/generated/${input.jobId}.jpg`,
      `captions/generated/${input.jobId}.mp3`,
    ]);
  }
}
