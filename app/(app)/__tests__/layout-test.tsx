/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";

import AppLayout from "@/app/(app)/_layout";
import i18n from "@/src/i18n";

let mockDiscoverFocused = false;
let mockWindowWidth = 390;
let mockIsRTL = false;

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  function Tabs({ children, screenOptions }: {
    children: React.ReactNode;
    screenOptions: { tabBarStyle: { end?: "auto" | number; start?: number; width?: number } };
  }) {
    // BottomTabBar supplies zero logical insets. Mimic Yoga's resolution after
    // screenOptions override them, then expose the host's physical layout.
    const tabBarStyle = { start: 0, end: 0, ...screenOptions.tabBarStyle };
    const width = tabBarStyle.width ?? 0;
    const start = tabBarStyle.start ?? 0;
    const x = mockIsRTL ? mockWindowWidth - width - start : start;

    return React.createElement(
      View,
      { testID: "tabs", screenOptions },
      React.createElement(View, {
        testID: "rendered-tab-bar",
        style: tabBarStyle,
        renderedLayout: { x, width },
      }),
      children,
    );
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

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 844, scale: 1, fontScale: 1 }),
}));

describe("App tab layout", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("es");
    mockWindowWidth = 390;
    mockIsRTL = false;
  });

  it("keeps the Discover tour target, label, and 44-point icon across focus changes", async () => {
    const screen = await render(<AppLayout />);

    expect(screen.getByLabelText("Inicio")).toBeTruthy();
    expect(screen.getByTestId("tour-target-tabs.discover")).toBeTruthy();
    expect(screen.getByLabelText("Descubrir")).toBeTruthy();
    expect(screen.getByLabelText("Perfil")).toBeTruthy();
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
    expect(screen.getByLabelText("Descubrir")).toBeTruthy();
    expect(screen.getByTestId("discover-tab-icon")).toHaveStyle({
      width: 44,
      height: 44,
      backgroundColor: "rgba(189,194,255,0.16)",
    });
  });

  it("preserves the floating tab bar geometry beneath global chrome", async () => {
    const screen = await render(<AppLayout />);
    const options = screen.getByTestId("tabs").props.screenOptions;

    expect(options.tabBarStyle).toEqual(expect.objectContaining({
      bottom: 8,
      height: 64,
      width: 343.2,
      end: "auto",
    }));
    expect(options.tabBarStyle.start).toBeCloseTo(23.4);
  });

  it("caps and centers the tab bar on tablet widths", async () => {
    mockWindowWidth = 1024;
    const screen = await render(<AppLayout />);
    expect(screen.getByTestId("tabs").props.screenOptions.tabBarStyle).toEqual(
      expect.objectContaining({ width: 720, start: 152, end: "auto" }),
    );
  });

  it.each([
    ["LTR phone", false, 390, 343.2, 23.4],
    ["RTL phone", true, 390, 343.2, 23.4],
    ["LTR tablet", false, 1024, 720, 152],
    ["RTL tablet", true, 1024, 720, 152],
  ])("renders %s with logical insets and a centered physical x position", async (
    _name,
    isRTL,
    windowWidth,
    width,
    x,
  ) => {
    mockIsRTL = isRTL;
    mockWindowWidth = windowWidth;
    const screen = await render(<AppLayout />);
    const tabBar = screen.getByTestId("rendered-tab-bar");

    expect(tabBar.props.style).toEqual(expect.objectContaining({ width, end: "auto" }));
    expect(tabBar.props.style.start).toBeCloseTo(x);
    expect(tabBar.props.renderedLayout.width).toBe(width);
    expect(tabBar.props.renderedLayout.x).toBeCloseTo(x);
  });
});
