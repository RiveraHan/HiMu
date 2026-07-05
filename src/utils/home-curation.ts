// Pure, deterministic curation helpers for the Home surface.
// No React / Deno / network — safe to check in isolation.

export type TimeOfDayBucket = "morning" | "afternoon" | "evening" | "lateNight";

// The user's own DJs are this many times more likely to be the daily resident
// than system DJs. Heuristic — tune here.
export const OWN_DJ_HERO_WEIGHT = 3;

export function timeOfDayBucket(hour: number): TimeOfDayBucket {
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  if (hour >= 18 && hour <= 22) return "evening";
  return "lateNight"; // 23–4
}

// Mood vocabulary MUST be exact MOOD_GROUPS items (see _shared/music-catalog.ts).
export const TIME_OF_DAY_MOODS: Record<TimeOfDayBucket, string[]> = {
  morning: ["Uplifting", "Happy", "Energetic", "Groovy"],
  afternoon: ["Groovy", "Focus", "Playful", "Uplifting"],
  evening: ["Relax", "Romantic", "Cozy", "Nostalgic"],
  lateNight: ["Late Night", "Dreamy", "Ethereal", "Mysterious", "Sleep"],
};

export const TIME_OF_DAY_HEADLINES: Record<TimeOfDayBucket, string> = {
  morning: "Easing you into the morning.",
  afternoon: "Keeping your afternoon in flow.",
  evening: "Something warm to wind down.",
  lateNight: "Late-night frequencies, just for you.",
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDayBucket, string> = {
  morning: "For your morning",
  afternoon: "For your afternoon",
  evening: "For your evening",
  lateNight: "Late night",
};

// Deterministic 32-bit FNV-1a hash of a string → unsigned int.
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Seed from user + calendar day → stable within a day, rotates daily.
export function daySeed(userId: string, dateStr: string): number {
  return hashString(`${userId}|${dateStr}`);
}

// Map a seed to a unit float in [0, 1) deterministically (mulberry32 step).
function seedToUnit(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Deterministic weighted pick. Returns null only for an empty list.
export function weightedPick<T>(
  items: readonly T[],
  weightFn: (item: T) => number,
  seed: number,
): T | null {
  if (items.length === 0) return null;
  const weights = items.map((it) => Math.max(0, weightFn(it)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];
  let r = seedToUnit(seed) * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// Among a DJ's recent tracks (newest-first), prefer one matching the hour's
// moods; else the newest. `recentOfDj` must be non-empty.
export function pickHeroTrack<T extends { mood_tags: string[] | null }>(
  recentOfDj: readonly T[],
  bucket: TimeOfDayBucket,
): T {
  const moods = TIME_OF_DAY_MOODS[bucket];
  const match = recentOfDj.find((t) =>
    (t.mood_tags ?? []).some((m) => moods.includes(m)),
  );
  return match ?? recentOfDj[0];
}
