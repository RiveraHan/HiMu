/**
 * The user requests a mix from a DJ; the function creates a generation_job and
 * responds { jobId } immediately. Generation runs in the background with
 * EdgeRuntime.waitUntil (Replicate → R2 → insert track). The client polls the job.
 *
 * v2: daily quota, DJ authorization (system or own), optional user lyrics
 * (own vocal DJs only), and R2 cleanup when a generation fails mid-way.
 */

import { invalid, json } from "../_shared/http.ts";
import { r2Delete, r2Put } from "../_shared/r2.ts";
import { replicateRun } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { sanitize } from "../_shared/text.ts";

const DAILY_TRACKS = 10;

const STABLE_AUDIO_VERSION =
  "a61ac8edbb27cd2eda1b2eff2bbc03dcff1131f5560836ff77a052df05b77491";

async function generateMusic(cfg: any, lyrics: string | null): Promise<string> {
  const prompt = String(cfg.base_prompt).slice(0, 2000);
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

    const url = await replicateRun(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
      {
        input: {
          prompt: `abstract album cover art, ${genre} ${mood}, cinematic, rich texture, premium, no text, no faces, no watermark`,
          aspect_ratio: "1:1",
          output_format: "jpg",
          safety_tolerance: 5,
        },
      },
    );

    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());

    return await r2Put(`covers/generated/${jobId}.jpg`, bytes, "image/jpeg");
  } catch (_e) {
    return dj.avatar_url ?? null;
  }
}

serveAuthed(async (req, user) => {
  const { djId, lyrics: rawLyrics } = await req.json();
  if (!djId) return invalid("djId required");

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

  // Optional user lyrics: only on your OWN vocal DJ (private tracks).
  let lyrics: string | null = null;

  if (rawLyrics != null) {
    if (typeof rawLyrics !== "string") return invalid("lyrics must be text");

    if (cfg.is_instrumental !== false || owner !== user.id) {
      return invalid("lyrics are only allowed on your own vocal DJs");
    }

    lyrics = sanitize(rawLyrics, 1000) || null;
  }

  // Daily quota (failed jobs don't count).
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await admin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gt("created_at", dayAgo)
    .neq("status", "failed");

  if ((count ?? 0) >= DAILY_TRACKS) {
    return json(
      {
        error: `daily limit of ${DAILY_TRACKS} mixes reached`,
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

  EdgeRuntime.waitUntil(runGeneration(job.id, cfg, lyrics));

  return json({ jobId: job.id });
});

async function runGeneration(
  jobId: string,
  cfg: any,
  lyrics: string | null,
): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    admin
      .from("generation_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", jobId);

  try {
    await update({ status: "generating" });

    const tempUrl = await generateMusic(cfg, lyrics);

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

    await update({ status: "ready", track_id: track.id });
  } catch (e) {
    await update({ status: "failed", error: String(e).slice(0, 500) });
    // No orphans: remove whatever this job managed to upload.
    await r2Delete([
      `tracks/generated/${jobId}.mp3`,
      `covers/generated/${jobId}.jpg`,
    ]);
  }
}
