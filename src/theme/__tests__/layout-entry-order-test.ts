test("configures the theme before the root layout evaluates styled components", () => {
  const evaluationOrder: string[] = [];
  jest.resetModules();
  jest.doMock("@/src/theme", () => {
    evaluationOrder.push("theme");
    return {};
  });
  jest.doMock("@/src/theme/react-native-unistyles", () => ({
    StyleSheet: { create: (styles: object) => styles },
    useUnistyles: () => ({ theme: {}, rt: {} }),
  }));
  jest.doMock("@/src/components/BottomChrome", () => {
    evaluationOrder.push("styled-component");
    return { BottomChrome: () => null };
  });
  jest.doMock("@/src/activity", () => ({
    ActivityProvider: ({ children }: { children: unknown }) => children,
    useActivity: () => ({ closePanel: jest.fn() }),
  }));
  jest.doMock("@/src/api/query-provider", () => ({
    QueryProvider: ({ children }: { children: unknown }) => children,
  }));
  jest.doMock("@/src/audio/player-provider", () => ({
    PlayerProvider: ({ children }: { children: unknown }) => children,
  }));
  jest.doMock("@/src/components/ConfirmDialog", () => ({ ConfirmDialogHost: () => null }));
  jest.doMock("@/src/components/Toast", () => ({ ToastHost: () => null }));
  jest.doMock("@/src/components/activity/ActivityPanel", () => ({ ActivityPanel: () => null }));
  jest.doMock("@/src/hooks/use-auth", () => ({ useAuthInit: jest.fn() }));
  jest.doMock("@/src/i18n/LocaleProvider", () => ({
    LocaleProvider: ({ children }: { children: unknown }) => children,
  }));
  jest.doMock("@/src/onboarding", () => ({
    AppTourProvider: ({ children }: { children: unknown }) => children,
    useAppTour: () => ({ phase: "idle" }),
  }));
  jest.doMock("@/src/stores/auth-store", () => ({
    useAuthStore: (selector: (state: object) => unknown) =>
      selector({ session: null, isLoading: false }),
  }));
  jest.doMock("expo-router", () => ({
    Stack: Object.assign(() => null, { Screen: () => null, Protected: () => null }),
  }));
  jest.doMock("expo-status-bar", () => ({ StatusBar: () => null }));
  jest.doMock("react-native-gesture-handler", () => ({
    GestureHandlerRootView: ({ children }: { children: unknown }) => children,
  }));

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/app/_layout");
  });

  expect(evaluationOrder).toEqual(["theme", "styled-component"]);
});
