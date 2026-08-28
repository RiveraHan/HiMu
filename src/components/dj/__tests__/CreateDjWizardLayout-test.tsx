/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import * as ReactNative from "react-native";

import { CreateDjWizardLayout } from "../CreateDjWizardLayout";
import { resolveCreateDjLayout } from "../create-dj-layout";
import type { CreateDjStep } from "../create-dj-wizard-state";

const { AccessibilityInfo, StyleSheet, Text } = ReactNative;

let mockWindow = { width: 390, height: 844, fontScale: 1 };

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 1 }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useMiniPlayerPadding: () => 24 }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 8, right: 0, bottom: 12, left: 0 }),
}));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { ChevronLeft: () => React.createElement(View) };
});

type FixtureOptions = Readonly<{
  step?: CreateDjStep;
  completedSteps?: CreateDjStep[];
  editor?: React.ReactNode;
  action?: React.ReactNode;
  onStepPress?: jest.Mock;
}>;

function fixture({
  step = "sound",
  completedSteps = [],
  editor = <Text testID="active-editor">Sound editor</Text>,
  action = <Text testID="wizard-action">Continue action</Text>,
  onStepPress = jest.fn(),
}: FixtureOptions = {}) {
  return (
    <CreateDjWizardLayout
      step={step}
      completedSteps={completedSteps}
      title="Create your DJ"
      description="Shape a companion"
      editor={editor}
      summary={<Text testID="wizard-summary">Draft summary</Text>}
      action={action}
      onStepPress={onStepPress}
    />
  );
}

describe("Create DJ adaptive layout", () => {
  it("resolves exact width and low-height boundaries", () => {
    expect(resolveCreateDjLayout({ width: 767, height: 800, fontScale: 1 })).toEqual({ mode: "compact", lowHeight: false });
    expect(resolveCreateDjLayout({ width: 768, height: 800, fontScale: 1 })).toEqual({ mode: "medium", lowHeight: false });
    expect(resolveCreateDjLayout({ width: 1023, height: 800, fontScale: 1 })).toEqual({ mode: "medium", lowHeight: false });
    expect(resolveCreateDjLayout({ width: 1024, height: 768, fontScale: 1 })).toEqual({ mode: "wide", lowHeight: false });
    expect(resolveCreateDjLayout({ width: 1280, height: 599, fontScale: 1 })).toEqual({ mode: "wide", lowHeight: true });
    expect(resolveCreateDjLayout({ width: 1280, height: 600, fontScale: 1 })).toEqual({ mode: "wide", lowHeight: false });
  });

  it("reflows wide presentation when measured width or enlarged text cannot fit", async () => {
    mockWindow = { width: 1280, height: 800, fontScale: 1 };
    const screen = await render(fixture());
    expect(screen.getByTestId("create-dj-wizard-layout").props.nativeID).toBe("create-dj-layout-wide");
    expect(screen.getByTestId("wizard-summary")).toBeTruthy();

    await fireEvent(screen.getByTestId("create-dj-wizard-layout"), "layout", {
      nativeEvent: { layout: { width: 900, height: 800 } },
    });
    expect(screen.getByTestId("create-dj-wizard-layout").props.nativeID).toBe("create-dj-layout-medium");
    expect(screen.queryByTestId("wizard-summary")).toBeNull();

    mockWindow = { width: 1280, height: 800, fontScale: 1.5 };
    await screen.rerender(fixture());
    expect(screen.getByTestId("create-dj-wizard-layout").props.nativeID).toBe("create-dj-layout-medium");
  });

  it("keeps one editor and one source-order action while presentation changes", async () => {
    let mounts = 0;
    function Editor() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <Text testID="active-editor">Editor</Text>;
    }

    mockWindow = { width: 390, height: 844, fontScale: 1 };
    const screen = await render(fixture({ editor: <Editor /> }));
    expect(screen.getAllByTestId("active-editor")).toHaveLength(1);
    expect(screen.getAllByTestId("wizard-action")).toHaveLength(1);
    expect(screen.queryByTestId("wizard-summary")).toBeNull();

    mockWindow = { width: 1280, height: 800, fontScale: 1 };
    await screen.rerender(fixture({ editor: <Editor /> }));
    expect(screen.getAllByTestId("active-editor")).toHaveLength(1);
    expect(screen.getAllByTestId("wizard-action")).toHaveLength(1);
    expect(StyleSheet.flatten(screen.getByTestId("create-dj-wizard-body").props.style).flexDirection).toBe("row");
    expect(mounts).toBe(1);
  });

  it("announces progress and enables only current or completed 44px step targets", async () => {
    mockWindow = { width: 390, height: 844, fontScale: 1 };
    const onStepPress = jest.fn();
    const screen = await render(fixture({ step: "identity", completedSteps: ["sound"], onStepPress }));

    expect(screen.getByText("Step 2 of 3").props.accessibilityLiveRegion).toBe("polite");
    const sound = screen.getByRole("button", { name: "Sound" });
    const identity = screen.getByRole("button", { name: "Identity" });
    const review = screen.getByRole("button", { name: "Review" });
    expect(sound.props.accessibilityState.disabled).toBe(false);
    expect(identity.props.accessibilityState.disabled).toBe(false);
    expect(review.props.accessibilityState.disabled).toBe(true);
    expect(StyleSheet.flatten(sound.props.style).minHeight).toBe(44);
    expect(StyleSheet.flatten(sound.props.style).minWidth).toBe(44);

    await fireEvent.press(sound);
    await fireEvent.press(review);
    expect(onStepPress).toHaveBeenCalledWith("sound");
    expect(onStepPress).not.toHaveBeenCalledWith("review");
  });

  it("moves accessibility focus on Sound and Review entry while Identity owns its heading focus", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus");
    const node = jest.spyOn(ReactNative, "findNodeHandle").mockReturnValue(7);
    const screen = await render(fixture({ step: "identity", completedSteps: ["sound"] }));

    await screen.rerender(fixture({ step: "review", completedSteps: ["sound", "identity"] }));
    await waitFor(() => expect(focus).toHaveBeenCalledWith(7));
    expect(focus).toHaveBeenCalledTimes(1);

    focus.mockRestore();
    node.mockRestore();
  });
});
