export const authApi = {
  signOut: async () => {
    const browserWindow = window as typeof window & {
      __HIMU_SETTINGS_COUNTERS__?: Record<string, number>;
    };
    browserWindow.__HIMU_SETTINGS_COUNTERS__ ??= {};
    browserWindow.__HIMU_SETTINGS_COUNTERS__.signOuts =
      (browserWindow.__HIMU_SETTINGS_COUNTERS__.signOuts ?? 0) + 1;
  },
};
