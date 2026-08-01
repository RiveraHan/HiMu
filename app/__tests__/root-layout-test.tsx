/* eslint-disable @typescript-eslint/no-require-imports */
import { render, within } from "@testing-library/react-native";

import RootLayout from "@/app/_layout";

let mockAuthState = authState(null, false);
let mockNavigatorMounts = 0;
let mockNavigatorUnmounts = 0;
let mockRenderOrder: string[] = [];
let mockTourPhase = "idle";
const mockClosePanel = jest.fn();

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
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => {
    const { View } = require("react-native");
    return <View>{children}</View>;
  },
}));

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@/src/theme", () => ({}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  function Stack({ children }: { children: React.ReactNode }) {
    React.useEffect(() => {
      mockNavigatorMounts += 1;
      return () => {
        mockNavigatorUnmounts += 1;
      };
    }, []);
    return <View testID="navigator">{children}</View>;
  }
  function StackScreen({ name }: { name: string }) {
    return <View testID={`screen-${name}`} />;
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

  return { Stack };
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
    mockNavigatorMounts = 0;
    mockNavigatorUnmounts = 0;
    mockRenderOrder = [];
    mockTourPhase = "idle";
    mockClosePanel.mockClear();
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

  it("closes the activity panel when onboarding becomes active", async () => {
    mockAuthState = authState("user-a", false);
    mockTourPhase = "welcome";

    await render(<RootLayout />);

    expect(mockClosePanel).toHaveBeenCalledTimes(1);
  });

  it.each(PRIVATE_ROUTES)("blocks the private route declaration %s when signed out", async (route) => {
    const screen = await render(<RootLayout />);

    expect(screen.getByTestId("screen-(auth)")).toBeTruthy();
    expect(screen.queryByTestId(`screen-${route}`)).toBeNull();
  });

  it.each(PRIVATE_ROUTES)("makes the private route declaration %s available with a session", async (route) => {
    mockAuthState = authState("user-a", false);
    const screen = await render(<RootLayout />);

    expect(screen.queryByTestId("screen-(auth)")).toBeNull();
    expect(screen.getByTestId(`screen-${route}`)).toBeTruthy();
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
});
