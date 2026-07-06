/**
 * Instrumental tracks per DJ (4 each ≈ 12 total).
 * Idempotent: skips if a track with (title, dj_id) already exists.
 *
 *   npm run gen:music
 */
import { admin, coverPrompt, imageGen, musicGen, uploadFromUrl } from "./lib";

// Track lengths are per-track and parametrizable below (seconds). Kept varied
// and never short (>= ~110s). Stable Audio caps at 190s.

type Variation = {
  extra: string;
  title: string;
  mood: string;
  bpm: number;
  energy: number;
  dur: number; // seconds (parametrizable, varied, >= ~110)
  lyrics?: string; // per-track lyrics for vocal DJs (overrides default_lyrics)
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
  solano: [
    {
      extra: "moonlit rooftop party, glossy modern reggaeton production, punchy dembow",
      title: "Bajo la Luna",
      mood: "Party",
      bpm: 96,
      energy: 8,
      dur: 150,
      lyrics: `Baja la luz, sube el bajo, ya llegó la madrugada,
tú en el centro de la pista, no me importa nada.
Una seña con tus ojos y me tienes rendido,
esta noche es nuestra, mami, ya lo he decidido.

Bajo la luna, tú y yo, perdiendo el control,
tu cintura es la marea, yo naufrago en tu calor.
Bajo la luna, dale, que retumbe el tambor,
que no salga nunca el sol, quédate en mi corazón.`,
    },
    {
      extra: "slow-burn seductive latin pop, warm night groove",
      title: "Fuego Lento",
      mood: "Groovy",
      bpm: 92,
      energy: 6,
      dur: 150,
      lyrics: `No hay prisa, corazón, deja que la noche corra,
un beso lento quema más que mil que se te ahorran.
Apaga ese teléfono, que el mundo espere afuera,
contigo cada instante se me vuelve primavera.

Fuego lento, así te quiero,
sin apuro, paso a paso, prendo el cielo entero.
Fuego lento, mi amor,
lo bonito no se corre, se disfruta sin reloj.`,
    },
  ],
  marea: [
    {
      extra: "bachata guitar, requinto, seaside heartbreak, tender",
      title: "Cicatriz de Sal",
      mood: "Romantic",
      bpm: 128,
      energy: 4,
      dur: 160,
      lyrics: `Dejé tu nombre en la arena y el mar se lo llevó,
cada ola me repite lo que un día se rompió.
Pero aprendí a bailar con la herida, sin rencor,
que hasta la cicatriz de sal, con el tiempo, da una flor.

Y si un día tú regresas, no prometo, mi bien,
pero este corazón terco aún te guarda un boleto también.
Cicatriz de sal, amor,
duele menos cuando canto y te devuelvo el dolor.`,
    },
    {
      extra: "candlelit bossa bachata, intimate nylon guitar, late night",
      title: "Dos Copas",
      mood: "Late Night",
      bpm: 118,
      energy: 4,
      dur: 160,
      lyrics: `Dos copas, media luz, y tu risa de contrabando,
la ciudad se quedó afuera, los dos aquí temblando.
No me hables de por siempre, dame solo esta canción,
que en tus ojos cabe el mundo y me sobra la razón.

Dos copas y tu piel,
la noche se hace corta cuando bailo con la miel.
Dos copas, nada más,
quédate un segundo eterno, no me digas que te vas.`,
    },
  ],
  fuego: [
    { extra: "blazing salsa brass section, montuno piano, congas and timbales, fiery", title: "Candela", mood: "Party", bpm: 96, energy: 9, dur: 150 },
    { extra: "cumbia and merengue, festive carnival, accordion and güira, driving", title: "Carnaval", mood: "Happy", bpm: 100, energy: 9, dur: 150 },
  ],
  vega: [
    { extra: "synthwave sunset drive, gated retro drums, chrome arpeggios, widescreen", title: "Neon Coast", mood: "Nostalgic", bpm: 100, energy: 6, dur: 180 },
    { extra: "dream pop haze, shimmering reverbed guitars, wistful, cinematic", title: "Afterglow", mood: "Dreamy", bpm: 92, energy: 4, dur: 180 },
  ],
  kismet: [
    { extra: "deep house rolling bassline, hypnotic groove, warm pads, late night", title: "Midnight Current", mood: "Groovy", bpm: 122, energy: 7, dur: 180 },
    { extra: "afro house, organic percussion, euphoric build, sunrise energy", title: "Sunrise Ritual", mood: "Euphoric", bpm: 123, energy: 8, dur: 180 },
  ],
  ember: [
    {
      extra: "warm vintage soul, silky lead vocals, horns, golden hour",
      title: "Golden Hour",
      mood: "Romantic",
      bpm: 92,
      energy: 6,
      dur: 160,
      lyrics: `Sun going down, painting gold on your skin,
every worry I carried just melting within.
No clock on the wall, nowhere we gotta be,
just your hand in mine and the whole sky for free.

It's a golden hour, and you're all I need,
sweet as honey light, girl, you're the air I breathe.
Golden hour, let it stay,
hold me slow while the rest of the world fades away.`,
    },
    {
      extra: "funky R&B, wah guitar, fat bass, sultry mid-tempo groove",
      title: "Honey Slow",
      mood: "Groovy",
      bpm: 96,
      energy: 6,
      dur: 160,
      lyrics: `Turn the low lights blue, let the bassline ride,
you move like a river I could sink inside.
Ain't no rush tonight, got some time to burn,
every touch a lesson and, oh, I'm here to learn.

Take it honey slow, let the groove decide,
two hearts on a wire, catching fire on the ride.
Honey slow, come near,
whisper it soft, baby — I'm right here.`,
    },
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
            coverPrompt(genre, [v.mood], cfg.is_instrumental ?? true),
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
          lyrics: v.lyrics ?? cfg.default_lyrics ?? undefined,
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
