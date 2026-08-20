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
    ["compact", 390, "readable", undefined],
    ["medium", 768, "wide", 1120],
    ["desktop", 1024, "max", 1280],
  ] as const)(
    "keeps a 24-point page gutter and %s canvas width",
    async (_mode, width, variant, maxWidth) => {
      mockWindowWidth = width;
      const screen = await render(
        <ScreenCanvas variant={variant} testID="canvas">
          <View />
        </ScreenCanvas>,
      );

      expect(StyleSheet.flatten(screen.getByTestId("canvas").props.style)).toEqual(
        expect.objectContaining({
          width: "100%",
          paddingHorizontal: 24,
          maxWidth,
        }),
      );
      expect(StyleSheet.flatten(screen.getByTestId("canvas").props.style)).not.toEqual(
        expect.objectContaining({ marginHorizontal: expect.anything() }),
      );
    },
  );

  it("keeps caller spacing inside the constrained canvas", async () => {
    mockWindowWidth = 1024;
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
        maxWidth: 1280,
        gap: 32,
        paddingHorizontal: 40,
      }),
    );
  });
});
