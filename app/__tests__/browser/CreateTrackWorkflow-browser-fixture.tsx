import "../../../src/theme";
import "../../../src/i18n";

import { useEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CreateTrackScreen from "../../create-track";
import { LocaleContext } from "../../../src/i18n/use-locale";
import { privateSourceLyrics } from "./create-track-browser-hooks";

type WorkflowSnapshot = {
  viewportWidth: number;
  phase: "draft" | "confirmed";
  contentDirection: string;
  railDisplay: string;
  reviewPosition: string;
  title: string | null;
  direction: string | null;
  lyricsLength: number | null;
  reviewText: string;
  finalActionCount: number;
  generateCalls: number;
  focusLabels: string[];
};

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_GENERATE_CALLS__?: number;
    __HIMU_PRIVATE_SEED_PRESERVED__?: boolean;
    __HIMU_TRACK_WORKFLOW_READ__?: () => WorkflowSnapshot;
    __HIMU_TRACK_WORKFLOW_REVIEW__?: () => Promise<void>;
    __HIMU_TRACK_WORKFLOW_READY__?: boolean;
  }
}

function elementsByLabel(label: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[aria-label]"))
    .filter((element) => element.getAttribute("aria-label") === label);
}

function elementByLabel(label: string): HTMLElement {
  const element = elementsByLabel(label)[0];
  if (!element) throw new Error(`Missing production control: ${label}`);
  return element;
}

function testElement(testID: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-testid="${testID}"]`,
  );
  if (!element) throw new Error(`Missing production element: ${testID}`);
  return element;
}

function setInput(label: string, value: string) {
  const input = elementByLabel(label) as HTMLInputElement | HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )?.set;
  if (!setter) throw new Error("Browser input value setter is unavailable");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function waitFor(check: () => boolean, message: string) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > 5000) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function isDisabled(element: HTMLElement): boolean {
  return element.getAttribute("aria-disabled") === "true";
}

function focusLabels() {
  return Array.from(document.querySelectorAll<HTMLElement>(
    'input, textarea, [role="button"]',
  ))
    .filter((element) => element.tabIndex >= 0 && !isDisabled(element))
    .map((element) => element.getAttribute("aria-label"))
    .filter((label): label is string => label != null);
}

const lyricSuffix = "\n[Chorus]\nRise with me";
const lyricBodyLength = 1000 - "[Verse]\n".length - lyricSuffix.length;
const boundaryLyrics =
  "[Verse]\n" +
  "private light ".repeat(Math.ceil(lyricBodyLength / 14)).slice(0, lyricBodyLength) +
  lyricSuffix;

function BrowserWorkflowProbe() {
  useEffect(() => {
    const driveWorkflow = async () => {
      await waitFor(
        () => elementsByLabel("Track title").length === 1,
        "Production track editor did not become ready",
      );
      window.__HIMU_PRIVATE_SEED_PRESERVED__ =
        (elementByLabel("Lyrics") as HTMLTextAreaElement).value === privateSourceLyrics;

      setInput("Track title", "Owner's New Horizon");
      setInput(
        "Creative direction",
        "Build patiently from a private pulse into a bright shared release.",
      );
      setInput("Lyric theme", "a private signal opening toward sunrise");
      setInput("Lyrics", boundaryLyrics);
      await waitFor(
        () =>
          (elementByLabel("Track title") as HTMLInputElement).value ===
            "Owner's New Horizon" &&
          !isDisabled(elementByLabel("Review generation")),
        "Production draft validation did not enable review",
      );

      window.__HIMU_TRACK_WORKFLOW_READ__ = () => {
        const content = testElement("responsive-form-content");
        const rail = testElement("form-step-rail");
        const review = testElement("sticky-review-panel");
        const confirmation = document.querySelector(
          '[data-testid="generation-confirmation"]',
        );
        const title = elementsByLabel("Track title")[0] as HTMLInputElement | undefined;
        const direction = elementsByLabel("Creative direction")[0] as
          | HTMLTextAreaElement
          | undefined;
        const lyrics = elementsByLabel("Lyrics")[0] as HTMLTextAreaElement | undefined;
        const finalActionCount =
          elementsByLabel("Review generation").length +
          elementsByLabel("Confirm and generate").length;

        return {
          viewportWidth: window.innerWidth,
          phase: confirmation ? "confirmed" : "draft",
          contentDirection: getComputedStyle(content).flexDirection,
          railDisplay: getComputedStyle(rail).display,
          reviewPosition: getComputedStyle(review).position,
          title: title?.value ?? null,
          direction: direction?.value ?? null,
          lyricsLength: lyrics?.value.length ?? null,
          reviewText: review.textContent ?? "",
          finalActionCount,
          generateCalls: window.__HIMU_GENERATE_CALLS__ ?? 0,
          focusLabels: focusLabels(),
        };
      };
      window.__HIMU_TRACK_WORKFLOW_REVIEW__ = async () => {
        elementByLabel("Review generation").click();
        await waitFor(
          () => elementsByLabel("Confirm and generate").length === 1,
          "Explicit immutable confirmation did not render",
        );
      };
      window.__HIMU_TRACK_WORKFLOW_READY__ = true;
    };

    void driveWorkflow().catch((error: unknown) => {
      window.__HIMU_BROWSER_ERROR__ =
        error instanceof Error ? error.stack ?? error.message : String(error);
    });
  }, []);

  return null;
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
    <LocaleContext.Provider
      value={{
        preference: "en",
        resolvedLanguage: "en",
        setPreference: async () => undefined,
        isSaving: false,
      }}
    >
      <CreateTrackScreen />
      <BrowserWorkflowProbe />
    </LocaleContext.Provider>
  </SafeAreaProvider>,
);
