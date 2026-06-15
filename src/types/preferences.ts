export type DownloadQuality = "low" | "high" | "lossless";

export type UserPreferences = {
  audio: {
    lossless: boolean;
    downloadQuality: DownloadQuality;
  };
  notifications: {
    push: boolean;
    emailNewsletter: boolean;
  };
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  audio: {
    lossless: false,
    downloadQuality: "high",
  },
  notifications: {
    push: true,
    emailNewsletter: false,
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
      emailNewsletter:
        preferences.notifications?.emailNewsletter ??
        DEFAULT_PREFERENCES.notifications.emailNewsletter,
    },
  };
}
