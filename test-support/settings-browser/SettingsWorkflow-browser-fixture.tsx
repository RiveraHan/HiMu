import "../../src/theme";
import i18n from "../../src/i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import PlayerScreen from "../../app/player";
import MusicPreferencesScreen from "../../app/preferences";
import { ConfirmDialogHost } from "../../src/components/ConfirmDialog";
import { LocaleProvider } from "../../src/i18n/LocaleProvider";
import { usePlayerStore } from "../../src/stores/player-store";
import {
  prepareSettingsBrowserFixture,
  readPersistedPreferences,
  readSettingsCounters,
  setExperienceStatus,
} from "./settings-browser-hooks";

type RouteName = "/preferences" | "/player";

type RectSnapshot = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type SettingsSnapshot = Record<string, unknown> & { route: RouteName };

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_SETTINGS_READY__?: boolean;
    __HIMU_SETTINGS_READ__?: () => SettingsSnapshot;
    __HIMU_SETTINGS_COUNTERS__?: Record<string, number>;
    __HIMU_SETTINGS_ROUTE_CALLS__?: Array<{ method: string; href: unknown }>;
    __HIMU_SETTINGS_SET_NUDGE__?: (status: "shown" | "dismissed" | "completed") => void;
  }
}

function testElement(testID: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
}

function rect(element: Element | null): RectSnapshot | null {
  if (!element) return null;
  const value = element.getBoundingClientRect();
  return {
    left: value.left,
    top: value.top,
    right: value.right,
    bottom: value.bottom,
    width: value.width,
    height: value.height,
  };
}

function enabledControls(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>(
    '[role="button"], [role="radio"], input, button',
  )).filter(
    (element) =>
      element.getAttribute("aria-disabled") !== "true" &&
      !(element instanceof HTMLButtonElement && element.disabled),
  );
}

function controlSnapshots(root: ParentNode = document) {
  return enabledControls(root).map((element) => ({
    label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
    role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
    tabIndex: element.tabIndex,
    rect: rect(element),
  }));
}

function preferenceSnapshot(): SettingsSnapshot {
  const scroll = testElement("preferences-settings-scroll");
  if (!scroll) throw new Error("Missing production element: preferences-settings-scroll");
  const headings = Array.from(
    scroll.querySelectorAll<HTMLElement>('[role="heading"]'),
  );
  const preferenceSectionOrder = headings.map(
    (heading) => heading.textContent?.replace(/\s+/g, " ").trim() ?? "",
  );
  const sectionRects = headings.map((heading) => rect(
    heading.parentElement?.parentElement?.parentElement ?? heading,
  ));
  const radios = Array.from(scroll.querySelectorAll<HTMLElement>('[role="radio"]'));
  const selectedRadio = radios.find(
    (radio) => radio.getAttribute("aria-checked") === "true",
  );
  const dialog = testElement("catalog-picker-dialog");
  const dialogFocusables = dialog ? enabledControls(dialog) : [];
  const bodyText = document.body.textContent ?? "";
  const legacyCandidates = [
    "Vibe Mapping",
    "AI frequency",
    "Discovery depth",
    "Mapeo de ambiente",
    "Frecuencia de IA",
    "Profundidad de descubrimiento",
  ];
  const liveTexts = Array.from(
    document.querySelectorAll<HTMLElement>('[aria-live="polite"]'),
  ).map((element) => element.textContent?.trim() ?? "").filter(Boolean);

  return {
    route: "/preferences",
    documentLanguage: document.documentElement.lang,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    preferenceRootRect: rect(scroll),
    preferenceSectionOrder,
    sectionRects,
    visibleLegacyLabels: legacyCandidates.filter((label) => bodyText.includes(label)),
    atmosphereRadioCount: radios.length,
    selectedAtmosphereLabel: selectedRadio?.getAttribute("aria-label") ?? null,
    selectedAtmosphereTabIndex: selectedRadio?.tabIndex ?? null,
    targetRects: controlSnapshots(scroll),
    dialog: dialog
      ? {
          rect: rect(dialog),
          activeLabel: document.activeElement?.getAttribute("aria-label") ?? null,
          activeText: document.activeElement?.textContent?.trim() ?? null,
          focusableCount: dialogFocusables.length,
          targetRects: controlSnapshots(dialog),
          firstLabel:
            dialogFocusables[0]?.getAttribute("aria-label") ??
            dialogFocusables[0]?.textContent?.trim() ??
            null,
          lastLabel:
            dialogFocusables.at(-1)?.getAttribute("aria-label") ??
            dialogFocusables.at(-1)?.textContent?.trim() ??
            null,
        }
      : null,
    activeLabel: document.activeElement?.getAttribute("aria-label") ?? null,
    activeText: document.activeElement?.textContent?.trim() ?? null,
    saveStatus: liveTexts.at(-1) ?? "",
    preferences: readPersistedPreferences(),
    counters: readSettingsCounters(),
    routeCalls: [...(window.__HIMU_SETTINGS_ROUTE_CALLS__ ?? [])],
  };
}

function playerSnapshot(): SettingsSnapshot {
  const scroll = testElement("player-content-scroll");
  if (!scroll) throw new Error("Missing production element: player-content-scroll");
  const nudge = testElement("post-track-preference-nudge");
  const nudgeStyle = nudge ? getComputedStyle(nudge) : null;
  const controls = controlSnapshots(scroll);

  return {
    route: "/player",
    documentLanguage: document.documentElement.lang,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    playerScrollRect: rect(scroll),
    nudgeVisible: !!nudge,
    nudgeRect: rect(nudge),
    nudgePosition: nudgeStyle?.position ?? null,
    playbackControlRects: controls,
    counters: readSettingsCounters(),
    routeCalls: [...(window.__HIMU_SETTINGS_ROUTE_CALLS__ ?? [])],
  };
}

const query = new URLSearchParams(window.location.search);
const requestedLocale = query.get("locale") === "es" ? "es" : "en";
prepareSettingsBrowserFixture(requestedLocale, query.get("reset") === "1");
void i18n.changeLanguage(requestedLocale);
window.__HIMU_SETTINGS_ROUTE_CALLS__ = [];

const route = window.location.pathname as RouteName;
if (route !== "/preferences" && route !== "/player") {
  throw new Error(`Unsupported settings browser route: ${route}`);
}

if (route === "/player") {
  const track = {
    id: "track-first",
    title: "Luminous Cartography",
    artist: "Night Cartographer",
    audio_url: "https://browser-fixture.invalid/track-first.mp3",
    album_art_url: null,
    duration: 180,
  };
  usePlayerStore.getState().setNowPlaying(track, [track], 0);
  usePlayerStore.getState().setProgress(24, 180);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function SettingsBrowserApp() {
  useEffect(() => {
    window.__HIMU_SETTINGS_READ__ = () =>
      route === "/preferences" ? preferenceSnapshot() : playerSnapshot();
    window.__HIMU_SETTINGS_SET_NUDGE__ = setExperienceStatus;
    window.__HIMU_SETTINGS_READY__ = true;
  }, []);

  return (
    <LocaleProvider>
      {route === "/preferences" ? <MusicPreferencesScreen /> : <PlayerScreen />}
      <ConfirmDialogHost />
    </LocaleProvider>
  );
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing browser fixture root");

createRoot(root).render(
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }}
  >
    <QueryClientProvider client={queryClient}>
      <SettingsBrowserApp />
    </QueryClientProvider>
  </SafeAreaProvider>,
);
