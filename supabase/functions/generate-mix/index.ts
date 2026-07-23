/**
 * The user requests a mix from a DJ; the function creates a generation_job and
 * responds { jobId } immediately. Generation runs in the background with
 * EdgeRuntime.waitUntil (Replicate → R2 → insert track). The client polls the job.
 *
 * v2: daily quota, DJ authorization (system or own), optional user lyrics
 * (own vocal DJs only), and R2 cleanup when a generation fails mid-way.
 */

import { generateCoverImage } from "../_shared/cover.ts";
import { invalid, json } from "../_shared/http.ts";
import { countDailyGenerations, DAILY_GENERATION_LIMIT } from "../_shared/quota.ts";
import { r2Delete, r2Put } from "../_shared/r2.ts";
import { replicateRun, replicateText } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { streamUrl } from "../_shared/audius.ts";
import { pickAudiusDrop } from "./audius-drop.ts";
import {
  boundedDefaultLyrics,
  buildCaptionInput,
  buildCaptionTtsInput,
  buildMusicInput,
  creativeTitle,
  type GenerationLanguage,
  parseGenerationLanguage,
  validateLyrics,
} from "./generation-models.ts";

async function generateMusic(
  cfg: any,
  lyrics: string | null,
  seasoning: string[],
  language: GenerationLanguage,
): Promise<string> {
  const request = buildMusicInput({
    basePrompt: String(cfg.base_prompt),
    seasoning,
    instrumental: cfg.is_instrumental ?? true,
    durationSeconds: trackSeconds(cfg),
    language,
    lyrics: lyrics ?? boundedDefaultLyrics(cfg.default_lyrics),
  });
  return replicateRun(request.endpoint, request.body);
}

function trackSeconds(cfg: any): number {
  return Math.min(Number(cfg.max_duration) || 150, 190);
}

// Cover; falls back to the DJ avatar so it's never null.
async function generateCover(
  jobId: string,
  dj: any,
  instrumental: boolean,
): Promise<string | null> {
  try {
    return await generateCoverImage(`covers/generated/${jobId}.jpg`, {
      genre: dj.genre_specialties?.[0] ?? "",
      moods: dj.mood_tags ?? [],
      instrumental,
    });
  } catch (_e) {
    return dj.avatar_url ?? null;
  }
}

const TOP_GENRE_DAYS = 14;

