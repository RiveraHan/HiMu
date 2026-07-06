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
import { sanitize } from "../_shared/text.ts";

const STABLE_AUDIO_VERSION =
  "a61ac8edbb27cd2eda1b2eff2bbc03dcff1131f5560836ff77a052df05b77491";

async function generateMusic(
  cfg: any,
  lyrics: string | null,
  seasoning: string[],
): Promise<string> {
  const prompt = [String(cfg.base_prompt), ...seasoning]
    .join(", ")
    .slice(0, 2000);
  const instrumental = cfg.is_instrumental ?? true;
  const dur = trackSeconds(cfg); // parametrizable via dj_generation_configs.max_duration

  if (!instrumental) {
    // Vocal → elevenlabs/music. User lyrics (own vocal DJs) or seeded
    // default_lyrics win; otherwise the model must write ORIGINAL lyrics.
    const provided = lyrics ?? cfg.default_lyrics ?? null;

    const desc = provided
      ? `${prompt}. Sing only the provided lyrics. Sung lyrics:\n${String(
          provided,
        ).slice(0, 1500)}`
      : `${prompt}. Write original lyrics; do not reproduce existing copyrighted songs.`;

    return replicateRun(
      "https://api.replicate.com/v1/models/elevenlabs/music/predictions",
      {
        input: {
          prompt: desc.slice(0, 2000),
          music_length_ms: dur * 1000,
          force_instrumental: false,
        },
      },
    );
  }

  return replicateRun("https://api.replicate.com/v1/predictions", {
    version: STABLE_AUDIO_VERSION,
    input: { prompt, duration: dur },
  });
}

function trackSeconds(cfg: any): number {
  return Math.min(Number(cfg.max_duration) || 150, 190);
}

const TITLE_ADJ = [
  "Neon",
  "Midnight",
  "Velvet",
  "Electric",
  "Crimson",
  "Silent",
  "Golden",
  "Hollow",
  "Lunar",
  "Ember",
  "Static",
  "Cosmic",
  "Faded",
  "Wild",
  "Distant",
  "Molten",
  "Frozen",
  "Endless",
  "Phantom",
  "Amber",
];
const TITLE_NOUN = [
  "Pulse",
  "Drift",
  "Haze",
  "Mirage",
  "Echo",
  "Bloom",
  "Tide",
  "Circuit",
  "Horizon",
  "Rush",
  "Signal",
  "Current",
  "Halo",
  "Ritual",
  "Voyage",
  "Fever",
  "Glow",
  "Reverie",
  "Cascade",
  "Nocturne",
];

function creativeTitle(): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(TITLE_ADJ)} ${pick(TITLE_NOUN)}`;
}

// Cover; falls back to the DJ avatar so it's never null.
async function generateCover(jobId: string, dj: any): Promise<string | null> {
  try {
    const genre = dj.genre_specialties?.[0] ?? "";
    const mood = dj.mood_tags?.[0] ?? "";
    return await generateCoverImage(
      `covers/generated/${jobId}.jpg`,
      genre,
      mood,
    );
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

const LLAMA_ENDPOINT =
  "https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions";

function captionTimePhrase(localHour: unknown): string {
  const hour =
    typeof localHour === "number" &&
    Number.isInteger(localHour) &&
    localHour >= 0 &&
    localHour <= 23
      ? localHour
      : new Date().getUTCHours();
  if (hour >= 5 && hour <= 11) return "this morning";
  if (hour >= 12 && hour <= 17) return "this afternoon";
  if (hour >= 18 && hour <= 22) return "tonight";
  return "in the late hours";
}

// One in-character line introducing today's drop. Best-effort: callers must
// tolerate null. Display-only + capped — treats persona fields as untrusted.
async function buildCaption(
  dj: any,
  localHour: unknown,
  trackTitle: string,
): Promise<string | null> {
  const name = String(dj?.name ?? "Your DJ");
  const character = String(dj?.character ?? "").slice(0, 300);
  const voice = String(dj?.voice_style ?? "").slice(0, 120);
  const genre = String(dj?.genre_specialties?.[0] ?? "eclectic");

  const system =
    `You are ${name}, an AI radio DJ. Persona: ${character}. Voice: ${voice}. ` +
    `Write ONE short first-person line (max 18 words) introducing today's fresh drop to your listener, in your own voice. ` +
    `Plain text only: no quotation marks, no emojis, no hashtags, no preamble. English.`;
  const prompt =
    `Genre: ${genre}. Time of day: ${captionTimePhrase(localHour)}. ` +
    `Track title: ${trackTitle}. Write the single line now.`;

  const raw = await replicateText(LLAMA_ENDPOINT, {
    input: {
      system_prompt: system,
      prompt,
      max_tokens: 60,
      temperature: 0.8,
    },
  });

  const line = raw
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .slice(0, 140)
    .trim();
  return line || null;
}

