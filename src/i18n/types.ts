export const LANGUAGE_PREFERENCES = ["system", "en", "es"] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];
export type SupportedLanguage = Exclude<LanguagePreference, "system">;
