/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";

import AppLayout from "@/app/(app)/_layout";

let mockDiscoverFocused = false;

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  function Tabs({ children }: { children: React.ReactNode }) {
    return React.createElement(View, { testID: "tabs" }, children);
  }
  function TabScreen({
    name,
    options,
  }: {
    name: string;
    options?: {
      tabBarAccessibilityLabel?: string;
      tabBarIcon?: (input: { focused: boolean }) => React.ReactNode;
    };
  }) {
    return React.createElement(
      View,
      {
        accessibilityLabel: options?.tabBarAccessibilityLabel,
        testID: `tab-screen-${name}`,
      },
      options?.tabBarIcon?.({
        focused: name === "discover" ? mockDiscoverFocused : false,
      }),
    );
  }
  Tabs.Screen = TabScreen;

  return {
    Redirect: () => null,
    Tabs,
  };
});

jest.mock("@/src/onboarding", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    TourTarget: ({ children, id }: { children: React.ReactNode; id: string }) =>
      React.createElement(View, { testID: `tour-target-${id}` }, children),
  };
});

jest.mock("@/src/stores/auth-store", () => ({
  useAuthStore: (selector: (state: object) => unknown) =>
    selector({ isLoading: false, session: { user: { id: "user" } } }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("App tab layout", () => {
  it("keeps the Discover tour target, label, and 44-point icon across focus changes", async () => {
    const screen = await render(<AppLayout />);

    expect(screen.getByTestId("tour-target-tabs.discover")).toBeTruthy();
    expect(screen.getByLabelText("Discover")).toBeTruthy();
    expect(screen.getByTestId("discover-tab-icon")).toHaveStyle({
      width: 44,
      height: 44,
    });
    expect(screen.getByTestId("discover-tab-icon")).not.toHaveStyle({
      backgroundColor: "rgba(189,194,255,0.16)",
    });

    mockDiscoverFocused = true;
    await screen.rerender(<AppLayout />);

    expect(screen.getByTestId("tour-target-tabs.discover")).toBeTruthy();
    expect(screen.getByLabelText("Discover")).toBeTruthy();
    expect(screen.getByTestId("discover-tab-icon")).toHaveStyle({
      width: 44,
      height: 44,
      backgroundColor: "rgba(189,194,255,0.16)",
    });
  });
});
