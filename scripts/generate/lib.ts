/**
 * Shared helpers for the AI seed scripts.
 * Run with: `npm run gen:*` (node --env-file=.env --import tsx …).
 *
 * SERVER-SIDE ONLY. Uses the Supabase secret key (bypasses RLS), the Replicate
 * token (images + music) and the R2 tokens (storage). Never bundle any of this
 * into the app.
 *
 */
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name} (check your .env)`);
  return v;
}

const SUPABASE_URL = requireEnv("EXPO_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const ACCOUNT_ID = requireEnv("CLOUDFLARE_ACCOUNT_ID"); // R2 endpoint host
const R2_PUBLIC_BASE = requireEnv("R2_PUBLIC_BASE").replace(/\/+$/, "");
const REPLICATE_TOKEN = requireEnv("REPLICATE_API_TOKEN");
const R2_BUCKET = requireEnv("R2_BUCKET");

/** Admin client — bypasses RLS. */
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Replicate (images + music) ──────────────────────────────────────────────
// Async by design: create a prediction, then wait/poll. `Prefer: wait` holds
// the connection up to 60s; anything slower falls through to the poll loop.
const STABLE_AUDIO_VERSION =
  "a61ac8edbb27cd2eda1b2eff2bbc03dcff1131f5560836ff77a052df05b77491";

async function replicateRun(endpoint: string, body: object): Promise<unknown> {
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
      const wait = ((pred.retry_after ?? 3) + 1) * 1000;
      console.log(`  … rate-limited, retrying in ${Math.round(wait / 1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      throw new Error(
        `Replicate (${res.status}): ${JSON.stringify(pred).slice(0, 300)}`,
      );
    }
    break;
  }

  let tries = 0;
  while (
    !["succeeded", "failed", "canceled"].includes(pred.status) &&
    tries < 60
  ) {
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
  return pred.output;
}

function firstUrl(out: unknown): string {
  const u = typeof out === "string" ? out : Array.isArray(out) ? out[0] : null;
  if (!u || typeof u !== "string") throw new Error("Replicate: no output url");
  return u;
}

/** ephemeral image URL (re-upload to R2). */
export async function imageGen(
  prompt: string,
  opts: { aspectRatio?: string } = {},
): Promise<string> {
  const out = await replicateRun(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
    {
      input: {
        prompt: prompt.slice(0, 1500),
        aspect_ratio: opts.aspectRatio ?? "1:1",
        output_format: "jpg",
        output_quality: 90,
        safety_tolerance: 5, // permissive — avoids false-positive NSFW rejects
        prompt_upsampling: true,
      },
    },
  );
  return firstUrl(out);
}

/**
 * Music generation — high quality + controllable length:
 *  - instrumental → stability-ai/stable-audio-2.5 (fixed `duration`, 1..190s)
 *  - vocal → elevenlabs/music (lyrics go in the prompt; vocals on)
 */
export async function musicGen(
  prompt: string,
  opts: { instrumental?: boolean; lyrics?: string; duration?: number } = {},
): Promise<string> {
  const instrumental = opts.instrumental ?? true;
  const seconds = opts.duration ?? 120;
  if (!instrumental) {
    const desc = opts.lyrics ? `${prompt}. Sung lyrics:\n${opts.lyrics}` : prompt;
    const out = await replicateRun(
      "https://api.replicate.com/v1/models/elevenlabs/music/predictions",
      {
        input: {
          prompt: desc.slice(0, 2000),
          music_length_ms: seconds * 1000,
          force_instrumental: false,
        },
      },
    );
    return firstUrl(out);
  }
  const out = await replicateRun("https://api.replicate.com/v1/predictions", {
    version: STABLE_AUDIO_VERSION,
    input: { prompt: prompt.slice(0, 2000), duration: seconds },
  });
  return firstUrl(out);
}

// Context-aware, varied cover prompt (mirrors supabase/functions/_shared/cover.ts,
// which can't be imported here — different runtime). Palettes lean *limited*.
const COVER_STYLES = [
  "minimalist", "surreal collage", "risograph print", "dreamy double exposure",
  "geometric abstraction", "organic flowing forms", "brutalist graphic",
  "grainy vintage film", "iridescent liquid metal", "hand-painted gouache",
  "macro texture photography", "bauhaus poster", "cyanotype", "art deco",
  "glitch art", "ink wash", "collaged paper cutouts", "long-exposure light trails",
];
const COVER_PALETTES = [
  "a bold duotone palette", "monochrome with a single accent color",
  "high-contrast black and white with one accent", "a muted pastel palette",
  "warm analogous tones", "cool moody tones", "a single-color wash",
  "earthy natural tones", "a restrained two-color palette",
];
const COVER_COMPOSITIONS = [
  "a strong central focal point", "off-center with generous negative space",
  "a dynamic diagonal composition", "layered depth", "flat graphic shapes",
  "radial symmetry",
];

export function coverPrompt(
  genre: string,
  moods: string[],
  instrumental: boolean,
): string {
  const r = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  const g = genre.trim().toLowerCase();
  const m = moods.filter(Boolean).map((x) => x.toLowerCase());
  const feel = instrumental
    ? "atmospheric, textural, wordless and instrumental"
    : "intimate and expressive, with a human vocal warmth";
  return [
    `${r(COVER_STYLES)} album cover art`,
    g ? `for a ${g} track` : "for a music track",
    m.length ? `evoking a ${m.join(", ")} mood` : "evoking an abstract mood",
    feel,
    r(COVER_PALETTES),
    r(COVER_COMPOSITIONS),
    "striking, original, rich detail",
    "no text, no words, no letters, no faces, no watermark",
  ].join(", ");
}

/** Distinct color/mood identity per DJ, so covers/avatars don't all look alike. */
export const DJ_PALETTES: Record<string, string> = {
  nova: "soft muted palette of dusty teal, powder blue and pale lavender, hazy dreamy film grain, gentle diffused light",
  axon: "bold neon palette of electric cyan, hot magenta and deep crimson, high contrast, sharp energetic glow, dark club haze",
  sage: "organic palette of deep forest green, warm gold and amber earth tones, soft natural mist, serene",
  solano: "warm sun-soaked palette of golden amber, coral and deep magenta, vibrant, glowing dusk",
  marea: "romantic palette of deep wine red, warm amber and dusky rose, candlelit, soft shadows",
  fuego: "vibrant tropical palette of hot orange, turquoise and sunshine yellow, festive carnival energy",
  vega: "retro neon palette of electric purple, cyan and hot pink, 80s sunset glow, chrome reflections",
  kismet: "cool nocturnal palette of midnight blue, teal and electric violet, glowing city lights",
  ember: "warm soulful palette of golden honey, terracotta and deep amber, golden-hour glow",
};

// ── R2 (S3 API, signed with aws4fetch) ──────────────────────────────────────

const r2 = new AwsClient({
  accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});
const R2_S3 = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

/** Uploads bytes to R2 and returns the public URL. */
export async function uploadBytes(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const r = await r2.fetch(`${R2_S3}/${key}`, {
    method: "PUT",
    body: bytes as BodyInit,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
  if (!r.ok) throw new Error(`R2 PUT ${key} (${r.status}): ${await r.text()}`);
  return `${R2_PUBLIC_BASE}/${key}`;
}

/** Downloads a (ephemeral) URL and re-uploads it to R2. */
export async function uploadFromUrl(
  key: string,
  sourceUrl: string,
  contentType: string,
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${sourceUrl}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return uploadBytes(key, bytes, contentType);
}
