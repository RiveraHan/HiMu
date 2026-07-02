/**
 * The user requests a mix from a DJ; the function creates a generation_job and
 * responds { jobId } immediately. Generation runs in the background with
 * EdgeRuntime.waitUntil (Replicate → R2 → insert track). The client polls the job.
 *
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch";

const ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")!; // R2 endpoint host
const R2_BUCKET = Deno.env.get("R2_BUCKET")!;
const R2_PUBLIC_BASE = (Deno.env.get("R2_PUBLIC_BASE") ?? "").replace(/\/+$/, "");
const REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;
const STABLE_AUDIO_VERSION =
  "a61ac8edbb27cd2eda1b2eff2bbc03dcff1131f5560836ff77a052df05b77491";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const r2 = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  service: "s3",
  region: "auto",
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Replicate (create prediction → wait/poll)
async function replicateRun(endpoint: string, body: object): Promise<string> {
  let pred: any;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify(body),
    });
    pred = await res.json();
    if (res.status === 429 && attempt < 10) {
      await new Promise((r) => setTimeout(r, ((pred.retry_after ?? 3) + 1) * 1000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Replicate (${res.status}): ${JSON.stringify(pred).slice(0, 200)}`);
    }
    break;
  }
  let tries = 0;
  while (!["succeeded", "failed", "canceled"].includes(pred.status) && tries < 80) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(pred.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    });
    pred = await r.json();
    tries++;
  }
  if (pred.status !== "succeeded") {
    throw new Error(`Replicate ${pred.status}: ${pred.error ?? "no output"}`);
  }
  const out = pred.output;
  const url = typeof out === "string" ? out : Array.isArray(out) ? out[0] : null;
  if (!url) throw new Error("Replicate: no output url");
  return url;
}

async function generateMusic(cfg: any, extraPrompt?: string): Promise<string> {
  const prompt = (
    extraPrompt ? `${cfg.base_prompt}, ${extraPrompt}` : cfg.base_prompt
  ).slice(0, 2000);
  const instrumental = cfg.is_instrumental ?? true;
  const dur = trackSeconds(cfg); // parametrizable via dj_generation_configs.max_duration
  if (!instrumental) {
    // Vocal → elevenlabs/music (lyrics in the prompt, vocals on)
    const desc = cfg.default_lyrics
      ? `${prompt}. Sung lyrics:\n${String(cfg.default_lyrics).slice(0, 1500)}`
      : prompt;
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
  // Instrumental → stable-audio-2.5 (high quality)
  return replicateRun("https://api.replicate.com/v1/predictions", {
    version: STABLE_AUDIO_VERSION,
    input: { prompt, duration: dur },
  });
}

// Track length in seconds (Stable Audio caps at 190).
function trackSeconds(cfg: any): number {
  return Math.min(Number(cfg.max_duration) || 150, 190);
}

const TITLE_ADJ = ["Neon", "Midnight", "Velvet", "Electric", "Crimson", "Silent", "Golden", "Hollow", "Lunar", "Ember", "Static", "Cosmic", "Faded", "Wild", "Distant", "Molten", "Frozen", "Endless", "Phantom", "Amber"];
const TITLE_NOUN = ["Pulse", "Drift", "Haze", "Mirage", "Echo", "Bloom", "Tide", "Circuit", "Horizon", "Rush", "Signal", "Current", "Halo", "Ritual", "Voyage", "Fever", "Glow", "Reverie", "Cascade", "Nocturne"];
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

async function r2Put(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const r = await r2.fetch(
    `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`,
    {
      method: "PUT",
      body: bytes,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
    },
  );
  if (!r.ok) throw new Error(`R2 PUT (${r.status})`);
  return `${R2_PUBLIC_BASE}/${key}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { djId, prompt } = await req.json();
    if (!djId) return json({ error: "djId required" }, 400);

    // DJ config
    const { data: cfg } = await admin
      .from("dj_generation_configs")
      .select(
        "dj_id, base_prompt, is_instrumental, default_lyrics, max_duration, djs(name, slug, genre_specialties, mood_tags, avatar_url)",
      )
      .eq("dj_id", djId)
      .single();
    if (!cfg) return json({ error: "DJ config not found" }, 404);

    // Create the job and respond right away
    const { data: job, error: jobErr } = await admin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        dj_id: djId,
        prompt: prompt ?? null,
        status: "queued",
      })
      .select()
      .single();
    if (jobErr || !job) throw jobErr ?? new Error("could not create job");

    EdgeRuntime.waitUntil(runGeneration(job.id, cfg, prompt));

    return json({ jobId: job.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

async function runGeneration(
  jobId: string,
  cfg: any,
  extraPrompt?: string,
): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    admin
      .from("generation_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", jobId);

  try {
    await update({ status: "generating" });

    const tempUrl = await generateMusic(cfg, extraPrompt);

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
  }
}
