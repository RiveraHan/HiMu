import "../../src/theme";
import "../../src/i18n";

import { useEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CreateDJScreen from "../../app/create-dj";
import TrainDJScreen from "../../app/train-dj/[id]";
import i18n from "../../src/i18n";
import { LocaleContext } from "../../src/i18n/use-locale";
import type { SupportedLanguage } from "../../src/i18n/types";

type RectSnapshot = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type TargetSnapshot = RectSnapshot & {
  label: string;
  role: string;
  disabled: boolean;
  focusable: boolean;
};

type WorkflowSnapshot = {
  flow: "create" | "train";
  locale: SupportedLanguage;
  viewportWidth: number;
  viewportHeight: number;
  documentClientWidth: number;
  documentScrollWidth: number;
  maxContentScrollWidth: number;
  contentMode: string;
  lowHeight: boolean | null;
  contentDirection: string | null;
  railDisplay: string | null;
  reviewPosition: string | null;
  activeStep: number | null;
  activeStepLabel: string | null;
  activeEditorCount: number;
  candidateCount: number;
  identityRequestCount: number;
  actionCount: number;
  actionDisabled: boolean | null;
  actionRect: RectSnapshot | null;
  dialogCount: number;
  dialogFocus: string | null;
  selectedValues: string[];
  reviewText: string;
  createCalls: number;
  updateCalls: number;
  updateInput: unknown;
  targetRects: TargetSnapshot[];
  routeStep: string | null;
  setParamsCalls: number;
  pushCalls: number;
};

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_CREATE_CALLS__?: number;
    __HIMU_IDENTITY_REQUESTS__?: number;
    __HIMU_ROUTER_SET_PARAMS_COUNT__?: number;
    __HIMU_ROUTER_PUSH_COUNT__?: number;
    __HIMU_UPDATE_CALLS__?: number;
    __HIMU_UPDATE_INPUT__?: unknown;
    __HIMU_WORKFLOW_READ__?: () => WorkflowSnapshot;
    __HIMU_WORKFLOW_READY__?: boolean;
  }
}

function testElement(testID: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
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

function label(element: HTMLElement): string {
  return (
    element.getAttribute("aria-label") ??
    element.getAttribute("placeholder") ??
    element.textContent?.trim() ??
    ""
  );
}

function isDisabled(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-disabled") === "true" ||
    (element as HTMLButtonElement).disabled === true
  );
}

function visible(element: HTMLElement): boolean {
  const bounds = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    bounds.width > 0 &&
    bounds.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

function targetRects(): TargetSnapshot[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="button"], [role="checkbox"], [role="radio"], input, textarea, button',
    ),
  )
    .filter(visible)
    .map((element) => ({
      ...rect(element),
      label: label(element),
      role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
      disabled: isDisabled(element),
      focusable: element.tabIndex >= 0,
    }));
}

