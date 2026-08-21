import { fireEvent, render } from "@testing-library/react-native";
import * as mockReact from "react";
import { StyleSheet, Text, View as mockNativeView } from "react-native";

import {
  PlayerDesktopLayout,
  PlayerDesktopLayoutSlot,
} from "../PlayerDesktopLayout";
import { PlayerArtwork } from "../PlayerArtwork";
import { breakpoints } from "@/src/theme/breakpoints";

jest.mock("expo-image", () => ({
  Image: ({ onDisplay, onError, ...props }: Record<string, unknown>) => {
    return mockReact.createElement(
      mockNativeView,
      { ...props, onDisplay, onError } as never,
    );
  },
}));

describe("Player desktop stage", () => {
  it("keeps one source-ordered stage while CSS maps it to two columns at desktop widths", async () => {
    const screen = await render(
      <PlayerDesktopLayout>
        <PlayerDesktopLayoutSlot slot="artwork">
          <Text>Artwork</Text>
        </PlayerDesktopLayoutSlot>
        <PlayerDesktopLayoutSlot slot="playback">
          <Text>Playback</Text>
        </PlayerDesktopLayoutSlot>
      </PlayerDesktopLayout>,
    );

    const stage = screen.getByTestId("player-desktop-stage");
    expect(StyleSheet.flatten(stage.props.style)).toEqual(
      expect.objectContaining({ flexDirection: { xs: "column", xl: "row" } }),
    );
    expect(screen.getByTestId("player-desktop-artwork")).toBeTruthy();
    expect(screen.getByTestId("player-desktop-playback")).toBeTruthy();
    expect(screen.getByTestId("player-desktop-stage").children).toEqual([
      screen.getByTestId("player-desktop-artwork"),
      screen.getByTestId("player-desktop-playback"),
    ]);
  });

  test.each([
    [390, "column"],
    [1280, "row"],
    [1920, "row"],
    [640, "column"], // 1280px at 200% zoom
  ])("maps a %ipx effective viewport to the expected stage direction", async (width, direction) => {
    const screen = await render(
      <PlayerDesktopLayout>
        <PlayerDesktopLayoutSlot slot="artwork"><Text>Artwork</Text></PlayerDesktopLayoutSlot>
        <PlayerDesktopLayoutSlot slot="playback"><Text>Playback</Text></PlayerDesktopLayoutSlot>
      </PlayerDesktopLayout>,
    );
    const directions = StyleSheet.flatten(
      screen.getByTestId("player-desktop-stage").props.style,
    ).flexDirection as Record<keyof typeof breakpoints, "column" | "row">;
    const resolved = (Object.entries(breakpoints) as [keyof typeof breakpoints, number][])
      .filter(([, breakpoint]) => breakpoint <= width)
      .reduce<"column" | "row">((current, [name]) => directions[name] ?? current, "column");

    expect(resolved).toBe(direction);
  });

  it("keeps a square fallback reserved when a cover is absent", async () => {
    const screen = await render(
      <PlayerArtwork source={null} accessibilityLabel="Artwork for Signal Bloom" />,
    );

    expect(screen.getByTestId("player-artwork")).toHaveStyle({
      aspectRatio: 1,
      width: "100%",
    });
    expect(screen.getByTestId("player-artwork-fallback")).toBeTruthy();
    expect(screen.queryByTestId("player-artwork-atmosphere")).toBeNull();
  });

  it("keeps the fallback after a failed R2 cover and retries without invoking cover regeneration", async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <PlayerArtwork
        source="https://media.overinn.com/covers/signal-bloom.webp"
        accessibilityLabel="Artwork for Signal Bloom"
        onRetry={onRetry}
      />,
    );

    fireEvent(screen.getByTestId("himu-image-native"), "error");

    expect(screen.getByTestId("player-artwork-fallback")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Retry artwork" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("himu-image-native")).toHaveProp(
      "source",
      "https://media.overinn.com/covers/signal-bloom.webp",
    );
  });
});
