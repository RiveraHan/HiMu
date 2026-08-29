import {
  filterExcluded,
  trackWeight,
  weightedShuffle,
  type TasteWeights,
} from "@/src/utils/weighted-shuffle";

const taste: TasteWeights = {
  affineGenres: new Set(["Ambient"]),
  excludedMoods: new Set(["Angry"]),
  topGenre: "Ambient",
  atmosphere: "calm",
};

describe("trackWeight", () => {
  it.each([
    [{ genre: "Ambient", energy_level: 3 }, 7],
    [{ genre: "Ambient", energy_level: null }, 5],
    [{ genre: "House", energy_level: 8 }, 1],
    [{ genre: "House", energy_level: 3 }, 3],
  ])("returns %i for calm track %o", (track, expected) => {
    expect(trackWeight(track, taste)).toBe(expected);
  });

  it("applies intense energy only in the 7 through 10 range", () => {
    expect(trackWeight(
      { genre: "House", energy_level: 8 },
      { ...taste, atmosphere: "intense" },
    )).toBe(3);
  });

  it("does not apply an energy preference when atmosphere is balanced", () => {
    expect(trackWeight(
      { genre: "House", energy_level: 3 },
      { ...taste, atmosphere: "balanced" },
    )).toBe(1);
  });
});

describe("weightedShuffle", () => {
  it("excludes tracks before drawing weighted random keys", () => {
    const random = jest.fn(() => 0.5);
    const tracks = [
      { id: "excluded", genre: "Ambient", mood_tags: ["Angry"], energy_level: 3 },
      { id: "included", genre: "Ambient", mood_tags: [], energy_level: 3 },
    ];

    expect(weightedShuffle(tracks, taste, random).map((track) => track.id)).toEqual([
      "included",
    ]);
    expect(random).toHaveBeenCalledTimes(1);
    expect(filterExcluded(tracks, taste.excludedMoods)).toEqual([tracks[1]]);
  });

  it("uses injected randomness for a deterministic weighted order", () => {
    const tracks = [
      { id: "first", genre: "House", mood_tags: [], energy_level: 8 },
      { id: "second", genre: "House", mood_tags: [], energy_level: 8 },
    ];
    const randomValues = [0.2, 0.8];
    const random = () => randomValues.shift()!;

    expect(weightedShuffle(tracks, taste, random).map((track) => track.id)).toEqual([
      "second",
      "first",
    ]);
  });
});
