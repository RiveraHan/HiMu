import { sanitize } from "./text.ts";

export const GENRES = [
  "Ambient",
  "Neo-Classical",
  "IDM",
  "Jazz",
  "Post-Rock",
  "Minimal Techno",
  "Drone",
];

export const DJ_MOODS = [
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

export type DjInput = {
  name: string;
  genres: string[];
  moods: string[];
  energy: number;
  isInstrumental: boolean;
  vibe: string | null;
};

function pickList(value: unknown, allowed: string[]): string[] | null {
  if (!Array.isArray(value)) return null;

  const picks = [...new Set(value.filter((v) => typeof v === "string"))];

  if (picks.length < 1 || picks.length > 3) return null;

  return picks.every((p) => allowed.includes(p as string))
    ? (picks as string[])
    : null;
}

export function validateDjInput(
  body: unknown,
): { ok: true; data: DjInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = typeof b.name === "string" ? sanitize(b.name, 24) : "";
  if (name.length < 2)
    return { ok: false, error: "name must be 2-24 characters" };
  if (!/^[\p{L}\p{N} \-'&]+$/u.test(name)) {
    return { ok: false, error: "name has unsupported characters" };
  }

  const genres = pickList(b.genres, GENRES);
  if (!genres) return { ok: false, error: "pick 1-3 genres from the list" };

  const moods = pickList(b.moods, DJ_MOODS);
  if (!moods) return { ok: false, error: "pick 1-3 moods from the list" };

  const energy = typeof b.energy === "number" ? b.energy : NaN;
  if (!Number.isInteger(energy) || energy < 1 || energy > 10) {
    return { ok: false, error: "energy must be an integer 1-10" };
  }

  if (typeof b.isInstrumental !== "boolean") {
    return { ok: false, error: "isInstrumental must be a boolean" };
  }

  let vibe: string | null = null;
  if (b.vibe != null) {
    if (typeof b.vibe !== "string") {
      return { ok: false, error: "vibe must be text" };
    }
    vibe = sanitize(b.vibe, 140) || null;
  }

  return {
    ok: true,
    data: {
      name,
      genres,
      moods,
      energy,
      isInstrumental: b.isInstrumental,
      vibe,
    },
  };
}

// Fixed prompt template (the only free text is the sanitized vibe).
export function buildBasePrompt(d: DjInput): string {
  return (
    `${d.genres.join(" and ").toLowerCase()} music, ` +
    `${d.moods.join(", ").toLowerCase()} mood, energy ${d.energy}/10` +
    (d.vibe ? `, ${d.vibe}` : "")
  );
}

export function buildAvatarPrompt(genres: string[], moods: string[]): string {
  return (
    `stylized portrait of a fictional AI DJ persona, ` +
    `${genres.join(" ").toLowerCase()} ${moods.join(" ").toLowerCase()} aesthetic, ` +
    `cinematic lighting, digital art, premium, no text, no watermark`
  );
}
