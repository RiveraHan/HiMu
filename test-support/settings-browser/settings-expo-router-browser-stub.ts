export type Href = string;

function routeCalls() {
  window.__HIMU_SETTINGS_ROUTE_CALLS__ ??= [];
  return window.__HIMU_SETTINGS_ROUTE_CALLS__;
}

export const router = {
  back: () => undefined,
  canGoBack: () => true,
  canDismiss: () => false,
  dismiss: () => undefined,
  push: (href: unknown) => routeCalls().push({ method: "push", href }),
  replace: () => {
    const browserWindow = window as typeof window & {
      __HIMU_SETTINGS_COUNTERS__?: Record<string, number>;
    };
    browserWindow.__HIMU_SETTINGS_COUNTERS__ ??= {};
    browserWindow.__HIMU_SETTINGS_COUNTERS__.redirects =
      (browserWindow.__HIMU_SETTINGS_COUNTERS__.redirects ?? 0) + 1;
  },
};
