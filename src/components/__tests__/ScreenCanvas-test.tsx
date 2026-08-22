import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

import { ScreenCanvas } from "@/src/components/ScreenCanvas";

let mockWindowWidth = 390;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    width: mockWindowWidth,
    height: 844,
    scale: 1,
    fontScale: 1,
  }),
}));

describe("ScreenCanvas", () => {
  beforeEach(() => {
    mockWindowWidth = 390;
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
});
