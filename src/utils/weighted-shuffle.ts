export type TasteWeights = {
  affineGenres: ReadonlySet<string>;
  excludedMoods: ReadonlySet<string>;
  topGenre: string | null;
  atmosphere: "calm" | "balanced" | "intense";
};

export type Weighable = {
  genre?: string | null;
  mood_tags?: string[] | null;
  energy_level?: number | null;
};

// Initial heuristics — tune here, nowhere else.
const AFFINE_BONUS = 2; // genre is in the user's explicit preferences
const TOP_GENRE_BONUS = 2; // genre is the user's most-listened lately
const ATMOSPHERE_BONUS = 2;

export function filterExcluded<T extends Weighable>(
  tracks: T[],
  excludedMoods: ReadonlySet<string>,
): T[] {
  if (excludedMoods.size === 0) return tracks;
  return tracks.filter(
    (t) => !(t.mood_tags ?? []).some((m) => excludedMoods.has(m)),
  );
}

export function trackWeight(track: Weighable, taste: TasteWeights): number {
  const genre = track.genre ?? "";
  const energy = track.energy_level;
  const calmMatch =
    taste.atmosphere === "calm" && energy != null && energy >= 1 && energy <= 4;
  const intenseMatch =
    taste.atmosphere === "intense" && energy != null && energy >= 7 && energy <= 10;

  return 1
    + (taste.affineGenres.has(genre) ? AFFINE_BONUS : 0)
    + (genre !== "" && genre === taste.topGenre ? TOP_GENRE_BONUS : 0)
    + (calmMatch || intenseMatch ? ATMOSPHERE_BONUS : 0);
}

/**
 * Hard-filters excluded moods, then orders by weighted sampling without
 * replacement (Efraimidis–Spirakis: key = random^(1/w), descending).
 * Neutral taste (empty sets, null topGenre) degrades to a fair shuffle.
 */
export function weightedShuffle<T extends Weighable>(
  tracks: T[],
  taste: TasteWeights,
  random: () => number = Math.random,
): T[] {
  return filterExcluded(tracks, taste.excludedMoods)
    .map((t) => {
      return { t, key: random() ** (1 / trackWeight(t, taste)) };
    })
    .sort((a, b) => b.key - a.key)
    .map(({ t }) => t);
}
