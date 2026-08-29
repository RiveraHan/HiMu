// The catalog lives in _shared so the edge functions validate against the
// exact same data; this module re-exports it as the app-facing facade.

export {
  DJ_MOODS,
  FOCUS_MOODS,
  GENRE_GROUPS,
  GENRES,
  MOOD_GROUPS
} from "@/supabase/functions/_shared/music-catalog";
export type { DJMood, Genre } from "@/supabase/functions/_shared/music-catalog";

export const ATMOSPHERES = ["calm", "balanced", "intense"] as const;
export type Atmosphere = (typeof ATMOSPHERES)[number];

export type MusicPreferences = {
  genres: string[];
  excludedMoods: string[];
  atmosphere: Atmosphere;
};

export const DEFAULT_MUSIC_PREFERENCES: MusicPreferences = {
  genres: [],
  excludedMoods: [],
  atmosphere: "balanced",
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

export function mergeMusicPreferences(row: unknown): MusicPreferences {
  const r = asRecord(row);
  const atmosphere = r.atmosphere;

  return {
    genres: strArray(r.genres),
    excludedMoods: strArray(r.moods),
    atmosphere:
      atmosphere === "calm" ||
      atmosphere === "balanced" ||
      atmosphere === "intense"
        ? atmosphere
        : DEFAULT_MUSIC_PREFERENCES.atmosphere,
  };
}
