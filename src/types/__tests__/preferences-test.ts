import { DEFAULT_PREFERENCES, mergePreferences } from "../preferences";
import {
  DEFAULT_MUSIC_PREFERENCES,
  mergeMusicPreferences,
} from "../music-preferences";

test("existing profiles default to device language", () => {
  expect(mergePreferences({ audio: {}, notifications: {} }).language).toBe(
    "system",
  );
  expect(DEFAULT_PREFERENCES.language).toBe("system");
});

test("validates stored language preferences", () => {
  expect(mergePreferences({ language: "es" }).language).toBe("es");
  expect(mergePreferences({ language: "fr" }).language).toBe("system");
});

test("defaults missing music preferences to the compact balanced projection", () => {
  expect(mergeMusicPreferences(null)).toEqual({
    genres: [],
    excludedMoods: [],
    atmosphere: "balanced",
  });
  expect(DEFAULT_MUSIC_PREFERENCES).toEqual({
    genres: [],
    excludedMoods: [],
    atmosphere: "balanced",
  });
});

test("projects stored music preferences without truncating or reordering arrays", () => {
  expect(
    mergeMusicPreferences({
      genres: ["Ambient", "House", "Jazz", "Pop", "Rock", "Soul"],
      moods: ["Calm", "Focus", "Dreamy", "Warm"],
      atmosphere: "intense",
      vibe_mapping: {
        organic_electronic: 0.9,
        melancholic_euphoric: 0.1,
      },
      ai_frequency: "high",
      discovery_depth: true,
    }),
  ).toEqual({
    genres: ["Ambient", "House", "Jazz", "Pop", "Rock", "Soul"],
    excludedMoods: ["Calm", "Focus", "Dreamy", "Warm"],
    atmosphere: "intense",
  });
});

test("defaults an invalid stored atmosphere to balanced", () => {
  expect(mergeMusicPreferences({ atmosphere: "invalid" }).atmosphere).toBe(
    "balanced",
  );
});
