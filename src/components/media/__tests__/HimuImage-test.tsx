import { fireEvent, render } from "@testing-library/react-native";
import * as mockReact from "react";
import { View, View as mockNativeView } from "react-native";

import { HimuImage } from "../HimuImage";

jest.mock("expo-image", () => ({
  Image: ({ onLoadStart, onDisplay, onError, ...props }: Record<string, unknown>) =>
    mockReact.createElement(mockNativeView, {
        ...props,
        onLoadStart,
        onDisplay,
        onError,
      } as never),
}));

describe("HimuImage", () => {
  const fallback = <View testID="image-fallback-content" />;

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps a fallback in its reserved frame when the source is absent", async () => {
    const screen = await render(
      <HimuImage
        source={null}
        fallback={fallback}
        style={{ width: 64, height: 48 }}
      />,
    );

    expect(screen.queryByTestId("himu-image-native")).toBeNull();
    expect(screen.getByTestId("himu-image-fallback")).toBeTruthy();
    expect(screen.getByTestId("himu-image")).toHaveStyle({
      width: 64,
      height: 48,
    });
  });

  it("keeps the fallback behind an image until the image is displayed", async () => {
    const screen = await render(
      <HimuImage source="https://cdn.example.com/cover.jpg" fallback={fallback} />,
    );

    expect(screen.getByTestId("himu-image-fallback")).toBeTruthy();
    expect(screen.getByTestId("himu-image-native")).toHaveStyle({ opacity: 0 });

    await fireEvent(screen.getByTestId("himu-image-native"), "display");

    expect(screen.queryByTestId("himu-image-fallback")).toBeNull();
    expect(screen.getByTestId("himu-image-native")).toHaveStyle({ opacity: 1 });
  });

  it("replaces a failed source with its fallback", async () => {
    const screen = await render(
      <HimuImage source="https://cdn.example.com/cover.jpg" fallback={fallback} />,
    );

    await fireEvent(screen.getByTestId("himu-image-native"), "error", {
      error: "failed",
    });

    expect(screen.getByTestId("himu-image-fallback")).toBeTruthy();
    expect(screen.queryByTestId("himu-image-native")).toBeNull();
  });

  it("resets a failed image when its source changes", async () => {
    const screen = await render(
      <HimuImage source="https://cdn.example.com/broken.jpg" fallback={fallback} />,
    );

    await fireEvent(screen.getByTestId("himu-image-native"), "error", {
      error: "failed",
    });
    await screen.rerender(
      <HimuImage source="https://cdn.example.com/fresh.jpg" fallback={fallback} />,
    );

    expect(screen.getByTestId("himu-image-native")).toHaveProp(
      "source",
      "https://cdn.example.com/fresh.jpg",
    );
  });

  it("does not restart a displayed object source with the same URI", async () => {
    const screen = await render(
      <HimuImage
        source={{ uri: "https://cdn.example.com/stable.jpg" }}
        fallback={fallback}
      />,
    );

    await fireEvent(screen.getByTestId("himu-image-native"), "display");
    await screen.rerender(
      <HimuImage
        source={{ uri: "https://cdn.example.com/stable.jpg" }}
        fallback={fallback}
      />,
    );

    expect(screen.queryByTestId("himu-image-fallback")).toBeNull();
    expect(screen.getByTestId("himu-image-native")).toHaveStyle({ opacity: 1 });
  });

  it("allows one explicit retry for a source", async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <HimuImage
        source="https://cdn.example.com/broken.jpg"
        fallback={fallback}
        retryKey="initial"
        onRetry={onRetry}
      />,
    );

    await fireEvent(screen.getByTestId("himu-image-native"), "error", {
      error: "failed",
    });
    await screen.rerender(
      <HimuImage
        source="https://cdn.example.com/broken.jpg"
        fallback={fallback}
        retryKey="retry-once"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId("himu-image-native")).toBeTruthy();
    expect(onRetry).toHaveBeenCalledTimes(1);

    await fireEvent(screen.getByTestId("himu-image-native"), "error", {
      error: "failed again",
    });
    await screen.rerender(
      <HimuImage
        source="https://cdn.example.com/broken.jpg"
        fallback={fallback}
        retryKey="retry-twice"
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByTestId("himu-image-native")).toBeNull();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("exposes informative image text and hides decorative images", async () => {
    const screen = await render(
      <View>
        <HimuImage
          source="https://cdn.example.com/informative.jpg"
          fallback={fallback}
          accessibilityLabel="DJ Nova portrait"
        />
        <HimuImage
          source="https://cdn.example.com/decorative.jpg"
          fallback={fallback}
        />
      </View>,
    );

    expect(screen.getAllByTestId("himu-image-native")[0]).toHaveProp(
      "accessibilityLabel",
      "DJ Nova portrait",
    );
    expect(screen.getAllByTestId("himu-image-native")[1]).toHaveProp(
      "accessible",
      false,
    );
  });
});
