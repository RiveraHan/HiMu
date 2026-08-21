import { render } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";

import {
  DjDesktopLayout,
  DjDesktopLayoutSlot,
} from "../DjDesktopLayout";
import { breakpoints } from "@/src/theme/breakpoints";

describe("DjDesktopLayout", () => {
  it("keeps one source-ordered hero, actions, details, and tracks tree", async () => {
    const screen = await render(
      <DjDesktopLayout>
        <DjDesktopLayoutSlot slot="hero"><Text>Hero</Text></DjDesktopLayoutSlot>
        <DjDesktopLayoutSlot slot="actions"><Text>Actions</Text></DjDesktopLayoutSlot>
        <DjDesktopLayoutSlot slot="details"><Text>Details</Text></DjDesktopLayoutSlot>
        <DjDesktopLayoutSlot slot="tracks"><View testID="tracks" /></DjDesktopLayoutSlot>
      </DjDesktopLayout>,
    );

    const layout = screen.getByTestId("dj-desktop-layout");
    expect(layout.children).toEqual([
      screen.getByTestId("dj-desktop-hero"),
      screen.getByTestId("dj-desktop-actions"),
      screen.getByTestId("dj-desktop-details"),
      screen.getByTestId("dj-desktop-tracks"),
    ]);
    expect(screen.getByTestId("dj-desktop-tracks").children).toEqual([
      screen.getByTestId("tracks"),
    ]);
  });

  it.each([
    [390, "column"],
    [1280, "row"],
    [1920, "row"],
    [640, "column"], // 1280px at 200% zoom
  ])("maps %ipx to the expected hero/detail flow", async (width, direction) => {
    const screen = await render(
      <DjDesktopLayout>
        <DjDesktopLayoutSlot slot="hero"><Text>Hero</Text></DjDesktopLayoutSlot>
        <DjDesktopLayoutSlot slot="actions"><Text>Actions</Text></DjDesktopLayoutSlot>
        <DjDesktopLayoutSlot slot="details"><Text>Details</Text></DjDesktopLayoutSlot>
        <DjDesktopLayoutSlot slot="tracks"><Text>Tracks</Text></DjDesktopLayoutSlot>
      </DjDesktopLayout>,
    );

    const directions = StyleSheet.flatten(
      screen.getByTestId("dj-desktop-details").props.style,
    ).flexDirection as Record<keyof typeof breakpoints, "column" | "row">;
    const resolved = (Object.entries(breakpoints) as [keyof typeof breakpoints, number][])
      .filter(([, breakpoint]) => breakpoint <= width)
      .reduce<"column" | "row">((current, [name]) => directions[name] ?? current, "column");

    expect(resolved).toBe(direction);
  });
});
