/**
 * Covers that do NOT depend on tracks:
 *  - hero for the Home "AI Mixes" card
 *  - one cover per public playlist (each in its DJ's palette, so they differ)
 *
 *   npm run gen:covers
 */
import { DJ_PALETTES, imageGen, uploadFromUrl } from "./lib";

const COVER_BASE =
  "abstract album cover art, cinematic, rich texture, depth, premium, no text, no faces, no watermark";

const PLAYLIST_COVERS: { slug: string; subject: string; palette: string }[] = [
  { slug: "deep-focus", subject: "calm foggy dawn over still water, soft diffused light, minimal", palette: DJ_PALETTES.nova },
  { slug: "night-drive", subject: "neon city highway at night, long exposure light trails, motion", palette: DJ_PALETTES.axon },
  { slug: "forest-sleep", subject: "moonlit misty forest, deep quiet, faint stars, tranquil", palette: DJ_PALETTES.sage },
];

async function main() {
  // Hero for the Home AI Mixes card — its own bold identity
  const heroTmp = await imageGen(
    `glowing sound waveform bursting with light, energetic abstract. ${COVER_BASE}. ` +
      `Color palette: iridescent violet, cyan and gold on deep black`,
  );
  const heroUrl = await uploadFromUrl(
    "covers/hero/ai-mixes.jpg",
    heroTmp,
    "image/jpeg",
  );
  console.log(`✓ hero AI Mixes — ${heroUrl}`);

  for (const c of PLAYLIST_COVERS) {
    const tmp = await imageGen(
      `${c.subject}. ${COVER_BASE}. Color palette: ${c.palette}`,
    );
    const url = await uploadFromUrl(
      `covers/playlists/${c.slug}.jpg`,
      tmp,
      "image/jpeg",
    );
    console.log(`✓ cover ${c.slug} — ${url}`);
  }
  console.log("\nCovers done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
