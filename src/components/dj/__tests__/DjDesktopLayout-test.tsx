import { render } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";

import {
  DjDesktopLayout,
  DjDesktopLayoutSlot,
  DJ_TRACK_MIN_CARD_WIDTH,
} from "../DjDesktopLayout";
import { breakpoints } from "@/src/theme/breakpoints";
import {
  createTrackGridItemStyle,
  resolveTrackGridColumns,
} from "@/src/components/content/TrackGrid";

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

  it.each([1024, 1440, 1920])(
    "uses a %ipx canvas contract with no orphaned DJ track cards",
    (viewportWidth) => {
      const gutter = 16;
      const usableWidth = Math.min(viewportWidth, 1280) - 48;
      const columns = resolveTrackGridColumns(viewportWidth);
      const basis = columns === 4 ? usableWidth * 0.235 : usableWidth * 0.15;
      const cardWidth = Math.max(DJ_TRACK_MIN_CARD_WIDTH, basis);

      expect(createTrackGridItemStyle(DJ_TRACK_MIN_CARD_WIDTH)).toEqual(
        expect.objectContaining({ minWidth: DJ_TRACK_MIN_CARD_WIDTH }),
      );
      expect(columns * cardWidth + (columns - 1) * gutter).toBeLessThanOrEqual(usableWidth);
      expect((columns + 1) * cardWidth + columns * gutter).toBeGreaterThan(usableWidth);
    },
  );
});
