// Single source of truth for the music catalog (genres and moods).
//
// PURE DATA ONLY — no imports, no Deno/React Native APIs. This file is shared
// by two runtimes: the Expo app (via "@/supabase/functions/_shared/…") and the
// edge functions (bundled frozen per function — redeploy create-dj and
// update-dj after changing it).
//
// NEVER rename or remove an entry: djs and music_preferences rows store these
// strings. Only add.

export const GENRE_GROUPS = [
  {
    label: "Chill & Ambient",
    items: ["Ambient", "Drone", "Lo-Fi", "Chillhop", "Downtempo", "Trip-Hop"],
  },
  {
    label: "Electronic",
    items: [
      "IDM",
      "Minimal Techno",
      "Techno",
      "House",
      "Deep House",
      "Trance",
      "Synthwave",
      "Drum & Bass",
      "Dub",
    ],
  },
  {
    label: "Classical & Cinematic",
    items: ["Neo-Classical", "Classical", "Piano", "Cinematic"],
  },
  {
    label: "Jazz & Soul",
    items: ["Jazz", "Blues", "Soul", "Funk", "R&B"],
  },
  {
    label: "Latin",
    items: [
      "Bossa Nova",
      "Reggaeton",
      "Salsa",
      "Cumbia",
      "Bachata",
      "Merengue",
      "Latin Pop",
      "Latin Jazz",
    ],
  },
  {
    label: "Indie & Folk",
    items: ["Post-Rock", "Indie", "Dream Pop", "Folk", "Acoustic"],
  },
  {
    label: "Global",
    items: ["Afrobeat", "World"],
  },
] as const;

export type Genre = (typeof GENRE_GROUPS)[number]["items"][number];

export const GENRES: readonly Genre[] = GENRE_GROUPS.flatMap((g) => g.items);

export const MOOD_GROUPS = [
  {
    label: "Calm",
    items: [
      "Focus",
      "Relax",
      "Dreamy",
      "Meditate",
      "Nature",
      "Sleep",
      "Cozy",
      "Ethereal",
    ],
  },
  {
    label: "Bright",
    items: [
      "Energetic",
      "Uplifting",
      "Happy",
      "Euphoric",
      "Playful",
      "Groovy",
      "Party",
      "Workout",
    ],
  },
  {
    label: "Deep",
    items: [
      "Dark",
      "Melancholic",
      "Romantic",
      "Nostalgic",
      "Mysterious",
      "Epic",
      "Intense",
      "Late Night",
      "Rainy Day",
    ],
  },
] as const;

export type DJMood = (typeof MOOD_GROUPS)[number]["items"][number];

export const DJ_MOODS: readonly DJMood[] = MOOD_GROUPS.flatMap((g) => g.items);

// Calm subset Focus Mode queries by (overlap on tracks.mood_tags).
// `satisfies` ties it to the catalog: renaming a mood breaks the build.
export const FOCUS_MOODS = [
  "Focus",
  "Relax",
  "Dreamy",
  "Meditate",
  "Nature",
  "Sleep",
  "Cozy",
  "Ethereal",
] as const satisfies readonly DJMood[];
