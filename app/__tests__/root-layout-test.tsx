/* eslint-disable @typescript-eslint/no-require-imports */
import { render, within } from "@testing-library/react-native";

import RootLayout from "@/app/_layout";

let mockFontState: [boolean, Error | null] = [true, null];
let mockThemeName = "dark";
let mockAuthState = authState(null, false);
let mockNavigatorMounts = 0;
let mockNavigatorUnmounts = 0;
let mockRenderOrder: string[] = [];
let mockTourPhase = "idle";
const mockClosePanel = jest.fn();
const mockSetTheme = jest.fn();
let mockRequestedRoute = "(app)";
let mockMountedRoutes: string[] = [];
let mockSegments = ["(app)"];
let mockWindowWidth = 390;

function authState(userId: string | null, isLoading: boolean, token = "token") {
  return {
    isLoading,
    session: userId ? { access_token: token, user: { id: userId } } : null,
  };
}

function mockNamedProvider(name: string) {
  return function Provider({ children }: { children: React.ReactNode }) {
    mockRenderOrder.push(name);
    const { View } = require("react-native");
    return <View testID={`provider-${name}`}>{children}</View>;
  };
}

jest.mock("@/src/hooks/use-auth", () => ({
  useAuthInit: () => {
    mockRenderOrder.push("auth-init");
  },
}));

jest.mock("@/src/stores/auth-store", () => ({
  useAuthStore: (selector: (state: object) => unknown) => selector(mockAuthState),
}));

jest.mock("@/src/audio/player-provider", () => ({ PlayerProvider: mockNamedProvider("player") }));
jest.mock("@/src/api/query-provider", () => ({ QueryProvider: mockNamedProvider("query") }));
jest.mock("@/src/i18n/LocaleProvider", () => ({ LocaleProvider: mockNamedProvider("locale") }));
jest.mock("@/src/activity", () => ({
  ActivityProvider: mockNamedProvider("activity"),
  useActivity: () => ({ closePanel: mockClosePanel }),
}));
jest.mock("@/src/onboarding", () => ({
  AppTourProvider: mockNamedProvider("app-tour"),
  useAppTour: () => ({ phase: mockTourPhase }),
}));
jest.mock("@/src/components/BottomChrome", () => ({
  BottomChrome: () => {
    const { View } = require("react-native");
    return <View testID="bottom-chrome" />;
  },
}));
jest.mock("@/src/components/activity/ActivityPanel", () => ({
  ActivityPanel: () => {
    const { View } = require("react-native");
    return <View testID="activity-panel" />;
  },
}));
jest.mock("@/src/components/Toast", () => ({ ToastHost: () => null }));
jest.mock("@/src/components/ConfirmDialog", () => ({ ConfirmDialogHost: () => null }));

jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({
    children,
    testID,
  }: {
    children: React.ReactNode;
    testID?: string;
  }) => {
    const { View } = require("react-native");
    return <View testID={testID}>{children}</View>;
  },
}));

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@/src/theme", () => ({}));
jest.mock("@/src/theme/unistyles", () => {
  const ReactNative = require("react-native");
  const { darkTheme } = require("@/src/theme/theme");

  return {
    StyleSheet: {
      ...ReactNative.StyleSheet,
      create: (styles: unknown) =>
        typeof styles === "function" ? styles(darkTheme) : styles,
    },
    UnistylesRuntime: {
      get themeName() {
        return mockThemeName;
      },
      setTheme: (...args: unknown[]) => mockSetTheme(...args),
    },
    useUnistyles: () => ({ theme: darkTheme, rt: {} }),
  };
});
jest.mock("expo-font", () => ({
  useFonts: () => mockFontState,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 844, scale: 1, fontScale: 1 }),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  function eligibleRouteNames(node: React.ReactNode): string[] {
    return React.Children.toArray(node).flatMap((child: React.ReactNode) => {
      if (!React.isValidElement(child)) return [];
      const element = child as React.ReactElement<{
        children?: React.ReactNode;
        guard?: boolean;
        name?: string;
      }>;
      if (element.type === StackProtected) {
        return element.props.guard
          ? eligibleRouteNames(element.props.children)
          : [];
      }
      if (
        element.type === StackScreen &&
        typeof element.props.name === "string"
      ) {
        return [element.props.name];
      }
      return [];
    });
  }
  function Stack({ children }: { children: React.ReactNode }) {
    React.useEffect(() => {
      mockNavigatorMounts += 1;
      return () => {
        mockNavigatorUnmounts += 1;
      };
    }, []);
    const eligibleRoutes = eligibleRouteNames(children);
    const selectedRoute = eligibleRoutes.includes(mockRequestedRoute)
      ? mockRequestedRoute
      : eligibleRoutes.includes("(auth)")
        ? "(auth)"
        : null;
    return (
      <View testID="navigator">
        {selectedRoute ? <RouteMount name={selectedRoute} /> : null}
      </View>
    );
  }
  function StackScreen(_props: { name: string }) {
    return null;
  }
  function RouteMount({ name }: { name: string }) {
    React.useEffect(() => {
      mockMountedRoutes.push(name);
    }, [name]);
    return <View testID={`route-${name}`} />;
  }
  function StackProtected({
    children,
    guard,
  }: {
    children: React.ReactNode;
    guard: boolean;
  }) {
    return guard ? <>{children}</> : null;
  }
  Stack.Screen = StackScreen;
  Stack.Protected = StackProtected;

  return {
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack,
    usePathname: () => `/${mockSegments.join("/")}`,
    useSegments: () => mockSegments,
  };
});

