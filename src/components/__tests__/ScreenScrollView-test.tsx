import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

import { ScreenScrollView } from "@/src/components/ScreenScrollView";

jest.mock("@/src/components/StatusBarScrim", () => ({
  StatusBarScrim: () => null,
}));

describe("ScreenScrollView", () => {
  it("delegates the max width to its max canvas", async () => {
    const screen = await render(
      <ScreenScrollView
        canvasVariant="max"
        contentContainerStyle={{ paddingHorizontal: 24 }}
      >
        <View testID="content" />
      </ScreenScrollView>,
    );
    const scrollView = screen.container.queryAll(
      (instance) => instance.type === "RCTScrollView",
    )[0];

    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      expect.objectContaining({ paddingHorizontal: 24 }),
    );
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).not.toEqual(
      expect.objectContaining({ maxWidth: expect.anything() }),
    );

    const canvas = screen.container.queryAll(
      (instance) => StyleSheet.flatten(instance.props.style)?.maxWidth === 1280,
    )[0];

    expect(StyleSheet.flatten(canvas.props.style)).toEqual(
      expect.objectContaining({
        width: "100%",
        maxWidth: 1280,
        alignSelf: "center",
      }),
    );
  });
});
