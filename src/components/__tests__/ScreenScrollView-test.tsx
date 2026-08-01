import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

import { ScreenScrollView } from "@/src/components/ScreenScrollView";

jest.mock("@/src/components/StatusBarScrim", () => ({
  StatusBarScrim: () => null,
}));

describe("ScreenScrollView", () => {
  it("centers caller content inside the shared 720-point reading column", async () => {
    const screen = await render(
      <ScreenScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View testID="content" />
      </ScreenScrollView>,
    );
    const scrollView = screen.container.queryAll(
      (instance) => instance.type === "RCTScrollView",
    )[0];

    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      expect.objectContaining({
        paddingHorizontal: 24,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }),
    );
  });
});
