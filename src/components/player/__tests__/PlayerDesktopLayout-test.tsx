import { fireEvent, render } from "@testing-library/react-native";
import * as mockReact from "react";
import { StyleSheet, Text, View as mockNativeView } from "react-native";

import {
  PlayerDesktopLayout,
  PlayerDesktopLayoutSlot,
} from "../PlayerDesktopLayout";
import { PlayerArtwork } from "../PlayerArtwork";
import { darkTheme } from "@/src/theme/theme";

let mockWindowDimensions = { width: 390, height: 844 };

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    ...mockWindowDimensions,
    scale: 1,
    fontScale: 1,
  }),
}));

jest.mock("expo-image", () => ({
  Image: ({ onLoad, onDisplay, onError, ...props }: Record<string, unknown>) => {
    return mockReact.createElement(
      mockNativeView,
      { ...props, onLoad, onDisplay, onError } as never,
    );
  },
}));

describe("Player desktop stage", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWindowDimensions = { width: 390, height: 844 };
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("keeps one source-ordered stage while compact presentation stays in document flow", async () => {
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
      expect.objectContaining({ flexDirection: "column" }),
    );
    expect(screen.getByTestId("player-desktop-artwork")).toBeTruthy();
    expect(screen.getByTestId("player-desktop-playback")).toBeTruthy();
    expect(screen.getByTestId("player-desktop-stage").children).toEqual([
      screen.getByTestId("player-desktop-artwork"),
      screen.getByTestId("player-desktop-playback"),
    ]);
  });

  it("keeps compact artwork and playback content-sized before the desktop split", async () => {
    const screen = await render(
      <PlayerDesktopLayout>
        <PlayerDesktopLayoutSlot slot="artwork"><Text>Artwork</Text></PlayerDesktopLayoutSlot>
        <PlayerDesktopLayoutSlot slot="playback"><Text>Playback</Text></PlayerDesktopLayoutSlot>
      </PlayerDesktopLayout>,
    );

    expect(StyleSheet.flatten(screen.getByTestId("player-desktop-stage").props.style))
      .toEqual(expect.objectContaining({
        gap: { xs: darkTheme.spacing.stackLg, xl: darkTheme.spacing.stackLg * 2 },
      }));

    for (const slot of ["artwork", "playback"]) {
      expect(StyleSheet.flatten(screen.getByTestId(`player-desktop-${slot}`).props.style))
        .toEqual(expect.objectContaining({
          flexBasis: "auto",
          flexGrow: 0,
          flexShrink: 0,
        }));
    }
  });

  it.each([
    [390, 844, "column"],
    [1440, 599, "column"],
    [1440, 900, "row"],
  ] as const)(
    "uses document-flow player order at %i×%i",
    async (width, height, direction) => {
      mockWindowDimensions = { width, height };
      const screen = await render(
        <PlayerDesktopLayout>
          <PlayerDesktopLayoutSlot slot="artwork"><Text>Artwork</Text></PlayerDesktopLayoutSlot>
          <PlayerDesktopLayoutSlot slot="playback"><Text>Playback</Text></PlayerDesktopLayoutSlot>
        </PlayerDesktopLayout>,
      );

      expect(StyleSheet.flatten(screen.getByTestId("player-desktop-stage").props.style))
        .toEqual(expect.objectContaining({ flexDirection: direction }));
      if (height < 600) {
        for (const slot of ["artwork", "playback"]) {
          expect(StyleSheet.flatten(
            screen.getByTestId(`player-desktop-${slot}`).props.style,
          )).toEqual(expect.objectContaining({
            flexBasis: "auto",
            flexGrow: 0,
            flexShrink: 0,
          }));
        }
      }
    },
  );

  test.each([
    [390, 844, "column"],
    [1280, 800, "row"],
    [1920, 1080, "row"],
    [640, 422, "column"], // 1280px at 200% zoom
  ])("maps a %i×%i effective viewport to the expected stage direction", async (width, height, direction) => {
    mockWindowDimensions = { width, height };
    const screen = await render(
      <PlayerDesktopLayout>
        <PlayerDesktopLayoutSlot slot="artwork"><Text>Artwork</Text></PlayerDesktopLayoutSlot>
        <PlayerDesktopLayoutSlot slot="playback"><Text>Playback</Text></PlayerDesktopLayoutSlot>
      </PlayerDesktopLayout>,
    );
    expect(StyleSheet.flatten(
      screen.getByTestId("player-desktop-stage").props.style,
    ).flexDirection).toBe(direction);
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
    expect(screen.queryByRole("button", { name: "Retry artwork" })).toBeNull();
  });

  it("uses a neutral loading fallback until a current cover display succeeds", async () => {
    const onDisplay = jest.fn();
    const screen = await render(
      <PlayerArtwork
        source="https://media.overinn.com/covers/signal-bloom.webp"
        accessibilityLabel="Artwork for Signal Bloom"
        onDisplay={onDisplay}
      />,
    );

    expect(screen.getByTestId("player-artwork-loading")).toBeTruthy();
    expect(screen.queryByText("Artwork unavailable")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry artwork" })).toBeNull();

    await fireEvent(screen.getByTestId("himu-image-native"), "load");
    expect(onDisplay).not.toHaveBeenCalled();

    await fireEvent(screen.getByTestId("himu-image-native"), "display");
    expect(onDisplay).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("player-artwork-loading")).toBeNull();
  });

  it("shows unavailable and one local retry only after a failed R2 cover", async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <PlayerArtwork
        source="https://media.overinn.com/covers/signal-bloom.webp"
        accessibilityLabel="Artwork for Signal Bloom"
        onRetry={onRetry}
      />,
    );

    await fireEvent(screen.getByTestId("himu-image-native"), "error");

    expect(screen.getByTestId("player-artwork-fallback")).toBeTruthy();
    expect(screen.queryByTestId("player-artwork-loading")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry artwork" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("himu-image-native")).toHaveProp(
      "source",
      "https://media.overinn.com/covers/signal-bloom.webp",
    );
    expect(screen.getByTestId("himu-image-native")).toHaveProp("recyclingKey", "1");
    expect(screen.getByTestId("player-artwork-loading")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry artwork" })).toBeNull();
  });

  it("stays in the fallback after the one retry is exhausted", async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <PlayerArtwork
        source="https://media.overinn.com/covers/signal-bloom.webp"
        accessibilityLabel="Artwork for Signal Bloom"
        onRetry={onRetry}
      />,
    );

    await fireEvent(screen.getByTestId("himu-image-native"), "error");
    await fireEvent.press(screen.getByRole("button", { name: "Retry artwork" }));
    await fireEvent(screen.getByTestId("himu-image-native"), "error");

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("player-artwork-fallback")).toBeTruthy();
    expect(screen.queryByTestId("player-artwork-loading")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry artwork" })).toBeNull();
  });
});
