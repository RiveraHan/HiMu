/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import { I18nManager, StyleSheet as RNStyleSheet } from "react-native";

import AppLayout, { resolveTabBarGeometry } from "@/app/(app)/_layout";
import i18n from "@/src/i18n";

let mockDiscoverFocused = false;
let mockWindowWidth = 390;
let mockMeasuredTabBarLayout: { width: number; x: number } | null = null;
const originalIsRTL = Object.getOwnPropertyDescriptor(I18nManager, "isRTL");

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  function Tabs({ children, screenOptions }: {
    children: React.ReactNode;
    screenOptions: { tabBarStyle: { end?: "auto" | number; start?: number; width?: number } };
  }) {
    return React.createElement(
      View,
      { testID: "tabs", screenOptions },
      React.createElement(View, {
        testID: "rendered-tab-bar",
        style: [{ start: 0, end: 0 }, screenOptions.tabBarStyle],
        onLayout: (event: {
          nativeEvent: { layout: { width: number; x: number } };
        }) => {
          const { width, x } = event.nativeEvent.layout;
          mockMeasuredTabBarLayout = { width, x };
        },
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
    mockMeasuredTabBarLayout = null;
  });

  afterEach(() => {
    if (originalIsRTL) {
      Object.defineProperty(I18nManager, "isRTL", originalIsRTL);
    } else {
      delete (I18nManager as { isRTL?: boolean }).isRTL;
    }
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

  it("keeps bottom tabs through medium and hides them at the desktop boundary", async () => {
    mockWindowWidth = 1023;
    const screen = await render(<AppLayout />);
    expect(screen.getByTestId("tabs").props.screenOptions.tabBarStyle).not.toEqual(
      expect.objectContaining({ display: "none" }),
    );

    mockWindowWidth = 1024;
    await screen.rerender(<AppLayout />);
    expect(screen.getByTestId("tabs").props.screenOptions.tabBarStyle).toEqual(
      expect.objectContaining({ display: "none" }),
    );
  });

  it.each([
    ["LTR phone", false, 390, 343.2, 23.4],
    ["RTL phone", true, 390, 343.2, 23.4],
    ["LTR medium", false, 1023, 720, 151.5],
    ["RTL medium", true, 1023, 720, 151.5],
  ])("renders %s with logical insets and a centered physical x position", async (
    _name,
    isRTL,
    windowWidth,
    width,
    x,
  ) => {
    Object.defineProperty(I18nManager, "isRTL", {
      configurable: true,
      value: isRTL,
    });
    mockWindowWidth = windowWidth;
    const geometry = resolveTabBarGeometry(windowWidth, I18nManager.isRTL);
    expect(geometry).toEqual(expect.objectContaining({ width, end: "auto" }));
    expect(geometry.start).toBeCloseTo(x);
    expect(geometry.x).toBeCloseTo(x);
    const screen = await render(<AppLayout />);
    const tabBar = screen.getByTestId("rendered-tab-bar");
    const style = RNStyleSheet.flatten(tabBar.props.style);

    expect(style).toEqual(expect.objectContaining({
      width: geometry.width,
      start: geometry.start,
      end: geometry.end,
    }));
    expect(I18nManager.isRTL).toBe(isRTL);

    // React's JS test renderer does not run Yoga, so native layout needs an
    // explicit event. The host remains a real View, as BottomTabBar renders.
    await act(async () => {
      fireEvent(tabBar, "layout", {
        nativeEvent: {
          layout: { x: geometry.x, y: 0, width: geometry.width, height: 64 },
        },
      });
    });
    expect(mockMeasuredTabBarLayout).toEqual({
      x: geometry.x,
      width: geometry.width,
    });
  });
});