const KOKORO_VERSION =
  "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";

// Map the DJ's voice_style to a kokoro voice id (enum-validated ids).
function pickVoice(voiceStyle: unknown): string {
  const v = String(voiceStyle ?? "").toLowerCase();
  if (v.includes("androgyn") || v.includes("ethereal")) return "af_nicole";
  if (v.includes("mascul")) return "am_michael";
  if (v.includes("femin")) return "af_bella";
  return "af_bella";
}

const HIGH_ENERGY = new Set([
  "energetic", "uplifting", "euphoric", "happy", "playful",
  "groovy", "party", "workout", "epic", "intense",
]);
const CALM_ENERGY = new Set([
  "focus", "relax", "dreamy", "meditate", "nature", "sleep", "cozy",
  "ethereal", "melancholic", "nostalgic", "late night", "rainy day",
]);

// Delivery pace from the DJ's mood energy (the generated track has no
// energy_level). Contained range so it never sounds distorted.
function pickSpeed(dj: any): number {
  const moods: string[] = Array.isArray(dj?.mood_tags) ? dj.mood_tags : [];
  let score = 0;
  for (const m of moods) {
    const k = String(m).toLowerCase();
    if (HIGH_ENERGY.has(k)) score += 1;
    else if (CALM_ENERGY.has(k)) score -= 1;
  }
  return score > 0 ? 1.12 : score < 0 ? 0.92 : 1.0;
}

// TTS the caption in the DJ's voice; upload to R2. Best-effort — returns null
// on any failure (caller tolerates it).
async function buildCaptionAudio(
  jobId: string,
  dj: any,
  caption: string,
): Promise<string | null> {
  const tempUrl = await replicateRun(
    "https://api.replicate.com/v1/predictions",
    {
      version: KOKORO_VERSION,
      input: {
        text: caption.slice(0, 300),
        voice: pickVoice(dj?.voice_style),
        speed: pickSpeed(dj),
      },
    },
  );
  const bytes = new Uint8Array(await (await fetch(tempUrl)).arrayBuffer());
  return await r2Put(`captions/generated/${jobId}.wav`, bytes, "audio/wav");
}

serveAuthed(async (req, user) => {
  const { djId, lyrics: rawLyrics, localHour, dropDate } = await req.json();
  if (!djId) return invalid("djId required");

  const isDrop = dropDate != null;
  if (isDrop && !/^\d{4}-\d{2}-\d{2}$/.test(String(dropDate))) {
    return invalid("dropDate must be YYYY-MM-DD");
  }

  // DJ config (+ owner for authorization)
  const { data: cfg } = await admin
    .from("dj_generation_configs")
    .select(
      "dj_id, base_prompt, is_instrumental, default_lyrics, max_duration, djs(name, slug, genre_specialties, mood_tags, avatar_url, owner_id)",
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

  if (!isDrop && rawLyrics != null) {
    if (typeof rawLyrics !== "string") return invalid("lyrics must be text");

    if (cfg.is_instrumental !== false || owner !== user.id) {
      return invalid("lyrics are only allowed on your own vocal DJs");
    }

    lyrics = sanitize(rawLyrics, 1000) || null;
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
        runGeneration(existing.id, cfg, null, seasoning, { localHour }),
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
      runGeneration(job.id, cfg, null, seasoning, { localHour }),
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

  EdgeRuntime.waitUntil(runGeneration(job.id, cfg, lyrics, seasoning));

  return json({ jobId: job.id });
});

async function runGeneration(
  jobId: string,
  cfg: any,
  lyrics: string | null,
  seasoning: string[],
  drop?: { localHour: unknown },
): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    admin
      .from("generation_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", jobId);

  try {
    await update({ status: "generating" });

    const tempUrl = await generateMusic(cfg, lyrics, seasoning);

    const bytes = new Uint8Array(await (await fetch(tempUrl)).arrayBuffer());

    const publicUrl = await r2Put(
      `tracks/generated/${jobId}.mp3`,
      bytes,
      "audio/mpeg",
    );

    const dj = cfg.djs;
    const cover = await generateCover(jobId, dj);

    const { data: track, error: insErr } = await admin
      .from("tracks")
      .insert({
        title: creativeTitle(),
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
        caption = await buildCaption(dj, drop.localHour, track.title);
        if (caption) {
          try {
            captionAudioUrl = await buildCaptionAudio(jobId, dj, caption);
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
      `captions/generated/${jobId}.wav`,
    ]);
  }
}
