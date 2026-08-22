import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

import { ScreenScrollView } from "@/src/components/ScreenScrollView";

const mockWindowWidth = 1024;

jest.mock("@/src/components/StatusBarScrim", () => ({
  StatusBarScrim: () => null,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    width: mockWindowWidth,
    height: 844,
    scale: 1,
    fontScale: 1,
  }),
}));

describe("ScreenScrollView", () => {
  it("keeps caller padding and gap on the breakpoint-constrained canvas", async () => {
    const screen = await render(
      <ScreenScrollView
        canvasVariant="max"
        contentContainerStyle={{ gap: 32, paddingHorizontal: 24 }}
      >
        <View testID="first-child" />
        <View testID="second-child" />
      </ScreenScrollView>,
    );
    const scrollView = screen.container.queryAll(
      (instance) => instance.type === "RCTScrollView",
    )[0];

    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).not.toEqual(
      expect.objectContaining({
        gap: expect.anything(),
        paddingHorizontal: expect.anything(),
      }),
    );

    const canvas = screen.getByTestId("first-child").parent;
    if (!canvas) throw new Error("expected the screen canvas parent");

    expect(StyleSheet.flatten(canvas.props.style)).toEqual(
      expect.objectContaining({
        width: "100%",
        maxWidth: { xs: undefined, lg: 1280 },
        alignSelf: "center",
        gap: 32,
        paddingHorizontal: 24,
      }),
    );
  });
});
