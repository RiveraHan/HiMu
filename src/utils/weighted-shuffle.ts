export type TasteWeights = {
  affineGenres: ReadonlySet<string>;
  excludedMoods: ReadonlySet<string>;
  topGenre: string | null;
};

type Weighable = {
  genre?: string | null;
  mood_tags?: string[] | null;
};

// Initial heuristics — tune here, nowhere else.
const AFFINE_BONUS = 2; // genre is in the user's explicit preferences
const TOP_GENRE_BONUS = 2; // genre is the user's most-listened lately

export function filterExcluded<T extends Weighable>(
  tracks: T[],
  excludedMoods: ReadonlySet<string>,
): T[] {
  if (excludedMoods.size === 0) return tracks;
  return tracks.filter(
    (t) => !(t.mood_tags ?? []).some((m) => excludedMoods.has(m)),
  );
}

/**
 * Hard-filters excluded moods, then orders by weighted sampling without
 * replacement (Efraimidis–Spirakis: key = random^(1/w), descending).
 * Neutral taste (empty sets, null topGenre) degrades to a fair shuffle.
 */
export function weightedShuffle<T extends Weighable>(
  tracks: T[],
  taste: TasteWeights,
): T[] {
  return filterExcluded(tracks, taste.excludedMoods)
    .map((t) => {
      const genre = t.genre ?? "";
      const weight =
        1 +
        (taste.affineGenres.has(genre) ? AFFINE_BONUS : 0) +
        (genre !== "" && genre === taste.topGenre ? TOP_GENRE_BONUS : 0);
      return { t, key: Math.random() ** (1 / weight) };
    })
    .sort((a, b) => b.key - a.key)
    .map(({ t }) => t);
}
