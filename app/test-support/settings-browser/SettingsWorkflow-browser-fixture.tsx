import "../../../src/theme";
import "../../../src/i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AccountSettingsScreen from "../../account-settings";
import MusicPreferencesScreen from "../../preferences";
import { ConfirmDialogHost } from "../../../src/components/ConfirmDialog";
import { LocaleContext } from "../../../src/i18n/use-locale";
import type { LanguagePreference } from "../../../src/i18n/types";
import {
  readPersistedPreferences,
  readSettingsCounters,
} from "./settings-browser-hooks";

type RouteName = "preferences" | "account";

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
  legalLabels: string[];
  legalMissingVisible: boolean;
  counters: Record<string, number>;
};

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_SETTINGS_READY__?: boolean;
    __HIMU_SETTINGS_ROUTE__?: (route: RouteName) => void;
    __HIMU_SETTINGS_SET_LOCALE_SAVING__?: (saving: boolean) => void;
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
      'input, textarea, [role="button"], [role="link"], [role="slider"]',
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
  const [route, setRoute] = useState<RouteName>("preferences");
  const [preference, setPreference] = useState<LanguagePreference>("system");
  const [localeSaving, setLocaleSaving] = useState(false);
  const locale = useMemo(
    () => ({
      preference,
      resolvedLanguage: "en" as const,
      setPreference: async (next: LanguagePreference) => {
        setLocaleSaving(true);
        setPreference(next);
        await Promise.resolve();
        setLocaleSaving(false);
      },
      isSaving: localeSaving,
    }),
    [localeSaving, preference],
  );

  useEffect(() => {
    window.__HIMU_SETTINGS_ROUTE__ = setRoute;
    window.__HIMU_SETTINGS_SET_LOCALE_SAVING__ = setLocaleSaving;
    window.__HIMU_SETTINGS_READ__ = () => {
      const activeRoute: RouteName = document.querySelector(
        '[data-testid="preferences-settings-grid"]',
      )
        ? "preferences"
        : "account";
      const grid = testElement(
        activeRoute === "preferences"
          ? "preferences-settings-grid"
          : "account-settings-grid",
      );
      const firstItem = grid.firstElementChild as HTMLElement | null;
      if (!firstItem) throw new Error("Settings grid has no production zones");
      const language = elementsByLabel("Language")[0];
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
        languageValue: language?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        languageDisabled: language?.getAttribute("aria-disabled") === "true",
        legalLabels,
        legalMissingVisible:
          document.body.textContent?.includes("Legal links are unavailable") ?? false,
        counters: readSettingsCounters(),
      };
    };
    window.__HIMU_SETTINGS_READY__ = true;
  }, []);

  return (
    <LocaleContext.Provider value={locale}>
      {route === "preferences" ? (
        <MusicPreferencesScreen />
      ) : (
        <AccountSettingsScreen />
      )}
      <ConfirmDialogHost />
    </LocaleContext.Provider>
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
