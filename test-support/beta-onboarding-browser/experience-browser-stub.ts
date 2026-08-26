export const PUBLIC_INTRO_VERSION = 2;

declare global {
  interface Window {
    __HIMU_INTRO_WRITES__?: number;
    __HIMU_INTENT_WRITES__?: number;
    __HIMU_ANALYTICS_CALLS__?: number;
  }
}

window.__HIMU_INTRO_WRITES__ = 0;
window.__HIMU_INTENT_WRITES__ = 0;
window.__HIMU_ANALYTICS_CALLS__ = 0;

export const introStateStore = {
  async markSeen() {
    window.__HIMU_INTRO_WRITES__ = (window.__HIMU_INTRO_WRITES__ ?? 0) + 1;
  },
};

export const pendingIntentStore = {
  async writeFirstTrack() {
    window.__HIMU_INTENT_WRITES__ = (window.__HIMU_INTENT_WRITES__ ?? 0) + 1;
  },
};

export async function trackProductEvent() {
  window.__HIMU_ANALYTICS_CALLS__ = (window.__HIMU_ANALYTICS_CALLS__ ?? 0) + 1;
}
