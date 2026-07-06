/**
 * DJ avatars with Replicate flux-1.1-pro → R2 → djs.avatar_url.
 * Each DJ gets its own color palette so they don't look alike.
 *
 *   npm run gen:avatars
 */
import { admin, DJ_PALETTES, imageGen, uploadFromUrl } from "./lib";

const AVATAR_STYLE =
  "cinematic stylized portrait of a futuristic AI DJ, premium, dramatic rim " +
  "lighting, glossy detailed skin, ultra sharp focus, centered bust, no text, no watermark";

const DJ_LOOKS: Record<string, string> = {
  nova: "ethereal female android, dreamy melancholic gaze, soft flowing pastel hair, ambient mist",
  axon: "sharp male android, angular jaw, glowing circuit tattoos, intense confident stare",
  sage: "androgynous serene figure with organic leaf-and-light motifs, calm meditative expression",
  solano: "charismatic Latino male android, sharp fade, subtle gold chain, confident sun-kissed grin",
  marea: "elegant Latina figure, a rose in flowing dark hair, soft sultry gaze, warm bokeh",
  fuego: "joyful figure caught mid-dance, bold tropical patterns, radiant carnival energy",
  vega: "retro-futurist figure, chrome sunglasses reflecting a neon sunset, cool 80s poise",
  kismet: "sleek composed figure half in shadow, glowing neon city reflections, mysterious calm",
  ember: "radiant soul singer, warm natural afro, golden jewelry, joyful glowing smile",
};

async function main() {
  // Incremental: only DJs missing an avatar. Re-running never clobbers an
  // existing one — null the avatar_url first to force a regen.
  const { data: djs, error } = await admin
    .from("djs")
    .select("id, slug")
    .is("avatar_url", null);
  if (error) throw error;

  for (const dj of djs ?? []) {
    const look = DJ_LOOKS[dj.slug as keyof typeof DJ_LOOKS];
    const palette = DJ_PALETTES[dj.slug];
    if (!look || !palette) continue;

    console.log(`Generating avatar for ${dj.slug}…`);
    const tempUrl = await imageGen(
      `${look}. ${AVATAR_STYLE}. Color palette: ${palette}`,
    );
    const url = await uploadFromUrl(
      `avatars/djs/${dj.slug}.jpg`,
      tempUrl,
      "image/jpeg",
    );

    const { error: upErr } = await admin
      .from("djs")
      .update({ avatar_url: url })
      .eq("id", dj.id);
    if (upErr) throw upErr;
    console.log(`  ✓ ${url}`);
  }
  console.log("\nAvatars done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
