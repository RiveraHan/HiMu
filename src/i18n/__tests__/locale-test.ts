import { isLanguagePreference, resolveLanguage } from "../locale";

describe("locale resolution", () => {
  test.each(["es", "es-NI", "es-MX"])("maps %s to Spanish", (locale) => {
    expect(resolveLanguage("system", locale)).toBe("es");
  });

  test.each(["en", "fr", null, undefined])("falls back to English for %s", (locale) => {
    expect(resolveLanguage("system", locale)).toBe("en");
  });

  test("an explicit preference overrides the device", () => {
    expect(resolveLanguage("es", "en-US")).toBe("es");
    expect(resolveLanguage("en", "es-NI")).toBe("en");
  });

  test("accepts only supported preference values", () => {
    expect(["system", "en", "es"].every(isLanguagePreference)).toBe(true);
    expect(isLanguagePreference("fr")).toBe(false);
  });
});
