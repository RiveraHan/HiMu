import { render } from "@testing-library/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  SettingsDesktopGrid,
  SettingsDesktopGridItem,
} from "../SettingsDesktopGrid";
import { SettingsSection } from "../SettingsSection";
import { resolveLayoutMode } from "@/src/theme/layout";

const { settingsDesktopGridWebCss } = jest.requireActual<
  typeof import("../SettingsDesktopGrid.web")
>("../SettingsDesktopGrid.web");

function resolveSettingsStyle<Compact, Desktop>(
  style: { xs: Compact; xl: Desktop },
  width: number,
): Compact | Desktop {
  return style[resolveLayoutMode(width) === "desktop" ? "xl" : "xs"];
}

describe("SettingsDesktopGrid", () => {
  it("ships a direct desktop CSS breakpoint for the production web boundary", () => {
    expect(settingsDesktopGridWebCss).toContain("@media (min-width: 1024px)");
    expect(settingsDesktopGridWebCss).toContain("flex-direction: column");
    expect(settingsDesktopGridWebCss).toContain("flex-direction: row");
    expect(settingsDesktopGridWebCss).toContain(
      '[data-himu-settings-grid-item="standard"]',
    );
    expect(settingsDesktopGridWebCss).not.toContain("window.innerWidth");
  });

  it("keeps one compact reading and focus order while CSS creates desktop columns", async () => {
    const screen = await render(
      <SettingsDesktopGrid testID="settings-grid">
        <SettingsDesktopGridItem testID="identity">
          <Pressable accessibilityRole="button" accessibilityLabel="Identity">
            <Text>Identity</Text>
          </Pressable>
        </SettingsDesktopGridItem>
        <SettingsDesktopGridItem testID="language">
          <Pressable accessibilityRole="button" accessibilityLabel="Language">
            <Text>Language</Text>
          </Pressable>
        </SettingsDesktopGridItem>
        <SettingsDesktopGridItem testID="session">
          <Pressable accessibilityRole="button" accessibilityLabel="Session">
            <Text>Session</Text>
          </Pressable>
        </SettingsDesktopGridItem>
        <SettingsDesktopGridItem testID="legal">
          <Pressable accessibilityRole="link" accessibilityLabel="Terms">
            <Text>Terms</Text>
          </Pressable>
        </SettingsDesktopGridItem>
        <SettingsDesktopGridItem testID="destructive" size="wide">
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out">
            <Text>Sign out</Text>
          </Pressable>
        </SettingsDesktopGridItem>
      </SettingsDesktopGrid>,
    );

    expect(screen.getByTestId("settings-grid").children).toEqual([
      screen.getByTestId("identity"),
      screen.getByTestId("language"),
      screen.getByTestId("session"),
      screen.getByTestId("legal"),
      screen.getByTestId("destructive"),
    ]);
    expect(screen.getAllByRole("button").map((item) => item.props.accessibilityLabel))
      .toEqual(["Identity", "Language", "Session", "Sign out"]);
    expect(screen.getAllByRole("link").map((item) => item.props.accessibilityLabel))
      .toEqual(["Terms"]);
  });

  it.each([
    [390, "column", "nowrap", "100%", "100%"],
    [720, "column", "nowrap", "100%", "100%"],
    [1024, "row", "wrap", "48%", "100%"],
    [1440, "row", "wrap", "48%", "100%"],
  ] as const)(
    "maps %ipx to grouped settings without a render-time branch",
    async (width, direction, wrap, itemWidth, wideWidth) => {
      const screen = await render(
        <SettingsDesktopGrid testID="settings-grid">
          <SettingsDesktopGridItem testID="standard"><View /></SettingsDesktopGridItem>
          <SettingsDesktopGridItem testID="wide" size="wide"><View /></SettingsDesktopGridItem>
        </SettingsDesktopGrid>,
      );
      const gridStyle = StyleSheet.flatten(screen.getByTestId("settings-grid").props.style);
      const standardStyle = StyleSheet.flatten(screen.getByTestId("standard").props.style);
      const wideStyle = StyleSheet.flatten(screen.getByTestId("wide").props.style);

      expect(resolveSettingsStyle(gridStyle.flexDirection, width)).toBe(direction);
      expect(resolveSettingsStyle(gridStyle.flexWrap, width)).toBe(wrap);
      expect(resolveSettingsStyle(standardStyle.width, width)).toBe(itemWidth);
      expect(resolveSettingsStyle(wideStyle.width, width)).toBe(wideWidth);
      expect(gridStyle.minWidth).toBe(0);
      expect(standardStyle.minWidth).toBe(0);
    },
  );

  it("visually separates the destructive zone without adding another action", async () => {
    const screen = await render(
      <View>
        <SettingsSection title="Session" testID="session-section">
          <Text>Current device</Text>
        </SettingsSection>
        <SettingsSection
          title="Sign out of HiMu"
          tone="destructive"
          testID="destructive-section"
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out">
            <Text>Sign out</Text>
          </Pressable>
        </SettingsSection>
      </View>,
    );
    const sessionStyle = StyleSheet.flatten(screen.getByTestId("session-section").props.style);
    const destructiveStyle = StyleSheet.flatten(
      screen.getByTestId("destructive-section").props.style,
    );

    expect(sessionStyle.borderTopWidth).toBeUndefined();
    expect(destructiveStyle).toEqual(expect.objectContaining({
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: expect.any(Number),
    }));
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
