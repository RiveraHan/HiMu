import "../../src/theme";
import i18n from "../../src/i18n";

import { useEffect, useState } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { ScrollView, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Button } from "../../src/components/Button";
import { PlayerDesktopLayout, PlayerDesktopLayoutSlot } from "../../src/components/player/PlayerDesktopLayout";
import { ProgressiveCatalogPicker } from "../../src/components/preferences/ProgressiveCatalogPicker";
import { ResponsiveFormShell } from "../../src/components/forms/ResponsiveFormShell";
import { ScreenCanvas } from "../../src/components/ScreenCanvas";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { StateNotice } from "../../src/components/StateNotice";
import { Text } from "../../src/components/Text";
import { StyleSheet } from "../../src/theme/react-native-unistyles";

type SurfaceName = "activation" | "primary";

type Rect = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}>;

declare global {
  interface Window {
    __HIMU_BROWSER_ERROR__?: string;
    __HIMU_BETA_VISUAL_READY__?: boolean;
    __HIMU_BETA_VISUAL_READ__?: () => Record<string, unknown>;
  }
}

const route = window.location.pathname.slice(1) as SurfaceName;
if (route !== "activation" && route !== "primary") {
  throw new Error(`Unsupported beta visual fixture route: ${window.location.pathname}`);
}

void i18n.changeLanguage("en");

const genreGroups = [
  { label: "Electronic", items: ["Ambient", "House"] },
] as const;
const steps = [
  { id: "sound", label: "Sound" },
  { id: "identity", label: "Identity" },
  { id: "review", label: "Review" },
] as const;

