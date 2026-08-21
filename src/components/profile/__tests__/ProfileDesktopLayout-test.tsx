/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";
import { Avatar } from "@/src/components/Avatar";
import {
  ProfileDesktopLayout,
  ProfileDesktopLayoutSlot,
} from "@/src/components/profile/ProfileDesktopLayout";

jest.mock("expo-image", () => {
  const React = require("react");
  const { View: NativeView } = require("react-native");
  return {
    Image: ({ onError, ...props }: Record<string, unknown>) =>
      React.createElement(NativeView, { ...props, onError }),
  };
});

describe("ProfileDesktopLayout", () => {
  it("keeps one compact reading order while CSS composes the desktop dashboard", async () => {
    const screen = await render(
      <ProfileDesktopLayout>
        <ProfileDesktopLayoutSlot slot="header"><View testID="header" /></ProfileDesktopLayoutSlot>
        <ProfileDesktopLayoutSlot slot="dashboard">
          <ProfileDesktopLayoutSlot slot="stats"><View testID="stats" /></ProfileDesktopLayoutSlot>
          <ProfileDesktopLayoutSlot slot="identity"><View testID="identity" /></ProfileDesktopLayoutSlot>
        </ProfileDesktopLayoutSlot>
        <ProfileDesktopLayoutSlot slot="djs"><View testID="djs" /></ProfileDesktopLayoutSlot>
        <ProfileDesktopLayoutSlot slot="settings"><View testID="settings" /></ProfileDesktopLayoutSlot>
      </ProfileDesktopLayout>,
    );

    expect(screen.getByTestId("profile-desktop-layout")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("stats").parent?.parent?.props.style))
      .toEqual(expect.objectContaining({ flexDirection: { xs: "column", xl: "row" } }));
    expect(StyleSheet.flatten(screen.getByTestId("djs").parent?.props.style))
      .toEqual(expect.objectContaining({ flexBasis: { xs: "100%", xl: "23.5%" } }));
    expect(screen.getByTestId("header")).toBeTruthy();
    expect(screen.getByTestId("stats")).toBeTruthy();
    expect(screen.getByTestId("identity")).toBeTruthy();
    expect(screen.getByTestId("djs")).toBeTruthy();
    expect(screen.getByTestId("settings")).toBeTruthy();
  });

  it("retains the listener initial when a profile avatar fails", async () => {
    jest.spyOn(console, "warn").mockImplementation();
    const screen = await render(
      <Avatar src="https://cdn.example.com/broken-profile.jpg" fallback="Mina" size="2xl" />,
    );

    await fireEvent(screen.getByTestId("himu-image-native"), "error");

    expect(screen.getByText("M")).toBeTruthy();
    expect(screen.queryByTestId("himu-image-native")).toBeNull();
    jest.restoreAllMocks();
  });
});
