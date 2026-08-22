import "../../../src/theme";
import "../../../src/i18n";

import { useEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CreateDJScreen from "../../create-dj";
import TrainDJScreen from "../../train-dj/[id]";
import { LocaleContext } from "../../../src/i18n/use-locale";

type WorkflowSnapshot = {
  viewportWidth: number;
  contentDirection: string;
  railDisplay: string;
  reviewPosition: string;
  name: string;
  identityConcept: string;
  candidateCount: number;
  visibilitySummary: string;
  finalActionCount: number;
  finalActionDisabled: boolean;
  createCalls: number;
  trainContentDirection: string;
  trainRailDisplay: string;
  trainReviewPosition: string;
  trainName: string;
  trainReviewSummary: string;
  trainFinalActionCount: number;
  trainFinalActionDisabled: boolean;
  updateCalls: number;
};

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_CREATE_CALLS__?: number;
    __HIMU_UPDATE_CALLS__?: number;
    __HIMU_INITIAL_FINAL_DISABLED__?: boolean;
    __HIMU_WORKFLOW_READ__?: () => WorkflowSnapshot;
    __HIMU_WORKFLOW_READY__?: boolean;
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

function buttonByText(text: string): HTMLElement {
  const element = Array.from(
    document.querySelectorAll<HTMLElement>('[role="button"]'),
  ).find((candidate) => candidate.textContent?.trim() === text);
  if (!element) throw new Error(`Missing production button: ${text}`);
  return element;
}

function testElement(testID: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-testid="${testID}"]`,
  );
  if (!element) throw new Error(`Missing production element: ${testID}`);
  return element;
}

function testElements(testID: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-testid="${testID}"]`),
  );
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

function BrowserWorkflowProbe() {
  useEffect(() => {
    const driveWorkflow = async () => {
      const finalAction = elementByLabel("Bring my DJ to life");
      window.__HIMU_INITIAL_FINAL_DISABLED__ = isDisabled(finalAction);

      elementByLabel("Chill & Ambient").click();
      await waitFor(
        () => elementsByLabel("Ambient").length === 1,
        "Ambient trait did not become available",
      );
      elementByLabel("Ambient").click();
      elementByLabel("Calm").click();
      await waitFor(
        () => elementsByLabel("Focus").length === 1,
        "Focus trait did not become available",
      );
      elementByLabel("Focus").click();

      await waitFor(
        () => document.querySelectorAll('[role="radio"]').length === 3,
        "Exactly three production identity candidates were not rendered",
      );
      elementByLabel("Write my own").click();
      setInput("DJ name", "Night Cartographer");
      setInput(
        "Identity concept",
        "A custom navigator mapping patient rhythms into luminous shared journeys.",
      );
      await waitFor(
        () => !isDisabled(elementByLabel("Confirm this identity")),
        "Production identity validation did not enable confirmation",
      );
      elementByLabel("Confirm this identity").click();
      buttonByText("PUBLIC").click();
      await waitFor(
        () => !isDisabled(finalAction),
        "Production traits and identity validation did not enable the final action",
      );

      window.__HIMU_WORKFLOW_READ__ = () => {
        const [content, trainContent] = testElements("responsive-form-content");
        const [rail, trainRail] = testElements("form-step-rail");
        const [review, trainReview] = testElements("sticky-review-panel");
        const name = elementByLabel("DJ name") as HTMLInputElement;
        const identityConcept = elementByLabel(
          "Identity concept",
        ) as HTMLInputElement;
        const finalActions = elementsByLabel("Bring my DJ to life");
        const trainName = document.querySelector<HTMLInputElement>(
          'input[placeholder="e.g. Lumen"]',
        );
        const trainFinalActions = elementsByLabel("Save changes");

        if (
          !content ||
          !trainContent ||
          !rail ||
          !trainRail ||
          !review ||
          !trainReview
        ) {
          throw new Error("Both production responsive workflow shells must be mounted");
        }

        return {
          viewportWidth: window.innerWidth,
          contentDirection: getComputedStyle(content).flexDirection,
          railDisplay: getComputedStyle(rail).display,
          reviewPosition: getComputedStyle(review).position,
          name: name.value,
          identityConcept: identityConcept.value,
          candidateCount: document.querySelectorAll('[role="radio"]').length,
          visibilitySummary: testElement(
            "create-dj-visibility-summary",
          ).textContent ?? "",
          finalActionCount: finalActions.length,
          finalActionDisabled: isDisabled(finalActions[0]),
          createCalls: window.__HIMU_CREATE_CALLS__ ?? 0,
          trainContentDirection: getComputedStyle(trainContent).flexDirection,
          trainRailDisplay: getComputedStyle(trainRail).display,
          trainReviewPosition: getComputedStyle(trainReview).position,
          trainName: trainName?.value ?? "",
          trainReviewSummary: testElement("train-dj-review").textContent ?? "",
          trainFinalActionCount: trainFinalActions.length,
          trainFinalActionDisabled: isDisabled(trainFinalActions[0]),
          updateCalls: window.__HIMU_UPDATE_CALLS__ ?? 0,
        };
      };
      window.__HIMU_WORKFLOW_READY__ = true;
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
      <CreateDJScreen />
      <TrainDJScreen />
      <BrowserWorkflowProbe />
    </LocaleContext.Provider>
  </SafeAreaProvider>,
);
