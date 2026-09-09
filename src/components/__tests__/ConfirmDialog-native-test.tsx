import { act, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useConfirmStore } from "@/src/stores/confirm-store";
import { ConfirmDialogHost } from "../ConfirmDialog";

describe("ConfirmDialogHost native accessibility", () => {
  beforeEach(() => {
    useConfirmStore.setState({ pending: null });
  });

  afterEach(async () => {
    if (useConfirmStore.getState().pending) {
      await act(() => useConfirmStore.getState().resolve(false));
    }
    jest.restoreAllMocks();
  });

  it("presents modal dialog semantics, focuses the title, and Android Back cancels with focus return", async () => {
    let backHandler: (() => boolean | null | undefined) | undefined;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
      backHandler = handler;
      return { remove: jest.fn() };
    });
    const accessibilityFocus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
    const returnFocus = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
        <ConfirmDialogHost />
      </SafeAreaProvider>,
    );
    let result!: Promise<boolean>;
    await act(() => {
      result = useConfirmStore.getState().request({ title: "Make this track public?", returnFocus });
    });

    const dialog = screen.getByTestId("confirm-dialog");
    expect(dialog.props.role).toBe("dialog");
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    await waitFor(() => expect(accessibilityFocus).toHaveBeenCalled());
    await act(() => { expect(backHandler?.()).toBe(true); });
    await expect(result).resolves.toBe(false);
    expect(returnFocus).toHaveBeenCalledTimes(1);
  });
});
