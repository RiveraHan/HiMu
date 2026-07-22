import { DEFAULT_PREFERENCES, mergePreferences } from "../preferences";

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