const PRIVATE_ROUTES = [
  "(app)",
  "player",
  "account-settings",
  "preferences",
  "favorites",
  "vibe-check",
  "focus-mode",
  "dj/[id]",
  "create-dj",
  "train-dj/[id]",
];

describe("root layout ownership and route protection", () => {
  beforeEach(() => {
    mockAuthState = authState(null, false);
    mockFontState = [true, null];
    mockThemeName = "dark";
    mockNavigatorMounts = 0;
    mockNavigatorUnmounts = 0;
    mockRenderOrder = [];
    mockTourPhase = "idle";
    mockClosePanel.mockClear();
    mockSetTheme.mockClear();
    mockRequestedRoute = "(app)";
    mockMountedRoutes = [];
    mockSegments = ["(app)"];
    mockWindowWidth = 390;
  });

  it("keeps auth/player outside query, locale inside it, and global activity surfaces inside AppTour", async () => {
    mockAuthState = authState("user-a", false);
    const screen = await render(<RootLayout />);

    expect(mockRenderOrder.slice(0, 6)).toEqual([
      "auth-init",
      "player",
      "query",
      "locale",
      "activity",
      "app-tour",
    ]);
    const appTour = screen.getByTestId("provider-app-tour");
    expect(within(appTour).getByTestId("navigator")).toBeTruthy();
    expect(within(appTour).getByTestId("bottom-chrome")).toBeTruthy();
    expect(within(appTour).getByTestId("activity-panel")).toBeTruthy();
  });

  it("keeps the splash gate closed while auth initialization is unresolved", async () => {
    mockAuthState = authState(null, true);
    const screen = await render(<RootLayout />);

    expect(screen.queryByTestId("navigator")).toBeNull();
    expect(screen.queryByTestId("bottom-chrome")).toBeNull();
    expect(screen.queryByTestId("activity-panel")).toBeNull();
  });

  it("keeps the navigator behind the font readiness boundary", async () => {
    mockFontState = [false, null];
    const screen = await render(<RootLayout />);

    expect(screen.queryByTestId("root-font-loader")).toBeTruthy();
    expect(screen.queryByTestId("navigator")).toBeNull();
  });

  it("renders the app with the system-sans fallback after a font load error", async () => {
    mockFontState = [false, new Error("font load failed")];
    const log = jest.spyOn(console, "error").mockImplementation();
    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("root-font-fallback")).toBeTruthy();
    expect(screen.getByTestId("navigator")).toBeTruthy();
    expect(mockSetTheme).toHaveBeenCalledWith("darkFontFallback");

    log.mockRestore();
  });

  it("closes the activity panel when onboarding becomes active", async () => {
    mockAuthState = authState("user-a", false);
    const screen = await render(<RootLayout />);
    expect(mockClosePanel).not.toHaveBeenCalled();

    mockTourPhase = "welcome";
    await screen.rerender(<RootLayout />);

    expect(mockClosePanel).toHaveBeenCalledTimes(1);
  });

  it.each(PRIVATE_ROUTES)("selects auth without mounting the requested private route %s when signed out", async (route) => {
    mockRequestedRoute = route;
    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("route-(auth)")).toBeTruthy();
    expect(screen.queryByTestId(`route-${route}`)).toBeNull();
    expect(mockMountedRoutes).toEqual(["(auth)"]);
  });

  it.each(PRIVATE_ROUTES)("mounts the requested private route %s with a session", async (route) => {
    mockRequestedRoute = route;
    mockAuthState = authState("user-a", false);
    const screen = await render(<RootLayout />);

    expect(screen.queryByTestId("route-(auth)")).toBeNull();
    expect(screen.getByTestId(`route-${route}`)).toBeTruthy();
    expect(mockMountedRoutes).toEqual([route]);
  });

  it("remounts navigation for a direct user change but not a same-user token refresh", async () => {
    mockAuthState = authState("user-a", false, "token-a");
    const screen = await render(<RootLayout />);
    expect(mockNavigatorMounts).toBe(1);

    mockAuthState = authState("user-a", false, "token-b");
    await screen.rerender(<RootLayout />);
    expect(mockNavigatorMounts).toBe(1);
    expect(mockNavigatorUnmounts).toBe(0);

    mockAuthState = authState("user-b", false, "token-c");
    await screen.rerender(<RootLayout />);
    expect(mockNavigatorMounts).toBe(2);
    expect(mockNavigatorUnmounts).toBe(1);
  });

  it.each([
    ["player", ["player"]],
    ["focus-mode", ["focus-mode"]],
  ])("suppresses the actual desktop shell rail for the full-screen %s route", async (route, segments) => {
    mockAuthState = authState("user-a", false);
    mockRequestedRoute = route;
    mockSegments = segments;
    mockWindowWidth = 1280;
    const screen = await render(<RootLayout />);

    expect(screen.getByTestId(`route-${route}`)).toBeTruthy();
    expect(screen.queryByTestId("desktop-rail")).toBeNull();
    expect(screen.getByTestId("responsive-app-content")).not.toHaveStyle({
      paddingLeft: 88,
    });
  });

  it("keeps the actual desktop shell rail for a non-full-screen protected route", async () => {
    mockAuthState = authState("user-a", false);
    mockRequestedRoute = "create-track";
    mockSegments = ["create-track"];
    mockWindowWidth = 1280;
    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("route-create-track")).toBeTruthy();
    expect(screen.getByTestId("desktop-rail")).toBeTruthy();
    expect(screen.getByTestId("responsive-app-content")).toHaveStyle({
      paddingLeft: 88,
    });
  });
});