// Catalog-only clauses: the user's taste nudges the mix; the DJ's
// base_prompt still leads. No free text enters the prompt here.
async function buildSeasoning(
  userId: string,
  dj: any,
  localHour: unknown,
): Promise<string[]> {
  const clauses: string[] = [];

  try {
    const since = new Date(Date.now() - TOP_GENRE_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [{ data: prefs }, { data: stats }] = await Promise.all([
      admin
        .from("music_preferences")
        .select("genres")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("listening_stats")
        .select("top_genre")
        .eq("user_id", userId)
        .gte("date", since)
        .not("top_genre", "is", null),
    ]);

    const counts = new Map<string, number>();
    for (const row of stats ?? []) {
      counts.set(row.top_genre, (counts.get(row.top_genre) ?? 0) + 1);
    }
    const topGenre =
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const djGenres: string[] = dj?.genre_specialties ?? [];
    const candidates = [topGenre, ...(prefs?.genres ?? [])].filter(
      (g): g is string => typeof g === "string",
    );
    const emphasis = candidates.find((g) => djGenres.includes(g));

    if (emphasis) clauses.push(`emphasis on ${emphasis.toLowerCase()}`);
  } catch (e) {
    // Seasoning is optional: never block a generation over it.
    console.error("[generate-mix] seasoning skipped:", e);
  }

  const hour =
    typeof localHour === "number" &&
    Number.isInteger(localHour) &&
    localHour >= 0 &&
    localHour <= 23
      ? localHour
      : new Date().getUTCHours();

  clauses.push(
    hour >= 5 && hour <= 11
      ? "fresh morning feel"
      : hour >= 12 && hour <= 17
        ? "steady daytime flow"
        : hour >= 18 && hour <= 22
          ? "evening warmth"
          : "late night atmosphere",
  );

  return clauses;
}

// One in-character line introducing today's drop. Best-effort: callers must
// tolerate null. Display-only + capped — treats persona fields as untrusted.
async function buildCaption(
  dj: any,
  localHour: unknown,
  trackTitle: string,
  language: GenerationLanguage,
): Promise<string | null> {
  const request = buildCaptionInput({
    dj,
    localHour,
    trackTitle,
    language,
  });
  const raw = await replicateText(request.endpoint, request.body);
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

// TTS the caption in the DJ's voice; upload to R2. Best-effort — returns null
// on any failure (caller tolerates it).
async function buildCaptionAudio(
  jobId: string,
  dj: any,
  caption: string,
  language: GenerationLanguage,
): Promise<string | null> {
  const request = buildCaptionTtsInput(
    language,
    dj?.voice_style,
    dj?.mood_tags,
    caption.slice(0, 300),
  );
  const tempUrl = await replicateRun(request.endpoint, request.body);
  const bytes = new Uint8Array(await (await fetch(tempUrl)).arrayBuffer());
  return await r2Put(
    `captions/generated/${jobId}.mp3`,
    bytes,
    "audio/mpeg",
  );
}

serveAuthed(async (req, user) => {
  const {
    djId,
    lyrics: rawLyrics,
    language: rawLanguage,
    localHour,
    dropDate,
  } = await req.json();

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

  // DJ config (+ owner for authorization)
  const { data: cfg } = await admin
    .from("dj_generation_configs")
    .select(
      "dj_id, base_prompt, is_instrumental, default_lyrics, max_duration, djs(name, slug, character, voice_style, genre_specialties, mood_tags, avatar_url, owner_id)",
    )
    .eq("dj_id", djId)
    .single();

  if (!cfg) return json({ error: "DJ config not found" }, 404);

  // Authorization: system DJs (no owner) or your own.
  const owner: string | null = (cfg.djs as any)?.owner_id ?? null;
  if (owner !== null && owner !== user.id) {
    return json(
      { error: "you can't generate with this DJ", code: "dj_not_allowed" },
      403,
    );
  }

  // Optional user lyrics: only on your OWN vocal DJ, and never for a drop.
  let lyrics: string | null = null;

  if (!isDrop && requestedLyrics != null) {
    if (cfg.is_instrumental !== false || owner !== user.id) {
      return invalid("lyrics are only allowed on your own vocal DJs");
    }

    lyrics = requestedLyrics;
  }

  const seasoning = await buildSeasoning(user.id, cfg.djs, localHour);

  // Daily drop: idempotent per (user, local date), exempt from the manual quota.
  if (isDrop) {
    const { data: existing } = await admin
      .from("generation_jobs")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("drop_date", dropDate)
      .maybeSingle();

    if (existing && existing.status !== "failed") {
      return json({ jobId: existing.id }); // generating or ready — don't regenerate
    }

    if (existing && existing.status === "failed") {
      await admin
        .from("generation_jobs")
        .update({
          status: "queued",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      console.log("[generate-mix] drop retry:", existing.id);
      EdgeRuntime.waitUntil(
        runGeneration(
          existing.id,
          cfg,
          null,
          seasoning,
          language,
          { localHour },
        ),
      );
      return json({ jobId: existing.id });
    }

    const { data: job, error: jobErr } = await admin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        dj_id: djId,
        status: "queued",
        drop_date: dropDate,
      })
      .select()
      .single();

    if (jobErr || !job) {
      // Race: a concurrent open created today's drop first. Return it.
      const { data: raced } = await admin
        .from("generation_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("drop_date", dropDate)
        .maybeSingle();
      if (raced) return json({ jobId: raced.id });
      throw jobErr ?? new Error("could not create drop job");
    }

    console.log("[generate-mix] drop seasoning:", seasoning.join(" | "));
    EdgeRuntime.waitUntil(
      runGeneration(job.id, cfg, null, seasoning, language, { localHour }),
    );
    return json({ jobId: job.id });
  }

  // Manual generation: shared daily quota (drops exempt; cover regens included).
  if ((await countDailyGenerations(user.id)) >= DAILY_GENERATION_LIMIT) {
    return json(
      {
        error: `daily limit of ${DAILY_GENERATION_LIMIT} mixes reached`,
        code: "daily_quota_reached",
      },
      429,
    );
  }

  // Create the job and respond right away
  const { data: job, error: jobErr } = await admin
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      dj_id: djId,
      prompt: lyrics, // audit trail of what the user provided
      status: "queued",
    })
    .select()
    .single();

  if (jobErr || !job) throw jobErr ?? new Error("could not create job");

  console.log("[generate-mix] seasoning:", seasoning.join(" | "));

  EdgeRuntime.waitUntil(
    runGeneration(job.id, cfg, lyrics, seasoning, language),
  );

  return json({ jobId: job.id });
});

// Phase B: the drop leads with a real Audius pick the DJ curates. Materializes
// the pick into `tracks` (real uuid, source='audius'), reuses the DJ voice, and
// marks the job ready. Returns false on any failure so the drop falls back to
// generation — the drop is never empty.
async function tryAudiusDrop(
  jobId: string,
  cfg: any,
  localHour: unknown,
  language: GenerationLanguage,
): Promise<boolean> {
  const dj = cfg.djs;
  let picked: { pick: any; caption: string } | null = null;
  try {
    picked = await pickAudiusDrop(dj, localHour, language);
  } catch (e) {
    console.error("[generate-mix] audius pick failed:", e);
    return false;
  }
  if (!picked) return false;

  try {
    const { pick, caption } = picked;

    // Dedup by (source, external_id): reuse an already-materialized row.
    const { data: existing } = await admin
      .from("tracks")
      .select("id")
      .eq("source", "audius")
      .eq("external_id", pick.id)
      .maybeSingle();

    let trackId: string | undefined = existing?.id;
    if (!trackId) {
      const { data: track, error: insErr } = await admin
        .from("tracks")
        .insert({
          title: pick.title,
          artist: pick.user?.name ?? "Unknown artist",
          audio_url: streamUrl(pick.id),
          album_art_url:
            pick.artwork?.["480x480"] ?? pick.artwork?.["1000x1000"] ?? null,
          genre: pick.genre ?? dj.genre_specialties?.[0] ?? null,
          mood_tags: dj.mood_tags,
          duration: pick.duration ?? null,
          is_ai_generated: false,
          source: "audius",
          external_id: pick.id,
          dj_id: cfg.dj_id,
        })
        .select("id")
        .single();
      if (insErr || !track) throw insErr ?? new Error("materialize failed");
      trackId = track.id;
    }

    let captionAudioUrl: string | null = null;
    try {
      captionAudioUrl = await buildCaptionAudio(jobId, dj, caption, language);
    } catch (e) {
      console.error("[generate-mix] caption audio skipped:", e);
    }

    await admin
      .from("generation_jobs")
      .update({
        status: "ready",
        track_id: trackId,
        caption,
        caption_audio_url: captionAudioUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return true;
  } catch (e) {
    console.error("[generate-mix] audius materialize failed:", e);
    return false; // fall back to generation
  }
}

async function runGeneration(
  jobId: string,
  cfg: any,
  lyrics: string | null,
  seasoning: string[],
  language: GenerationLanguage,
  drop?: { localHour: unknown },
): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    admin
      .from("generation_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", jobId);

  try {
    await update({ status: "generating" });

    // Phase B: drops lead with a real Audius pick; generation is the fallback.
    if (drop) {
      const done = await tryAudiusDrop(
        jobId,
        cfg,
        drop.localHour,
        language,
      );
      if (done) return;
    }

    const tempUrl = await generateMusic(cfg, lyrics, seasoning, language);

    const bytes = new Uint8Array(await (await fetch(tempUrl)).arrayBuffer());

    const publicUrl = await r2Put(
      `tracks/generated/${jobId}.mp3`,
      bytes,
      "audio/mpeg",
    );

    const dj = cfg.djs;
    const cover = await generateCover(jobId, dj, cfg.is_instrumental ?? true);

    const { data: track, error: insErr } = await admin
      .from("tracks")
      .insert({
        title: creativeTitle(language),
        artist: dj.name,
        audio_url: publicUrl,
        album_art_url: cover,
        genre: dj.genre_specialties?.[0] ?? null,
        mood_tags: dj.mood_tags,
        duration: trackSeconds(cfg),
        is_ai_generated: true,
        dj_id: cfg.dj_id,
      })
      .select()
      .single();

    if (insErr || !track) throw insErr ?? new Error("could not insert track");

    let caption: string | null = null;
    let captionAudioUrl: string | null = null;
    if (drop) {
      try {
        caption = await buildCaption(
          dj,
          drop.localHour,
          track.title,
          language,
        );
        if (caption) {
          try {
            captionAudioUrl = await buildCaptionAudio(
              jobId,
              dj,
              caption,
              language,
            );
          } catch (e) {
            console.error("[generate-mix] caption audio skipped:", e);
          }
        }
      } catch (e) {
        console.error("[generate-mix] caption skipped:", e); // best-effort
      }
    }

    await update({
      status: "ready",
      track_id: track.id,
      caption,
      caption_audio_url: captionAudioUrl,
    });
  } catch (e) {
    await update({ status: "failed", error: String(e).slice(0, 500) });
    // No orphans: remove whatever this job managed to upload.
    await r2Delete([
      `tracks/generated/${jobId}.mp3`,
      `covers/generated/${jobId}.jpg`,
      `captions/generated/${jobId}.mp3`,
    ]);
  }
}
