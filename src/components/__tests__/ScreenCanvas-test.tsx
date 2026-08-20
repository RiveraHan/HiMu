import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

import { ScreenCanvas } from "@/src/components/ScreenCanvas";

describe("ScreenCanvas", () => {
  it("gives a max canvas its 1280-point maximum width", async () => {
    const screen = await render(
      <ScreenCanvas variant="max" testID="canvas">
        <View />
      </ScreenCanvas>,
    );

    expect(StyleSheet.flatten(screen.getByTestId("canvas").props.style)).toEqual(
      expect.objectContaining({
        width: "100%",
        maxWidth: 1280,
      }),
    );
  });
});
