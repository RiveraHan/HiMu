/* eslint-disable @typescript-eslint/no-require-imports */
import { render, within } from "@testing-library/react-native";

import RootLayout from "@/app/_layout";
import {
  beginIntroLoginHandoff,
  consumeIntroLoginPermit,
  observeIntroRouteTransition,
  registerIntroLoginOrigin,
} from "@/src/experience/intro-login-permit";

let mockFontState: [boolean, Error | null] = [true, null];
let mockThemeName = "dark";
let mockAuthState = authState(null, false);
let mockNavigatorMounts = 0;
let mockNavigatorUnmounts = 0;
let mockRenderOrder: string[] = [];
let mockTourPhase = "idle";
const mockClosePanel = jest.fn();
const mockSetTheme = jest.fn();
const mockIntroIsSeen = jest.fn<Promise<boolean>, [number]>();
const mockTrackProductEvent = jest.fn();
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
jest.mock("@/src/experience/PostAuthIntentRouter", () => ({
  PostAuthIntentRouter: () => {
    const { View } = require("react-native");
    return <View testID="post-auth-intent-router" />;
  },
}));
jest.mock("@/src/experience", () => ({
  PUBLIC_INTRO_VERSION: 2,
  introStateStore: {
    isSeen: (...args: [number]) => mockIntroIsSeen(...args),
  },
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
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
    withUnistyles: (Component: React.ComponentType) => Component,
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
    if (eligibleRoutes.length === 0) {
      return <View testID="auth-stack" />;
    }
    const selectedRoute = eligibleRoutes.includes(mockRequestedRoute)
      ? mockRequestedRoute
      : eligibleRoutes[0] ?? null;
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
    const AuthLayout = name === "(auth)"
      ? require("@/app/(auth)/_layout").default
      : null;
    return (
      <View testID={`route-${name}`}>
        {AuthLayout ? <AuthLayout /> : null}
      </View>
    );
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
    Redirect: ({ href }: { href: string }) => (
      <View testID={`redirect-${href}`} />
    ),
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
  "first-track",
  "dj/[id]",
  "create-dj",
  "train-dj/[id]",
];

describe("root layout ownership and route protection", () => {
  beforeEach(() => {
    observeIntroRouteTransition(["test-reset"]);
    consumeIntroLoginPermit();
    mockAuthState = authState(null, false);
    mockFontState = [true, null];
    mockThemeName = "dark";
    mockNavigatorMounts = 0;
    mockNavigatorUnmounts = 0;
    mockRenderOrder = [];
    mockTourPhase = "idle";
    mockClosePanel.mockClear();
    mockSetTheme.mockClear();
    mockIntroIsSeen.mockReset().mockResolvedValue(true);
    mockTrackProductEvent.mockReset().mockResolvedValue(undefined);
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
    expect(within(appTour).getByTestId("post-auth-intent-router")).toBeTruthy();
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

  it("closes the activity panel when the full-screen welcome route opens", async () => {
    mockAuthState = authState("user-a", false);
    mockRequestedRoute = "welcome";
    mockSegments = ["welcome"];

    await render(<RootLayout />);

    expect(mockClosePanel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["auth", null, "(auth)", ["(auth)", "login"]],
    ["welcome", null, "welcome", ["welcome"]],
    ["public track", null, "track/[id]", ["track", "track-id"]],
    ["first-track", "user-a", "first-track", ["first-track"]],
  ] as const)(
    "does not mount ActivityPanel on the chrome-hidden %s route",
    async (_label, userId, requestedRoute, segments) => {
      mockAuthState = authState(userId, false);
      mockRequestedRoute = requestedRoute;
      mockSegments = [...segments];

      const screen = await render(<RootLayout />);

      expect(screen.queryByTestId("activity-panel")).toBeNull();
    },
  );

  it("routes an unseen signed-out root fallback through auth eligibility to welcome", async () => {
    mockRequestedRoute = "root";
    mockSegments = [];
    mockIntroIsSeen.mockResolvedValue(false);

    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("route-(auth)")).toBeTruthy();
    expect(await screen.findByTestId("redirect-/welcome?step=1")).toBeTruthy();
    expect(screen.queryByTestId("route-welcome")).toBeNull();
  });

  it("keeps a seen signed-out root fallback in the auth navigator", async () => {
    mockRequestedRoute = "root";
    mockSegments = [];
    mockIntroIsSeen.mockResolvedValue(true);

    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("route-(auth)")).toBeTruthy();
    expect(await screen.findByTestId("auth-stack")).toBeTruthy();
    expect(screen.queryByTestId("route-welcome")).toBeNull();
  });

  it("returns through auth eligibility when a protected root loses its session", async () => {
    mockAuthState = authState("user-a", false);
    mockRequestedRoute = "(app)";
    mockSegments = ["(app)"];
    const screen = await render(<RootLayout />);
    expect(screen.getByTestId("route-(app)")).toBeTruthy();

    mockAuthState = authState(null, false);
    mockIntroIsSeen.mockResolvedValue(true);
    await screen.rerender(<RootLayout />);

    expect(screen.getByTestId("route-(auth)")).toBeTruthy();
    expect(await screen.findByTestId("auth-stack")).toBeTruthy();
    expect(screen.queryByTestId("route-welcome")).toBeNull();
  });

  it.each(PRIVATE_ROUTES)("selects auth without mounting the requested private route %s when signed out", async (route) => {
    mockRequestedRoute = route;
    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("route-(auth)")).toBeTruthy();
    expect(screen.queryByTestId(`route-${route}`)).toBeNull();
    expect(mockMountedRoutes).toEqual(["(auth)"]);
  });

  it("declares welcome as a public route for signed-out first-run and signed-in replay", async () => {
    mockRequestedRoute = "welcome";
    mockSegments = ["welcome"];
    const signedOut = await render(<RootLayout />);

    expect(signedOut.getByTestId("route-welcome")).toBeTruthy();
    expect(signedOut.queryByTestId("route-(auth)")).toBeNull();
    await signedOut.unmount();

    mockAuthState = authState("user-a", false);
    mockWindowWidth = 1280;
    const signedIn = await render(<RootLayout />);
    expect(signedIn.getByTestId("route-welcome")).toBeTruthy();
    expect(signedIn.queryByTestId("route-(app)")).toBeNull();
    expect(signedIn.queryByTestId("desktop-rail")).toBeNull();
  });

  it("declares the shared track landing as public without exposing private routes", async () => {
    mockRequestedRoute = "track/[id]";
    mockSegments = ["track", "track-id"];

    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("route-track/[id]")).toBeTruthy();
    expect(screen.queryByTestId("route-(auth)")).toBeNull();
    expect(screen.queryByTestId("route-(app)")).toBeNull();
  });

  it("observes the exact welcome-to-Login transition for the scoped handoff", async () => {
    mockRequestedRoute = "welcome";
    mockSegments = ["welcome"];
    const screen = await render(<RootLayout />);
    const origin = Symbol("root-welcome-origin");
    registerIntroLoginOrigin(origin);
    expect(beginIntroLoginHandoff(origin)).toBe(true);

    mockRequestedRoute = "(auth)";
    mockSegments = ["(auth)", "login"];
    await screen.rerender(<RootLayout />);

    expect(await screen.findByTestId("auth-stack")).toBeTruthy();
    expect(screen.queryByTestId("redirect-/welcome?step=1")).toBeNull();
    expect(consumeIntroLoginPermit()).toBe(false);
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
    ["first-track", ["first-track"]],
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
