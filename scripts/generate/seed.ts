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
    genre_specialties: ["Techno", "House", "Electro"],
    mood_tags: ["Energize", "Workout", "Party"],
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
    genre_specialties: ["Classical", "Nature Sounds", "Meditation"],
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
        provider: "minimax", // CHECK allows 'minimax' | 'elevenlabs'
        model: "minimax/music-2.6", // real Cloudflare model id
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
