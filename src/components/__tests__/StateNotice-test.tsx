import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as RNStyleSheet, View } from "react-native";

import { StateNotice } from "@/src/components/StateNotice";

describe("StateNotice", () => {
  it("renders an ungrouped empty surface without an assertive announcement", async () => {
    const screen = await render(
      <StateNotice
        kind="empty"
        title="No recent activity"
        message="Completed work will appear here."
        testID="empty-notice"
      />,
    );

    expect(screen.getByText("No recent activity")).toBeTruthy();
    expect(screen.getByText("Completed work will appear here.")).toBeTruthy();
    expect(screen.getByTestId("empty-notice")).toHaveProp("accessible", false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces an error update while keeping Retry independently actionable", async () => {
    const onRetry = jest.fn();
    const screen = await render(<View testID="loading-placeholder" />);

    await screen.rerender(
      <StateNotice
        kind="error"
        title="Activity is unavailable"
        message="Try loading it again."
        actionLabel="Retry"
        onAction={onRetry}
        testID="error-notice"
      />,
    );

    const announcement = screen.getByRole("alert", {
      name: "Activity is unavailable. Try loading it again.",
    });
    expect(announcement).toHaveProp("accessibilityLiveRegion", "polite");
    expect(screen.getByTestId("error-notice")).toHaveProp("accessible", false);

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(RNStyleSheet.flatten(retry.props.style)).toEqual(
      expect.objectContaining({ minHeight: 44, minWidth: 44 }),
    );
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("announces an offline update and only renders a complete action", async () => {
    const screen = await render(<View testID="loading-placeholder" />);

    await screen.rerender(
      <StateNotice
        kind="offline"
        title="Activity will update when you're back online"
        message="Recent activity is still available."
        actionLabel="Retry"
        compact
        testID="offline-notice"
      />,
    );

    const announcement = screen.getByRole("alert", {
      name: "Activity will update when you're back online. Recent activity is still available.",
    });
    expect(announcement).toHaveProp("accessibilityLiveRegion", "polite");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(RNStyleSheet.flatten(screen.getByTestId("offline-notice").props.style)).toEqual(
      expect.objectContaining({ padding: 12 }),
    );
  });
});
