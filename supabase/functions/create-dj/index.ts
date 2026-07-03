/**
 * Creates a user-owned DJ: validates wizard input, enforces the DJ quota,
 * builds the generation config server-side.
 * The DJ is created even if the avatar fails (client falls back to initials).
 */

import { invalid, json } from "../_shared/http.ts";
import { r2Delete, r2Put } from "../_shared/r2.ts";
import { replicateRun } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { sanitize } from "../_shared/text.ts";

const MAX_DJS = 2;

// Keep in sync with GENRES / DJ_MOODS in src/types/music-preferences.ts
const GENRES = [
  "Ambient",
  "Neo-Classical",
  "IDM",
  "Jazz",
  "Post-Rock",
  "Minimal Techno",
  "Drone",
];
const DJ_MOODS = [
  "Focus",
  "Relax",
  "Dreamy",
  "Meditate",
  "Nature",
  "Sleep",
  "Energetic",
  "Uplifting",
  "Dark",
  "Melancholic",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// 1-3 unique picks from an allowed list, or null if invalid.
function pickList(value: unknown, allowed: string[]): string[] | null {
  if (!Array.isArray(value)) return null;

  const picks = [...new Set(value.filter((v) => typeof v === "string"))];

  if (picks.length < 1 || picks.length > 3) return null;

  return picks.every((p) => allowed.includes(p as string))
    ? (picks as string[])
    : null;
}

serveAuthed(async (req, user) => {
  // Validation (mirror of the wizard's client-side rules)
  const body = await req.json();

  const name = typeof body.name === "string" ? sanitize(body.name, 24) : "";

  if (name.length < 2) return invalid("name must be 2-24 characters");
  if (!/^[\p{L}\p{N} \-'&]+$/u.test(name)) {
    return invalid("name has unsupported characters");
  }

  const genres = pickList(body.genres, GENRES);
  if (!genres) return invalid("pick 1-3 genres from the list");

  const moods = pickList(body.moods, DJ_MOODS);
  if (!moods) return invalid("pick 1-3 moods from the list");

  const energy = body.energy;
  if (!Number.isInteger(energy) || energy < 1 || energy > 10) {
    return invalid("energy must be an integer 1-10");
  }

  if (typeof body.isInstrumental !== "boolean") {
    return invalid("isInstrumental must be a boolean");
  }

  const isInstrumental: boolean = body.isInstrumental;

  let vibe: string | null = null;

  if (body.vibe != null) {
    if (typeof body.vibe !== "string") return invalid("vibe must be text");
    vibe = sanitize(body.vibe, 140) || null;
  }

  // Quota check
  const { count } = await admin
    .from("djs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if ((count ?? 0) >= MAX_DJS) {
    return json(
      { error: `you already have ${MAX_DJS} DJs`, code: "dj_quota_reached" },
      403,
    );
  }

  // Fixed prompt template (the only free text is the sanitized vibe)
  const basePrompt =
    `${genres.join(" and ").toLowerCase()} music, ` +
    `${moods.join(", ").toLowerCase()} mood, energy ${energy}/10` +
    (vibe ? `, ${vibe}` : "");

  let dj: { id: string } | null = null;

  for (let attempt = 0; attempt < 2 && !dj; attempt++) {
    const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 4)}`;

    const { data, error } = await admin
      .from("djs")
      .insert({
        name,
        slug,
        owner_id: user.id,
        is_public: false,
        character: vibe,
        genre_specialties: genres,
        mood_tags: moods,
        personality_traits: { energy, vibe, isInstrumental },
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505" && attempt === 0) continue; // slug collision
      throw error;
    }

    dj = data;
  }

  if (!dj) throw new Error("could not insert dj");

  // From here on, roll back on failure so no half-created DJ survives.
  try {
    const { error: cfgErr } = await admin
      .from("dj_generation_configs")
      .insert({
        dj_id: dj.id,
        base_prompt: basePrompt,
        is_instrumental: isInstrumental,
        max_duration: 120,
      });

    if (cfgErr) throw cfgErr;

    let avatarReady = false;

    try {
      const url = await replicateRun(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
        {
          input: {
            prompt:
              `stylized portrait of a fictional AI DJ persona, ` +
              `${genres.join(" ").toLowerCase()} ${moods.join(" ").toLowerCase()} aesthetic, ` +
              `cinematic lighting, digital art, premium, no text, no watermark`,
            aspect_ratio: "1:1",
            output_format: "jpg",
            safety_tolerance: 5,
          },
        },
      );

      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());

      const publicUrl = await r2Put(
        `avatars/generated/${dj.id}.jpg`,
        bytes,
        "image/jpeg",
      );

      await admin.from("djs").update({ avatar_url: publicUrl }).eq("id", dj.id);

      avatarReady = true;
    } catch (e) {
      console.error("[create-dj] avatar failed:", e);
    }

    return json({ djId: dj.id, avatarReady });
  } catch (e) {
    // Rollback: no orphaned rows or files on failure.
    await r2Delete([`avatars/generated/${dj.id}.jpg`]);
    await admin.from("djs").delete().eq("id", dj.id); // cascade removes config
    throw e;
  }
});
