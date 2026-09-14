import "../../src/theme";
import i18n from "../../src/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @ts-expect-error React DOM is an installed browser runtime without local declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PublicTrackLanding } from "../../app/track/[id]";

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_PUBLIC_TRACK_READY__?: boolean;
    __HIMU_PUBLIC_TRACK_READ__?: () => Record<string, unknown>;
  }
}

function trackIdFromLocation(): string | undefined {
  const match = window.location.pathname.match(/^\/track\/([^/]+)$/);
  return match ? decodeURIComponent(match[1] ?? "") : undefined;
}

function read() {
  const alert = document.querySelector<HTMLElement>("[role=alert]");
  const body = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return {
    ready: window.__HIMU_PUBLIC_TRACK_READY__ === true,
    alert: alert ? {
      label: alert.getAttribute("aria-label") ?? "",
      text: alert.textContent?.replace(/\s+/g, " ").trim() ?? "",
    } : null,
    body,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  };
}

async function start() {
  await i18n.changeLanguage("en");
  const root = document.querySelector("#root");
  if (!root) throw new Error("Missing public track route root");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  createRoot(root).render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
      <QueryClientProvider client={queryClient}>
        <PublicTrackLanding trackId={trackIdFromLocation()} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  window.__HIMU_PUBLIC_TRACK_READ__ = read;
  window.__HIMU_PUBLIC_TRACK_READY__ = true;
}

void start().catch((error: unknown) => {
  window.__HIMU_BROWSER_ERROR__ = error instanceof Error ? error.stack ?? error.message : String(error);
});
