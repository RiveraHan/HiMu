/**
 * Base seed of DJs + dj_generation_configs (Nova / Axon / Sage).
 * Idempotent (upsert by slug / dj_id).
 *
 *   npm run gen:seed
 */
import { admin } from "./lib";

type DJSeed = {
  slug: string;
  name: string;
  character: string;
  voice_style: string;
  genre_specialties: string[];
  mood_tags: string[];
  is_premium: boolean;
  config: {
    base_prompt: string;
    is_instrumental: boolean;
    temperature: number;
    max_duration: number;
  };
};

const DJS: DJSeed[] = [
  {
    slug: "nova",
    name: "Nova",
    character: "Curious, observant, with a touch of poetic melancholy",
    voice_style: "Soft feminine",
    genre_specialties: ["Ambient", "Lo-Fi", "Indie"],
    mood_tags: ["Relax", "Focus", "Dreamy"],
    is_premium: false,
    config: {
      base_prompt:
        "Lo-fi ambient, soft piano, gentle pads, melancholic, poetic atmosphere, quiet luxury",
      is_instrumental: true,
      temperature: 0.6,
      max_duration: 120,
    },
  },
  {
    slug: "axon",
    name: "Axon",
    character: "Energetic, analytical, always chasing the perfect drop",
    voice_style: "Deep masculine",
    genre_specialties: ["Techno", "House", "Deep House"],
    mood_tags: ["Energetic", "Workout", "Party"],
    is_premium: true,
    config: {
      base_prompt:
        "Techno house, driving bassline, energetic drop, 128 BPM, club atmosphere",
      is_instrumental: true,
      temperature: 1.2,
      max_duration: 180,
    },
  },
  {
    slug: "sage",
    name: "Sage",
    character: "Wise, calm, connected to nature",
    voice_style: "Ethereal androgynous",
    genre_specialties: ["Classical", "Ambient", "Piano"],
    mood_tags: ["Sleep", "Meditate", "Nature"],
    is_premium: true,
    config: {
      base_prompt:
        "Classical meditation, nature sounds, ethereal strings, forest ambiance, calming",
      is_instrumental: true,
      temperature: 0.5,
      max_duration: 300,
    },
  },
  {
    slug: "solano",
    name: "Solano",
    character:
      "Magnético y bañado de sol; vive por el drop, la pista y el after. Puro swagger con un corazón enorme.",
    voice_style: "Warm charismatic masculine",
    genre_specialties: ["Reggaeton", "Latin Pop", "Afrobeat"],
    mood_tags: ["Party", "Energetic", "Groovy"],
    is_premium: false,
    config: {
      base_prompt:
        "reggaeton and latin pop, dembow groove, punchy 808 bass, catchy vocal hooks, vibrant, sweaty dance-floor energy",
      is_instrumental: false,
      temperature: 1.1,
      max_duration: 150,
    },
  },
  {
    slug: "marea",
    name: "Marea",
    character:
      "Una confidente a la luz de las velas que convierte el desamor en terciopelo. Sensual, tierna e inolvidable.",
    voice_style: "Sultry feminine",
    genre_specialties: ["Bachata", "Bossa Nova", "Latin Jazz"],
    mood_tags: ["Romantic", "Cozy", "Late Night"],
    is_premium: false,
    config: {
      base_prompt:
        "bachata and bossa nova, warm nylon-string guitar, brushed percussion, intimate breathy vocals, romantic, sultry, candlelit",
      is_instrumental: false,
      temperature: 0.8,
      max_duration: 160,
    },
  },
  {
    slug: "fuego",
    name: "Fuego",
    character:
      "Fuego tropical — metales y congas que no te dejan sentado. El corazón de cada fiesta.",
    voice_style: "Vibrant masculine",
    genre_specialties: ["Salsa", "Cumbia", "Merengue"],
    mood_tags: ["Happy", "Party", "Energetic"],
    is_premium: false,
    config: {
      base_prompt:
        "salsa, cumbia and merengue, blazing brass section, congas and timbales, montuno piano, festive high-energy tropical dance",
      is_instrumental: true,
      temperature: 1.2,
      max_duration: 150,
    },
  },
  {
    slug: "vega",
    name: "Vega",
    character:
      "A neon dreamer chasing sunsets down an endless coastal highway. Bittersweet, cinematic, timeless.",
    voice_style: "Airy androgynous",
    genre_specialties: ["Synthwave", "Dream Pop", "Indie"],
    mood_tags: ["Nostalgic", "Dreamy", "Euphoric"],
    is_premium: false,
    config: {
      base_prompt:
        "synthwave and dream pop, lush analog pads, gated retro drums, shimmering arpeggios, nostalgic, euphoric, cinematic widescreen",
      is_instrumental: true,
      temperature: 0.9,
      max_duration: 180,
    },
  },
  {
    slug: "kismet",
    name: "Kismet",
    character:
      "A hypnotic groove architect. Endless rolling basslines under city lights until sunrise.",
    voice_style: "Smooth masculine",
    genre_specialties: ["Deep House", "House", "Afrobeat"],
    mood_tags: ["Groovy", "Late Night", "Euphoric"],
    is_premium: false,
    config: {
      base_prompt:
        "deep house and afro house, rolling bassline, warm organic percussion, hypnotic groove, 122 BPM, late-night club euphoria",
      is_instrumental: true,
      temperature: 1.1,
      max_duration: 180,
    },
  },
  {
    slug: "ember",
    name: "Ember",
    character:
      "Golden-hour warmth in human form. Silky and soulful, with groove in the bones — makes everything feel good.",
    voice_style: "Rich soulful feminine",
    genre_specialties: ["Soul", "Funk", "R&B"],
    mood_tags: ["Groovy", "Romantic", "Happy"],
    is_premium: false,
    config: {
      base_prompt:
        "soul, funk and R&B, warm fat bass, wah guitar, punchy horn stabs, silky heartfelt vocals, groovy, feel-good golden hour",
      is_instrumental: false,
      temperature: 0.9,
      max_duration: 160,
    },
  },
];

async function main() {
  for (const dj of DJS) {
    const { config, ...djRow } = dj;

    const { data: saved, error } = await admin
      .from("djs")
      .upsert(djRow, { onConflict: "slug" })
      .select("id, slug")
      .single();
    if (error) throw error;
    console.log(`✓ dj ${saved.slug} (${saved.id})`);

    const { error: cfgErr } = await admin.from("dj_generation_configs").upsert(
      {
        dj_id: saved.id,
        base_prompt: config.base_prompt,
        is_instrumental: config.is_instrumental,
        temperature: config.temperature,
        max_duration: config.max_duration,
      },
      { onConflict: "dj_id" },
    );
    if (cfgErr) throw cfgErr;
    console.log(`  ✓ config ${saved.slug}`);
  }
  console.log("\nSeed done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
