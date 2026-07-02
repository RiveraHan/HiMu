/**
 * Instrumental tracks per DJ (4 each ≈ 12 total).
 * Idempotent: skips if a track with (title, dj_id) already exists.
 *
 *   npm run gen:music
 */
import {
  admin,
  DJ_PALETTES,
  imageGen,
  musicGen,
  uploadFromUrl,
} from "./lib";

const COVER_BASE =
  "abstract album cover art, cinematic, rich texture, depth, premium, no text, no faces, no watermark";

// Track lengths are per-track and parametrizable below (seconds). Kept varied
// and never short (>= ~110s). Stable Audio caps at 190s.

type Variation = {
  extra: string;
  title: string;
  mood: string;
  bpm: number;
  energy: number;
  dur: number; // seconds (parametrizable, varied, >= ~110)
};

const VARIATIONS: Record<string, Variation[]> = {
  nova: [
    { extra: "rainy night window, vinyl crackle", title: "Rain on Glass", mood: "Relax", bpm: 72, energy: 3, dur: 165 },
    { extra: "floating, weightless pads, slow bloom", title: "Weightless", mood: "Dreamy", bpm: 68, energy: 2, dur: 180 },
    { extra: "warm tape saturation, gentle keys for studying", title: "Soft Focus", mood: "Focus", bpm: 76, energy: 4, dur: 145 },
    { extra: "distant city hum, nostalgic melody", title: "City Memory", mood: "Relax", bpm: 70, energy: 3, dur: 155 },
  ],
  axon: [
    { extra: "peak-time energy, rolling bassline", title: "Voltage", mood: "Party", bpm: 128, energy: 9, dur: 130 },
    { extra: "dark warehouse, hypnotic groove", title: "Warehouse Pulse", mood: "Energize", bpm: 126, energy: 8, dur: 150 },
    { extra: "sprint pace, driving percussion", title: "Redline", mood: "Workout", bpm: 132, energy: 9, dur: 115 },
    { extra: "acid line, festival drop", title: "Acid Bloom", mood: "Party", bpm: 128, energy: 8, dur: 140 },
  ],
  sage: [
    { extra: "forest at dawn, birdsong, soft strings", title: "First Light", mood: "Nature", bpm: 60, energy: 1, dur: 175 },
    { extra: "deep sleep, sub-bass drone, slow breath", title: "Night Tide", mood: "Sleep", bpm: 50, energy: 1, dur: 190 },
    { extra: "tibetan bowls, still water", title: "Still Water", mood: "Meditate", bpm: 55, energy: 2, dur: 170 },
    { extra: "mountain air, ethereal choir", title: "High Meadow", mood: "Meditate", bpm: 58, energy: 2, dur: 160 },
  ],
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

async function main() {
  const { data: djs, error } = await admin
    .from("djs")
    .select("id, slug, name, genre_specialties");
  if (error) throw error;

  let ok = 0;
  let consec = 0;
  const failed: string[] = [];

  outer: for (const dj of djs ?? []) {
    const variations = VARIATIONS[dj.slug as keyof typeof VARIATIONS] ?? [];
    if (!variations.length) continue;

    const { data: cfg, error: cfgErr } = await admin
      .from("dj_generation_configs")
      .select("base_prompt, is_instrumental, default_lyrics")
      .eq("dj_id", dj.id)
      .single();
    if (cfgErr || !cfg) throw cfgErr ?? new Error(`no config for ${dj.slug}`);

    for (const v of variations) {
      const { data: existing } = await admin
        .from("tracks")
        .select("id")
        .eq("dj_id", dj.id)
        .eq("title", v.title)
        .maybeSingle();
      if (existing) {
        console.log(`↷ skip ${dj.name} — ${v.title} (already exists)`);
        continue;
      }

      const trackSlug = slugify(v.title);
      console.log(`♪ ${dj.name} — ${v.title}…`);
      try {
        const genre = dj.genre_specialties?.[0] ?? "";

        // Track cover — non-critical: null on failure, never blocks the track.
        let coverUrl: string | null = null;
        try {
          const coverTmp = await imageGen(
            `abstract album cover inspired by "${v.extra}". ${COVER_BASE}. Color palette: ${DJ_PALETTES[dj.slug]}`,
          );
          coverUrl = await uploadFromUrl(
            `covers/tracks/${dj.slug}/${trackSlug}.jpg`,
            coverTmp,
            "image/jpeg",
          );
        } catch (coverErr) {
          console.log(`  … cover skipped (${String(coverErr).slice(0, 50)})`);
        }

        // Music → re-upload to R2. One model does both:
        // instrumental (is_instrumental) or vocal (lyrics).
        const musicPrompt = `${cfg.base_prompt}, ${v.extra}`;
        const tempUrl = await musicGen(musicPrompt, {
          instrumental: cfg.is_instrumental ?? true,
          lyrics: cfg.default_lyrics ?? undefined,
          duration: v.dur,
        });
        const audioUrl = await uploadFromUrl(
          `tracks/djs/${dj.slug}/${trackSlug}.mp3`,
          tempUrl,
          "audio/mpeg",
        );

        const { error: insErr } = await admin.from("tracks").insert({
          title: v.title,
          artist: dj.name,
          audio_url: audioUrl,
          album_art_url: coverUrl,
          genre: genre || null,
          mood_tags: [v.mood],
          bpm: v.bpm,
          energy_level: v.energy,
          duration: cfg.is_instrumental === false ? null : v.dur,
          is_ai_generated: true,
          dj_id: dj.id,
        });
        if (insErr) throw insErr;
        ok++;
        consec = 0;
        console.log(`  ✓ ${audioUrl}`);
      } catch (e) {
        failed.push(`${dj.name} — ${v.title}`);
        consec++;
        console.log(`  ✗ ${v.title} failed: ${String(e).slice(0, 120)}`);
        if (consec >= 6) {
          console.log(
            "\n⚠ Aborting early: 6 consecutive provider failures (likely down). Re-run gen:music later to fill the rest.",
          );
          break outer;
        }
      }
    }
  }
  console.log(`\nMusic done. ${ok} created, ${failed.length} failed.`);
  if (failed.length) console.log("Failed: " + failed.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
