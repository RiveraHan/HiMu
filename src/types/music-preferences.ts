export const GENRES = [
  "Ambient",
  "Neo-Classical",
  "IDM",
  "Jazz",
  "Post-Rock",
  "Minimal Techno",
  "Drone",
] as const;

export type Genre = (typeof GENRES)[number];

export const EXCLUDABLE_MOODS = [
  "Aggressive",
  "Frantic",
  "Melancholic",
  "Somber",
  "Chaotic",
  "Tense",
  "Anxious",
] as const;

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
] as const;

export type Mood = (typeof DJ_MOODS)[number];

export const AI_FREQUENCIES = ["low", "optimal", "high"] as const;
export type AiFrequency = (typeof AI_FREQUENCIES)[number];

export type MusicPreferences = {
  genres: string[];
  excludedMoods: string[];
  vibeMapping: { organicElectronic: number; melancholicEuphoric: number };
  aiFrequency: AiFrequency;
  discoveryDepth: boolean;
};

export const DEFAULT_MUSIC_PREFERENCES: MusicPreferences = {
  genres: [],
  excludedMoods: [],
  vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
  aiFrequency: "optimal",
  discoveryDepth: false,
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

export function mergeMusicPreferences(row: unknown): MusicPreferences {
  const r = asRecord(row);
  const vm = asRecord(r.vibe_mapping);
  const freq = r.ai_frequency;

  return {
    genres: strArray(r.genres),
    excludedMoods: strArray(r.moods),
    vibeMapping: {
      organicElectronic: num(
        vm.organic_electronic,
        DEFAULT_MUSIC_PREFERENCES.vibeMapping.organicElectronic,
      ),
      melancholicEuphoric: num(
        vm.melancholic_euphoric,
        DEFAULT_MUSIC_PREFERENCES.vibeMapping.melancholicEuphoric,
      ),
    },
    aiFrequency:
      freq === "low" || freq === "optimal" || freq === "high"
        ? freq
        : DEFAULT_MUSIC_PREFERENCES.aiFrequency,
    discoveryDepth:
      typeof r.discovery_depth === "boolean"
        ? r.discovery_depth
        : DEFAULT_MUSIC_PREFERENCES.discoveryDepth,
  };
}