function rect(element: Element | null): Rect | null {
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

function testElement(testID: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  if (!element) throw new Error(`Missing production element: ${testID}`);
  return element;
}

function label(element: Element | null) {
  return element?.getAttribute("aria-label") ?? element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function isVisible(element: HTMLElement) {
  const value = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return value.display !== "none" && value.visibility !== "hidden" && box.width > 0 && box.height > 0;
}

function orderedNames(entries: Array<readonly [string, Element]>) {
  return [...entries]
    .sort(([, left], [, right]) =>
      left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    .map(([name]) => name);
}

function readDialog() {
  const dialog = document.querySelector<HTMLElement>('[data-testid="catalog-picker-dialog"]');
  if (!dialog) return null;
  const title = dialog.querySelector("h2");
  const done = Array.from(dialog.querySelectorAll("button")).find((element) => label(element) === "Done");
  const search = dialog.querySelector("input");
  const option = dialog.querySelector('[role="button"]:not(button), [role="checkbox"]');
  if (!title || !done || !search || !option) {
    throw new Error("Production catalog dialog is missing title, done, search, or option content");
  }
  const dialogRect = rect(dialog)!;
  return {
    rect: dialogRect,
    bounded:
      dialogRect.left >= 0 &&
      dialogRect.top >= 0 &&
      dialogRect.right <= window.innerWidth + 1 &&
      dialogRect.bottom <= window.innerHeight + 1,
    sourceOrder: orderedNames([
      ["title", title],
      ["done", done],
      ["search", search],
      ["options", option],
    ]),
    activeLabel: label(document.activeElement),
    controls: Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter(isVisible).map(label),
  };
}

function readSurface() {
  const header = testElement("screen-header");
  const content = testElement("beta-visual-content");
  const state = testElement("beta-visual-state");
  const action = testElement("beta-visual-primary-action");
  const scroll = testElement(route === "activation" ? "responsive-form-scroll-view" : "beta-visual-scroll");
  const actionRect = rect(action)!;
  const scrollRect = rect(scroll)!;
  return {
    name: route,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    primaryActionVisible: isVisible(action),
    primaryActionReachable:
      actionRect.top >= scrollRect.top - 1 && actionRect.bottom <= scrollRect.bottom + 1,
    activeLabel: label(document.activeElement),
    sourceOrder: orderedNames([
      ["header", header],
      ["content", content],
      ["state", state],
      ["action", action],
    ]),
    controls: Array.from(
      document.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter(isVisible).map(label),
    actionRect,
    scrollRect,
    dialog: readDialog(),
  };
}

function VisualCatalogPicker() {
  const [selected, setSelected] = useState(["Ambient"]);
  return (
    <ProgressiveCatalogPicker
      title="Genres"
      editLabel="Edit genres"
      groups={genreGroups}
      selected={selected}
      min={0}
      max={3}
      getGroupLabel={(value) => value}
      getItemLabel={(value) => value}
      onChange={(next) => setSelected(next)}
    />
  );
}

function ActivationSurface() {
  return (
    <ResponsiveFormShell
      title="Create your track"
      description="Shape the sound, review the result, and keep every action reachable."
      steps={steps}
      activeStep="sound"
      form={
        <View testID="beta-visual-content" style={styles.stack}>
          <VisualCatalogPicker />
          {Array.from({ length: 6 }, (_, index) => (
            <Text key={index} variant="bodyMd">{`Sound detail ${index + 1}`}</Text>
          ))}
          <StateNotice
            testID="beta-visual-state"
            kind="error"
            title="Check the sound"
            message="You can retry without losing your choices."
            actionLabel="Retry"
            onAction={() => undefined}
          />
        </View>
      }
      review={<Text variant="bodyMd">Your track remains private until you choose otherwise.</Text>}
      footer={<Button testID="beta-visual-primary-action" label="Continue" onPress={() => undefined} />}
    />
  );
}

function PrimarySurface() {
  return (
    <ScrollView testID="beta-visual-scroll" contentContainerStyle={styles.scrollContent}>
      <ScreenCanvas
        variant="wide"
        actions={<Button testID="beta-visual-primary-action" label="Continue" onPress={() => undefined} />}
        style={styles.canvas}
      >
        <ScreenHeader
          title="Library"
          subtitle="Your saved music and current listening state."
          onLeftPress={() => undefined}
        />
        <View testID="beta-visual-content" style={styles.stack}>
          <PlayerDesktopLayout>
            <PlayerDesktopLayoutSlot slot="artwork">
              <View style={styles.artwork}><Text variant="h2">Current track</Text></View>
            </PlayerDesktopLayoutSlot>
            <PlayerDesktopLayoutSlot slot="playback">
              <View style={styles.stack}>
                <Text variant="h2">Luminous Cartography</Text>
                <VisualCatalogPicker />
              </View>
            </PlayerDesktopLayoutSlot>
          </PlayerDesktopLayout>
        </View>
        <StateNotice
          testID="beta-visual-state"
          kind="offline"
          title="Library is offline"
          message="Saved music stays available."
          actionLabel="Retry"
          onAction={() => undefined}
        />
      </ScreenCanvas>
    </ScrollView>
  );
}

function BrowserApp() {
  useEffect(() => {
    window.__HIMU_BETA_VISUAL_READ__ = readSurface;
    window.__HIMU_BETA_VISUAL_READY__ = true;
  }, []);
  return route === "activation" ? <ActivationSurface /> : <PrimarySurface />;
}

const styles = StyleSheet.create((theme) => ({
  stack: { gap: theme.spacing.stackMd, minWidth: 0 },
  scrollContent: { flexGrow: 1 },
  canvas: {
    gap: theme.spacing.stackLg,
    paddingTop: theme.spacing.stackMd,
    paddingBottom: theme.spacing.stackLg,
  },
  artwork: {
    minHeight: 180,
    minWidth: 0,
    justifyContent: "center",
    padding: theme.spacing.cardPadding,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceContainer,
  },
}));

const root = document.querySelector("#root");
if (!root) throw new Error("Missing beta visual browser root");

createRoot(root).render(
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }}
  >
    <BrowserApp />
  </SafeAreaProvider>,
);
