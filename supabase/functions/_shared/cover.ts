import { r2Put } from "./r2.ts";
import { replicateRun } from "./replicate.ts";

// Varied aesthetics so covers don't all look alike. Palettes lean *limited*
// (duotone/mono/single-accent) so a cover rarely uses the whole spectrum.
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

export type CoverContext = {
  genre: string;
  moods: string[];
  instrumental: boolean;
};

// A varied style/palette, tied to the track's actual context: its genre, all
// its moods, and whether it's instrumental or vocal.
export function coverPrompt(ctx: CoverContext): string {
  const r = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  const genre = ctx.genre.trim().toLowerCase();
  const moods = ctx.moods
    .filter(Boolean)
    .map((m) => m.toLowerCase());
  const feel = ctx.instrumental
    ? "atmospheric, textural, wordless and instrumental"
    : "intimate and expressive, with a human vocal warmth";
  return [
    `${r(COVER_STYLES)} album cover art`,
    genre ? `for a ${genre} track` : "for a music track",
    moods.length ? `evoking a ${moods.join(", ")} mood` : "evoking an abstract mood",
    feel,
    r(COVER_PALETTES),
    r(COVER_COMPOSITIONS),
    "striking, original, rich detail",
    "no text, no words, no letters, no faces, no watermark",
  ].join(", ");
}

// Generate a cover with flux-1.1-pro and store it at `key` in R2. Returns the
// public URL. Throws on failure (callers decide whether to swallow it).
export async function generateCoverImage(
  key: string,
  ctx: CoverContext,
): Promise<string> {
  const url = await replicateRun(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
    {
      input: {
        prompt: coverPrompt(ctx),
        aspect_ratio: "1:1",
        output_format: "jpg",
        safety_tolerance: 5,
      },
    },
  );
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  return await r2Put(key, bytes, "image/jpeg", "public");
}
