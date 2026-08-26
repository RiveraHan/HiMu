import "../../src/theme";
import "../../src/i18n";

import { useEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import WelcomeScreen from "../../app/welcome";
import i18n from "../../src/i18n";

type RectSnapshot = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type IntroSnapshot = {
  viewportWidth: number;
  viewportHeight: number;
  documentScrollWidth: number;
  primaryCtaCount: number;
  primaryRect: RectSnapshot;
  primaryFocusable: boolean;
  fixedObstructionCount: number;
  dialogCount: number;
  contentBeforeActions: boolean;
  currentStep: number;
  visibleHeading: string;
  focusedTestId: string | null;
  actionOrder: string[];
  progress: { min: number; max: number; now: number; text: string };
};

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_PUBLIC_INTRO_READY__?: boolean;
    __HIMU_PUBLIC_INTRO_READ__?: () => IntroSnapshot;
  }
}

function testElement(testID: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  if (!element) throw new Error(`Missing production element: ${testID}`);
  return element;
}

function rect(element: Element): RectSnapshot {
  const value = element.getBoundingClientRect();
  return {
    top: value.top,
    right: value.right,
    bottom: value.bottom,
    left: value.left,
    width: value.width,
    height: value.height,
  };
}

function precedes(left: Node, right: Node) {
  return Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function intersects(left: DOMRect, right: DOMRect) {
  return !(
    left.right <= right.left ||
    left.left >= right.right ||
    left.bottom <= right.top ||
    left.top >= right.bottom
  );
}

function readIntro(): IntroSnapshot {
  const primaryActions = Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="public-intro-primary-action"]'),
  );
  const primary = primaryActions[0];
  if (!primary) throw new Error("Missing production primary action");
  const progress = testElement("public-intro-progress");
  const heading = testElement("public-intro-heading");
  const body = testElement("public-intro-body");
  const actions = testElement("public-intro-actions");
  const actionElements = Array.from(actions.querySelectorAll<HTMLElement>('[role="button"]'));
  const primaryBounds = primary.getBoundingClientRect();
  const fixedObstructionCount = Array.from(document.querySelectorAll<HTMLElement>("body *"))
    .filter((element) => {
      if (element === primary || element.contains(primary) || primary.contains(element)) return false;
      return (
        getComputedStyle(element).position === "fixed" &&
        intersects(primaryBounds, element.getBoundingClientRect())
      );
    }).length;
  const active = document.activeElement as HTMLElement | null;
  const progressText = progress.getAttribute("aria-valuetext") ?? progress.textContent ?? "";

  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    primaryCtaCount: primaryActions.length,
    primaryRect: rect(primary),
    primaryFocusable:
      primary.tabIndex >= 0 &&
      primary.getAttribute("aria-disabled") !== "true" &&
      !(primary as HTMLButtonElement).disabled,
    fixedObstructionCount,
    dialogCount: document.querySelectorAll('[role="dialog"], [aria-modal="true"]').length,
    contentBeforeActions:
      precedes(progress, actions) &&
      precedes(heading, actions) &&
      precedes(body, actions) &&
      actionElements.every((action) => precedes(body, action)),
    currentStep: Number(progress.getAttribute("aria-valuenow")),
    visibleHeading: heading.getAttribute("aria-label") ?? heading.textContent ?? "",
    focusedTestId: active?.dataset.testid ?? null,
    actionOrder: actionElements.map(
      (element) => element.getAttribute("aria-label") ?? element.textContent ?? "",
    ),
    progress: {
      min: Number(progress.getAttribute("aria-valuemin")),
      max: Number(progress.getAttribute("aria-valuemax")),
      now: Number(progress.getAttribute("aria-valuenow")),
      text: progressText,
    },
  };
}

function BrowserProbe() {
  useEffect(() => {
    window.__HIMU_PUBLIC_INTRO_READ__ = readIntro;
    window.__HIMU_PUBLIC_INTRO_READY__ = true;
    return () => {
      window.__HIMU_PUBLIC_INTRO_READY__ = false;
      delete window.__HIMU_PUBLIC_INTRO_READ__;
    };
  }, []);
  return null;
}

async function start() {
  const requestedLocale = new URLSearchParams(window.location.search).get("locale");
  if (requestedLocale === "en" || requestedLocale === "es") {
    window.sessionStorage.setItem("himu-browser-locale", requestedLocale);
  }
  const locale = window.sessionStorage.getItem("himu-browser-locale") === "es" ? "es" : "en";
  await i18n.changeLanguage(locale);

  const root = document.querySelector("#root");
  if (!root) throw new Error("Missing browser fixture root");
  createRoot(root).render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <WelcomeScreen />
      <BrowserProbe />
    </SafeAreaProvider>,
  );
}

void start().catch((error: unknown) => {
  window.__HIMU_BROWSER_ERROR__ =
    error instanceof Error ? error.stack ?? error.message : String(error);
});
