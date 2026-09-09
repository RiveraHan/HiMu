import "../../src/theme";
import i18n from "../../src/i18n";
// @ts-expect-error React DOM is an installed browser runtime without local declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useState } from "react";

import PublicTrackScreen from "../../app/track/[id]";
import { ConfirmDialogHost } from "../../src/components/ConfirmDialog";
import { HiMuMomentCard } from "../../src/components/experience/HiMuMomentCard";
import type { OwnerTrackMoment } from "../../src/moment/moment-types";

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_MOMENT_READY__?: boolean;
    __HIMU_MOMENT_READ__?: () => Record<string, unknown>;
  }
}

const track = {
  id: "00000000-0000-4000-8000-000000000071",
  title: "Moment browser fixture",
  artist: "HiMu",
  album_art_url: null,
};

function read() {
  const moment = document.querySelector<HTMLElement>("[data-testid=\"himu-moment-card\"]");
  const dialog = document.querySelector<HTMLElement>("[role=\"dialog\"]");
  const active = document.activeElement as HTMLElement | null;
  return {
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    visualViewport: {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
      scale: window.visualViewport?.scale ?? 1,
      devicePixelRatio: window.devicePixelRatio,
    },
    momentVisible: Boolean(moment),
    publishDisabled: document.querySelector("[data-testid=moment-publish]")?.getAttribute("aria-disabled") ?? null,
    dialog: dialog ? {
      role: dialog.getAttribute("role"),
      ariaModal: dialog.getAttribute("aria-modal"),
      title: document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent?.trim() ?? null,
    } : null,
    activeTestId: active?.dataset.testid ?? null,
    activeLabel: active?.getAttribute("aria-label") ?? active?.textContent?.trim() ?? null,
    body: document.body.textContent?.replace(/\s+/g, " ").trim() ?? "",
  };
}

function MomentFixture() {
  const [moment, setMoment] = useState<OwnerTrackMoment>({
    trackId: track.id,
    visibility: "private" as const,
    audioUrl: "r2-private://tracks/generated/browser.mp3",
    albumArtUrl: null,
  });
  return (
    <>
      <HiMuMomentCard
        track={track}
        moment={moment}
        feedback={{ surprised: null, wouldShare: null }}
        setVisibility={{
          isPending: false,
          isError: false,
          mutateAsync: async ({ visibility }) => {
            const next = { ...moment, visibility, audioUrl: visibility === "public" ? "https://media.himu.test/browser.mp3" : "r2-private://tracks/generated/browser.mp3" };
            setMoment(next);
            return next;
          },
        }}
        setFeedback={{
          isPending: false,
          isError: false,
          mutateAsync: async (patch) => ({ surprised: patch.surprised ?? null, wouldShare: patch.wouldShare ?? null }),
        }}
      />
      <ConfirmDialogHost />
    </>
  );
}

async function start() {
  await i18n.changeLanguage(new URLSearchParams(window.location.search).get("locale") === "es" ? "es" : "en");
  const root = document.querySelector("#root");
  if (!root) throw new Error("Missing Moment browser root");
  createRoot(root).render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
      {window.location.pathname.startsWith("/track/") ? <PublicTrackScreen /> : <MomentFixture />}
    </SafeAreaProvider>,
  );
  window.__HIMU_MOMENT_READ__ = read;
  window.__HIMU_MOMENT_READY__ = true;
}

void start().catch((error: unknown) => {
  window.__HIMU_BROWSER_ERROR__ = error instanceof Error ? error.stack ?? error.message : String(error);
});
