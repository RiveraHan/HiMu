import { render } from "@testing-library/react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenCanvas } from "@/src/components/ScreenCanvas";

let mockWindowWidth = 390;
let mockWindowHeight = 844;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    width: mockWindowWidth,
    height: mockWindowHeight,
    scale: 1,
    fontScale: 1,
  }),
}));

describe("ScreenCanvas", () => {
  beforeEach(() => {
    mockWindowWidth = 390;
    mockWindowHeight = 844;
  });

  it.each([
    ["readable", 720],
    ["wide", 1120],
    ["max", 1280],
  ] as const)(
    "keeps the same static and desktop style structure for the %s canvas",
    async (variant, maxWidth) => {
      const canvasStyle = async (width: number) => {
        mockWindowWidth = width;
        const screen = await render(
          <ScreenCanvas variant={variant} testID="canvas">
            <View />
          </ScreenCanvas>,
        );
        const style = StyleSheet.flatten(screen.getByTestId("canvas").props.style);
        await screen.unmount();
        return style;
      };

      const staticStyle = await canvasStyle(0);
      const desktopStyle = await canvasStyle(1440);

      expect(staticStyle).toEqual(desktopStyle);
      expect(staticStyle).toEqual(
        expect.objectContaining({
          width: "100%",
          paddingHorizontal: 24,
          maxWidth: { xs: undefined, lg: maxWidth },
        }),
      );
      expect(staticStyle).not.toEqual(
        expect.objectContaining({ marginHorizontal: expect.anything() }),
      );
    },
  );

  it("keeps caller spacing inside the breakpoint-constrained canvas", async () => {
    const screen = await render(
      <ScreenCanvas
        variant="max"
        testID="canvas"
        style={{ gap: 32, paddingHorizontal: 40 }}
      >
        <View />
      </ScreenCanvas>,
    );

    expect(StyleSheet.flatten(screen.getByTestId("canvas").props.style)).toEqual(
      expect.objectContaining({
        width: "100%",
        maxWidth: { xs: undefined, lg: 1280 },
        gap: 32,
        paddingHorizontal: 40,
      }),
    );
  });

  it.each([
    [390, 844, "stretch"],
    [1440, 599, "stretch"],
    [1440, 900, "flex-end"],
  ] as const)(
    "keeps actions after content with reachable placement at %i×%i",
    async (width, height, alignSelf) => {
      mockWindowWidth = width;
      mockWindowHeight = height;
      const screen = await render(
        <ScreenCanvas
          testID="canvas"
          actions={(
            <Pressable accessibilityRole="button" accessibilityLabel="Continue">
              <Text>Continue</Text>
            </Pressable>
          )}
        >
          <View testID="canvas-content" />
        </ScreenCanvas>,
      );

      const actions = screen.getByTestId("screen-canvas-actions");
      expect(screen.getByTestId("canvas").children).toEqual([
        screen.getByTestId("canvas-content"),
        actions,
      ]);
      expect(StyleSheet.flatten(actions.props.style)).toEqual(
        expect.objectContaining({
          position: "relative",
          alignSelf,
          maxWidth: "100%",
        }),
      );
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    },
  );
});
