import { LANGUAGE_PREFERENCES, type LanguagePreference, type SupportedLanguage } from "./types";

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === "string" && LANGUAGE_PREFERENCES.includes(value as LanguagePreference);
}

export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguageCode?: string | null,
): SupportedLanguage {
  if (preference !== "system") return preference;
  return deviceLanguageCode?.toLowerCase().split("-")[0] === "es" ? "es" : "en";
}
