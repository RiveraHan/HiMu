export type Href = string;

export const router = {
  back: () => undefined,
  canGoBack: () => true,
  push: () => undefined,
  replace: () => {
    const browserWindow = window as typeof window & {
      __HIMU_SETTINGS_COUNTERS__?: Record<string, number>;
    };
    browserWindow.__HIMU_SETTINGS_COUNTERS__ ??= {};
    browserWindow.__HIMU_SETTINGS_COUNTERS__.redirects =
      (browserWindow.__HIMU_SETTINGS_COUNTERS__.redirects ?? 0) + 1;
  },
};
