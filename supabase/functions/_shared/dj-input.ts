import { DJ_MOODS, GENRES } from "./music-catalog.ts";
import { sanitize } from "./text.ts";

export type DjTraitsInput = {
  name: string;
  genres: string[];
  moods: string[];
  energy: number;
  isInstrumental: boolean;
  vibe: string | null;
};

export type DjInput = DjTraitsInput & {
  identityConcept: string;
};

export function validateIdentityConcept(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("identityConcept must be text");
  }
  const concept = value.trim();
  if (concept.length < 10 || concept.length > 240) {
    throw new Error("identityConcept must be 10-240 characters");
  }
  if (/[\u0000-\u001f\u007f]/.test(concept)) {
    throw new Error("identityConcept has unsupported control characters");
  }
  if (/(?:https?:\/\/|www\.)\S+/i.test(concept)) {
    throw new Error("identityConcept must not contain a URL");
  }
  return concept;
}

export function parseIsPublic(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("isPublic must be a boolean");
  return value;
}

function pickList(value: unknown, allowed: readonly string[]): string[] | null {
  if (!Array.isArray(value)) return null;

  const picks = [...new Set(value.filter((v) => typeof v === "string"))];

  if (picks.length < 1 || picks.length > 3) return null;

  return picks.every((p) => allowed.includes(p as string))
    ? (picks as string[])
    : null;
}

export function validateDjTraitsInput(
  body: unknown,
): { ok: true; data: DjTraitsInput } | { ok: false; error: string } {
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

export function validateDjInput(
  body: unknown,
): { ok: true; data: DjInput } | { ok: false; error: string } {
  const traits = validateDjTraitsInput(body);
  if (!traits.ok) return traits;
  try {
    const identityConcept = validateIdentityConcept(
      (body as Record<string, unknown>).identityConcept,
    );
    return { ok: true, data: { ...traits.data, identityConcept } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "invalid identityConcept",
    };
  }
}

// Fixed prompt template (the only free text is the sanitized vibe).
export function buildBasePrompt(
  d: DjTraitsInput & { identityConcept?: string | null },
): string {
  return (
    `${d.genres.join(" and ").toLowerCase()} music, ` +
    `${d.moods.join(", ").toLowerCase()} mood, energy ${d.energy}/10` +
    (d.vibe ? `, ${d.vibe}` : "") +
    (d.identityConcept ? `, fictional DJ identity: ${d.identityConcept}` : "")
  );
}

export function buildDjIdentityFields(d: DjInput): {
  character: string | null;
  identity_concept: string;
} {
  return {
    character: d.vibe,
    identity_concept: d.identityConcept,
  };
}

export function buildAvatarPrompt(
  genres: string[],
  moods: string[],
  identityConcept?: string | null,
): string {
  return (
    `stylized portrait of a fictional AI DJ persona, ` +
    `${genres.join(" ").toLowerCase()} ${moods.join(" ").toLowerCase()} aesthetic, ` +
    (identityConcept ? `identity concept: ${identityConcept}, ` : "") +
    `cinematic lighting, digital art, premium, no text, no watermark`
  );
}
