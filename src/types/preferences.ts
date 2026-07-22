import { isLanguagePreference } from "@/src/i18n/locale";
import type { LanguagePreference } from "@/src/i18n/types";

export type DownloadQuality = "low" | "high" | "lossless";

export type UserPreferences = {
  language: LanguagePreference;
  audio: {
    lossless: boolean;
    downloadQuality: DownloadQuality;
  };
  notifications: {
    push: boolean;
    emailNewsletters: boolean;
  };
};

export type UserPreferencesPatch = {
  language?: LanguagePreference;
  audio?: Partial<UserPreferences["audio"]>;
  notifications?: Partial<UserPreferences["notifications"]>;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: "system",
  audio: {
    lossless: false,
    downloadQuality: "high",
  },
  notifications: {
    push: true,
    emailNewsletters: false,
  },
};

/*
  DeepPartial<T> is a utility type that makes all properties of T optional,
  recursively for nested objects.
*/
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/*
  Merges the stored preferences with the default preferences,
  ensuring all properties are set.
*/
export function mergePreferences(stored: unknown): UserPreferences {
  const preferences = (stored ?? {}) as DeepPartial<UserPreferences>;

  return {
    language: isLanguagePreference(preferences.language)
      ? preferences.language
      : "system",
    audio: {
      lossless:
        preferences.audio?.lossless ?? DEFAULT_PREFERENCES.audio.lossless,
      downloadQuality:
        preferences.audio?.downloadQuality ??
        DEFAULT_PREFERENCES.audio.downloadQuality,
    },
    notifications: {
      push:
        preferences.notifications?.push ??
        DEFAULT_PREFERENCES.notifications.push,
      emailNewsletters:
        preferences.notifications?.emailNewsletters ??
        DEFAULT_PREFERENCES.notifications.emailNewsletters,
    },
  };
}

export function patchPreferences(
  current: UserPreferences,
  patch: UserPreferencesPatch,
): UserPreferences {
  return {
    language: patch.language ?? current.language,
    audio: { ...current.audio, ...patch.audio },
    notifications: { ...current.notifications, ...patch.notifications },
  };
}