function readWorkflow(
  flow: "create" | "train",
  locale: SupportedLanguage,
): WorkflowSnapshot {
  const layout = document.querySelector<HTMLElement>(
    '[id^="create-dj-layout-"]',
  );
  const content = testElement("responsive-form-content");
  const rail = testElement("form-step-rail");
  const review = flow === "create"
    ? testElement("create-dj-review")
    : testElement("sticky-review-panel");
  const actionContainer = testElement("responsive-form-footer");
  const actions = flow === "create"
    ? Array.from(document.querySelectorAll<HTMLElement>(
        '[data-testid="create-dj-sound-action"], [data-testid="create-dj-identity-action"], [data-testid="create-dj-submit"]',
      )).filter(visible)
    : actionContainer
      ? Array.from(actionContainer.querySelectorAll<HTMLElement>('[role="button"]')).filter(visible)
      : [];
  const progress = document.querySelector<HTMLElement>('[role="progressbar"]');
  const progressCurrent = progress?.getAttribute("aria-valuenow") ??
    progress?.getAttribute("aria-label")?.match(/\d+/)?.[0] ??
    progress?.textContent?.match(/\d+/)?.[0] ??
    null;
  const selectedStep = Array.from(
    document.querySelectorAll<HTMLElement>('[role="button"][aria-selected="true"]'),
  )[0];
  const selectedValues = Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="catalog-picker-selection"]'),
  ).map((element) => element.getAttribute("aria-label") ?? "");
  const active = document.activeElement as HTMLElement | null;
  const allElements = Array.from(document.querySelectorAll<HTMLElement>("body *"));

  return {
    flow,
    locale,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    maxContentScrollWidth: allElements.reduce(
      (maximum, element) => Math.max(maximum, element.scrollWidth),
      0,
    ),
    contentMode: layout?.dataset.contentMode ??
      layout?.id.replace("create-dj-layout-", "") ??
      (content ? getComputedStyle(content).flexDirection : "unknown"),
    lowHeight: layout?.dataset.lowHeight === undefined
      ? null
      : layout.dataset.lowHeight === "true",
    contentDirection: content ? getComputedStyle(content).flexDirection : null,
    railDisplay: rail ? getComputedStyle(rail).display : null,
    reviewPosition: review ? getComputedStyle(review).position : null,
    activeStep: progressCurrent === null ? null : Number(progressCurrent),
    activeStepLabel: selectedStep ? label(selectedStep) : null,
    activeEditorCount: flow === "create"
      ? document.querySelectorAll('[data-testid="create-dj-active-editor"]').length
      : document.querySelectorAll('[data-testid="responsive-form-editor"]').length,
    candidateCount: document.querySelectorAll('[role="radio"][aria-label*=". "]').length,
    identityRequestCount: window.__HIMU_IDENTITY_REQUESTS__ ?? 0,
    actionCount: actions.length,
    actionDisabled: actions[0] ? isDisabled(actions[0]) : null,
    actionRect: actions[0] ? rect(actions[0]) : null,
    dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
    dialogFocus: active ? label(active) : null,
    selectedValues,
    reviewText: review?.textContent ?? "",
    createCalls: window.__HIMU_CREATE_CALLS__ ?? 0,
    updateCalls: window.__HIMU_UPDATE_CALLS__ ?? 0,
    updateInput: window.__HIMU_UPDATE_INPUT__ ?? null,
    targetRects: targetRects(),
    routeStep: new URLSearchParams(window.location.search).get("step"),
    setParamsCalls: window.__HIMU_ROUTER_SET_PARAMS_COUNT__ ?? 0,
    pushCalls: window.__HIMU_ROUTER_PUSH_COUNT__ ?? 0,
  };
}

function BrowserWorkflowProbe({
  flow,
  locale,
}: {
  flow: "create" | "train";
  locale: SupportedLanguage;
}) {
  useEffect(() => {
    window.__HIMU_WORKFLOW_READ__ = () => readWorkflow(flow, locale);
    window.__HIMU_WORKFLOW_READY__ = true;
    return () => {
      window.__HIMU_WORKFLOW_READY__ = false;
      delete window.__HIMU_WORKFLOW_READ__;
    };
  }, [flow, locale]);
  return null;
}

async function start() {
  const params = new URLSearchParams(window.location.search);
  const locale: SupportedLanguage = params.get("locale") === "es" ? "es" : "en";
  const flow = params.get("flow") === "train" ? "train" : "create";
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
      <LocaleContext.Provider
        value={{
          preference: locale,
          resolvedLanguage: locale,
          setPreference: async () => undefined,
          isSaving: false,
        }}
      >
        {flow === "create" ? <CreateDJScreen /> : <TrainDJScreen />}
        <BrowserWorkflowProbe flow={flow} locale={locale} />
      </LocaleContext.Provider>
    </SafeAreaProvider>,
  );
}

void start().catch((error: unknown) => {
  window.__HIMU_BROWSER_ERROR__ =
    error instanceof Error ? error.stack ?? error.message : String(error);
});
