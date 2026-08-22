import "../../src/theme";
import "../../src/i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AccountSettingsScreen from "../../app/account-settings";
import MusicPreferencesScreen from "../../app/preferences";
import { ConfirmDialogHost } from "../../src/components/ConfirmDialog";
import { LocaleProvider } from "../../src/i18n/LocaleProvider";
import {
  readPersistedPreferences,
  readRemoteLanguagePreference,
  readSettingsCounters,
} from "./settings-browser-hooks";

type RouteName = "/preferences" | "/account-settings";

type SettingsSnapshot = {
  route: RouteName;
  viewportWidth: number;
  viewportHeight: number;
  direction: string;
  wrap: string;
  itemWidth: number;
  zoneOrder: string[];
  focusLabels: string[];
  preferenceGenres: string[];
  ambientSelected: boolean;
  languageValue: string | null;
  languageDisabled: boolean;
  languageLabelFontFamily: string | null;
  languageSelectFontFamily: string | null;
  legalLabels: string[];
  legalMissingVisible: boolean;
  languagePreference: string | null;
  languageSaveErrorVisible: boolean;
  remoteLanguagePreference: string;
  storedLanguageState: string | null;
  hasRouteTitle: boolean;
  counters: Record<string, number>;
};

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_SETTINGS_READY__?: boolean;
    __HIMU_SETTINGS_READ__?: () => SettingsSnapshot;
    __HIMU_SETTINGS_COUNTERS__?: Record<string, number>;
  }
}

function testElement(testID: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-testid="${testID}"]`,
  );
  if (!element) throw new Error(`Missing production element: ${testID}`);
  return element;
}

function elementsByLabel(label: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[aria-label]"))
    .filter((element) => element.getAttribute("aria-label") === label);
}

function focusLabels() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'input, select, textarea, [role="button"], [role="link"], [role="slider"]',
    ),
  )
    .filter(
      (element) =>
        element.tabIndex >= 0 && element.getAttribute("aria-disabled") !== "true",
    )
    .map((element) => element.getAttribute("aria-label"))
    .filter((label): label is string => label !== null);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function SettingsBrowserApp() {
  const route = window.location.pathname as RouteName;
  if (route !== "/preferences" && route !== "/account-settings") {
    throw new Error(`Unsupported settings browser route: ${route}`);
  }

  useEffect(() => {
    window.__HIMU_SETTINGS_READ__ = () => {
      const activeRoute = window.location.pathname as RouteName;
      const grid = testElement(
        activeRoute === "/preferences"
          ? "preferences-settings-grid"
          : "account-settings-grid",
      );
      const firstItem = grid.firstElementChild as HTMLElement | null;
      if (!firstItem) throw new Error("Settings grid has no production zones");
      const language = elementsByLabel("Language")[0];
      const languageSelect = document.querySelector<HTMLSelectElement>(
        '[data-testid="language-preference-select"]',
      );
      const languageLabel = document.querySelector<HTMLElement>(
        'label[for="himu-language-preference"]',
      );
      const ambient = elementsByLabel("Ambient")[0];
      const legalLabels = Array.from(
        document.querySelectorAll<HTMLElement>('[role="link"][aria-label]'),
      ).map((element) => element.getAttribute("aria-label") ?? "");

      return {
        route: activeRoute,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        direction: getComputedStyle(grid).flexDirection,
        wrap: getComputedStyle(grid).flexWrap,
        itemWidth: firstItem.getBoundingClientRect().width,
        zoneOrder: Array.from(grid.children).map(
          (element) => element.getAttribute("data-testid") ?? "",
        ),
        focusLabels: focusLabels(),
        preferenceGenres: [...readPersistedPreferences().genres],
        ambientSelected:
          ambient?.getAttribute("aria-selected") === "true" ||
          ambient?.querySelector("svg") !== null,
        languageValue:
          languageSelect?.selectedOptions[0]?.textContent?.trim() ??
          language?.textContent?.replace(/\s+/g, " ").trim() ??
          null,
        languageDisabled:
          languageSelect?.disabled ??
          language?.getAttribute("aria-disabled") === "true",
        languageLabelFontFamily: languageLabel
          ? getComputedStyle(languageLabel).fontFamily
          : null,
        languageSelectFontFamily: languageSelect
          ? getComputedStyle(languageSelect).fontFamily
          : null,
        legalLabels,
        legalMissingVisible:
          document.body.textContent?.includes("Legal links are unavailable") ?? false,
        languagePreference: languageSelect?.value ?? null,
        languageSaveErrorVisible:
          document.querySelector('[role="alert"]')?.textContent?.includes(
            "couldn't sync your preference",
          ) ?? false,
        remoteLanguagePreference: readRemoteLanguagePreference(),
        storedLanguageState: window.localStorage.getItem(
          "himu.language.browser-listener",
        ),
        hasRouteTitle:
          activeRoute === "/preferences"
            ? document.body.textContent?.includes("Music Preferences") ?? false
            : document.body.textContent?.includes("Settings") ?? false,
        counters: readSettingsCounters(),
      };
    };
    window.__HIMU_SETTINGS_READY__ = true;
  }, []);

  return (
    <LocaleProvider>
      {route === "/preferences" ? (
        <MusicPreferencesScreen />
      ) : (
        <AccountSettingsScreen />
      )}
      <ConfirmDialogHost />
    </LocaleProvider>
  );
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing browser fixture root");

createRoot(root).render(
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }}
  >
    <QueryClientProvider client={queryClient}>
      <SettingsBrowserApp />
    </QueryClientProvider>
  </SafeAreaProvider>,
);
