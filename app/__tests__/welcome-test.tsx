/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet as RNStyleSheet } from "react-native";

import AuthLayout from "@/app/(auth)/_layout";
import WelcomeScreen from "@/app/welcome";
import { PublicProductIntro } from "@/src/components/experience/PublicProductIntro";
import {
  consumeIntroLoginPermit,
  observeIntroRouteTransition,
} from "@/src/experience/intro-login-permit";
import i18n from "@/src/i18n";

const mockRouterSetParams = jest.fn();
const mockRouterReplace = jest.fn();
const mockIntroIsSeen = jest.fn<Promise<boolean>, [number]>();
const mockIntroMarkSeen = jest.fn<Promise<void>, [number, number]>();
const mockWriteFirstTrack = jest.fn<Promise<void>, [number]>();
const mockTrackProductEvent = jest.fn<Promise<void>, [string, Record<string, unknown>]>();

let mockAuthState = { session: null as null | { user: { id: string } } };
let mockSearchParams: { step?: string | string[]; mode?: string | string[] } = { step: "1" };
let mockWindow = { width: 390, height: 844 };

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function invokePress(element: { props: { onClick?: (event: object) => void } }) {
  await act(async () => {
    element.props.onClick?.({ nativeEvent: {} });
    await Promise.resolve();
  });
}

jest.mock("@/src/stores/auth-store", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

jest.mock("@/src/experience", () => ({
  PUBLIC_INTRO_VERSION: 2,
  introStateStore: {
    isSeen: (...args: [number]) => mockIntroIsSeen(...args),
    markSeen: (...args: [number, number]) => mockIntroMarkSeen(...args),
  },
  pendingIntentStore: {
    writeFirstTrack: (...args: [number]) => mockWriteFirstTrack(...args),
  },
  trackProductEvent: (...args: [string, Record<string, unknown>]) =>
    mockTrackProductEvent(...args),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    ...mockWindow,
    scale: 1,
    fontScale: 1,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  function Stack() {
    return <View testID="auth-stack" />;
  }
  Stack.Screen = function StackScreen() {
    return null;
  };

  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Stack,
    router: {
      setParams: (...args: unknown[]) => mockRouterSetParams(...args),
      replace: (...args: unknown[]) => mockRouterReplace(...args),
    },
    useLocalSearchParams: () => mockSearchParams,
  };
});

async function renderWelcome(
  params: typeof mockSearchParams = { step: "1" },
  userId: string | null = null,
) {
  observeIntroRouteTransition(["welcome"]);
  mockSearchParams = params;
  mockAuthState = { session: userId ? { user: { id: userId } } : null };
  return render(<WelcomeScreen />);
}

describe("public three-step introduction", () => {
  beforeEach(async () => {
    observeIntroRouteTransition(["test-reset"]);
    consumeIntroLoginPermit();
    mockRouterSetParams.mockReset();
    mockRouterReplace.mockReset();
    mockIntroIsSeen.mockReset().mockResolvedValue(false);
    mockIntroMarkSeen.mockReset().mockResolvedValue(undefined);
    mockWriteFirstTrack.mockReset().mockResolvedValue(undefined);
    mockTrackProductEvent.mockReset().mockResolvedValue(undefined);
    mockAuthState = { session: null };
    mockSearchParams = { step: "1" };
    mockWindow = { width: 390, height: 844 };
    await i18n.changeLanguage("en");
  });

  it("traverses all three English pages before creating first-track intent and opening Login", async () => {
    const screen = await renderWelcome();

    expect(screen.getByRole("header", { name: "From an emotion to a track" })).toBeTruthy();
    expect(screen.getByText("Turn an idea, feeling, or moment into an original track.")).toBeTruthy();
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockRouterSetParams).toHaveBeenLastCalledWith({ step: "2" });

    mockSearchParams = { step: "2" };
    await screen.rerender(<WelcomeScreen />);
    expect(screen.getByRole("header", { name: "Choose who shapes it" })).toBeTruthy();
    expect(screen.getByText("Create a DJ with its own sound and personality.")).toBeTruthy();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockRouterSetParams).toHaveBeenLastCalledWith({ step: "3" });

    mockSearchParams = { step: "3" };
    await screen.rerender(<WelcomeScreen />);
    expect(screen.getByRole("header", { name: "Listen, save, and share" })).toBeTruthy();
    expect(screen.getByText("Keep your result close and share it when it feels right.")).toBeTruthy();
    expect(screen.getByText("Page 3 of 3")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Create my first track" }));

    expect(mockWriteFirstTrack).toHaveBeenCalledTimes(1);
    expect(mockIntroMarkSeen).toHaveBeenCalledWith(2, expect.any(Number));
    expect(mockWriteFirstTrack.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterReplace.mock.invocationCallOrder[0]!,
    );
    expect(mockIntroMarkSeen.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterReplace.mock.invocationCallOrder[0]!,
    );
    expect(mockRouterReplace).toHaveBeenCalledWith("/login");
  });

  it("renders the exact Spanish copy through the same component and route", async () => {
    await i18n.changeLanguage("es");
    const screen = await renderWelcome({ step: "3" });

    expect(screen.getByRole("header", { name: "Escucha, guarda y comparte" })).toBeTruthy();
    expect(screen.getByText("Página 3 de 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Crear mi primer track" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ya tengo una cuenta" })).toBeTruthy();
  });

  it("moves backward through route-owned step history", async () => {
    const screen = await renderWelcome({ step: "3" });

    await fireEvent.press(screen.getByRole("button", { name: "Back" }));

    expect(mockRouterSetParams).toHaveBeenCalledWith({ step: "2" });
  });

  it("marks the intro seen for an existing account without creating intent", async () => {
    const screen = await renderWelcome({ step: "1" });

    await fireEvent.press(screen.getByRole("button", { name: "I already have an account" }));

    expect(mockIntroMarkSeen).toHaveBeenCalledWith(2, expect.any(Number));
    expect(mockWriteFirstTrack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith("/login");
  });

  it("canonicalizes invalid route steps to one without writing installation state or intent", async () => {
    const screen = await renderWelcome({ step: "7" });

    await waitFor(() => {
      expect(mockRouterSetParams).toHaveBeenCalledWith({ step: "1" });
    });
    expect(screen.getByRole("header", { name: "From an emotion to a track" })).toBeTruthy();
    expect(mockIntroMarkSeen).not.toHaveBeenCalled();
    expect(mockWriteFirstTrack).not.toHaveBeenCalled();
  });

  it("keeps authenticated replay isolated from both stores", async () => {
    const screen = await renderWelcome({ step: "3", mode: "replay" }, "user-a");

    await fireEvent.press(screen.getByRole("button", { name: "Create my first track" }));

    expect(mockIntroMarkSeen).not.toHaveBeenCalled();
    expect(mockWriteFirstTrack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith("/(app)");
  });

  it.each([1, 2, 3] as const)(
    "keeps the existing-account action visible and store-free on replay page %s",
    async (step) => {
      const screen = await renderWelcome(
        { step: String(step), mode: "replay" },
        "user-a",
      );

      await fireEvent.press(
        screen.getByRole("button", { name: "I already have an account" }),
      );

      expect(mockIntroMarkSeen).not.toHaveBeenCalled();
      expect(mockWriteFirstTrack).not.toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).toHaveBeenCalledWith("/(app)");
    },
  );

  it("rejects signed-out replay and redirects authenticated non-replay visits Home", async () => {
    const signedOut = await renderWelcome({ step: "1", mode: "replay" });
    expect(signedOut.getByText("redirect:/login")).toBeTruthy();
    await signedOut.unmount();

    const signedIn = await renderWelcome({ step: "1" }, "user-a");
    expect(signedIn.getByText("redirect:/(app)")).toBeTruthy();
  });

  it("continues to Login after storage failure and records only bounded non-content telemetry", async () => {
    mockWriteFirstTrack.mockRejectedValueOnce(new Error("raw storage secret"));
    mockIntroMarkSeen.mockRejectedValueOnce(new Error("raw intro payload"));
    const screen = await renderWelcome({ step: "3" });

    await fireEvent.press(screen.getByRole("button", { name: "Create my first track" }));

    expect(mockRouterReplace).toHaveBeenCalledWith("/login");
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "auth_failed",
      expect.objectContaining({ errorCategory: "unknown", flowVersion: 2 }),
    );
    expect(mockTrackProductEvent.mock.calls.flat()).not.toEqual(
      expect.arrayContaining([expect.stringContaining("raw")]),
    );

    observeIntroRouteTransition(["(auth)", "login"]);
    mockIntroIsSeen.mockResolvedValue(false);
    const auth = await render(<AuthLayout />);
    expect(await auth.findByTestId("auth-stack")).toBeTruthy();
    expect(auth.queryByText("redirect:/welcome?step=1")).toBeNull();
    await screen.unmount();
  });

  it("locks completion across double taps and primary-to-secondary races while storage settles", async () => {
    const intentWrite = deferred<void>();
    const introWrite = deferred<void>();
    mockWriteFirstTrack.mockReturnValue(intentWrite.promise);
    mockIntroMarkSeen.mockReturnValue(introWrite.promise);
    const screen = await renderWelcome({ step: "3" });
    const primary = screen.getByRole("button", { name: "Create my first track" });
    const existing = screen.getByRole("button", { name: "I already have an account" });

    await invokePress(primary);

    expect(mockWriteFirstTrack).toHaveBeenCalledTimes(1);
    expect(mockIntroMarkSeen).toHaveBeenCalledTimes(1);
    for (const name of ["Back", "Create my first track", "I already have an account"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }

    await invokePress(primary);
    await invokePress(existing);
    expect(mockWriteFirstTrack).toHaveBeenCalledTimes(1);
    expect(mockIntroMarkSeen).toHaveBeenCalledTimes(1);

    await act(async () => {
      intentWrite.resolve();
      introWrite.resolve();
      await Promise.all([intentWrite.promise, introWrite.promise]);
    });

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith("/login");
  });

  it("abandons a pending completion without stale navigation or a later Login bypass", async () => {
    const intentWrite = deferred<void>();
    const introWrite = deferred<void>();
    mockWriteFirstTrack.mockReturnValue(intentWrite.promise);
    mockIntroMarkSeen.mockReturnValue(introWrite.promise);
    const screen = await renderWelcome({ step: "3" });

    await invokePress(screen.getByRole("button", { name: "Create my first track" }));
    await screen.unmount();
    await act(async () => {
      intentWrite.resolve();
      introWrite.resolve();
      await Promise.all([intentWrite.promise, introWrite.promise]);
    });

    expect(mockRouterReplace).not.toHaveBeenCalled();
    mockIntroIsSeen.mockResolvedValue(false);
    const auth = await render(<AuthLayout />);
    expect(await auth.findByText("redirect:/welcome?step=1")).toBeTruthy();
    expect(auth.queryByTestId("auth-stack")).toBeNull();
  });

  it("expires an unused completion permit before an unrelated later Login mount", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const screen = await renderWelcome({ step: "3" });
    await fireEvent.press(screen.getByRole("button", { name: "Create my first track" }));
    expect(mockRouterReplace).toHaveBeenCalledWith("/login");

    now.mockReturnValue(1_060_000);
    observeIntroRouteTransition(["(auth)", "login"]);
    mockIntroIsSeen.mockResolvedValue(false);
    const auth = await render(<AuthLayout />);

    expect(await auth.findByText("redirect:/welcome?step=1")).toBeTruthy();
    expect(auth.queryByTestId("auth-stack")).toBeNull();
    await screen.unmount();
    now.mockRestore();
  });

  it("cancels the Login bypass when router replacement fails", async () => {
    mockRouterReplace.mockImplementationOnce(() => {
      throw new Error("router unavailable");
    });
    const screen = await renderWelcome({ step: "3" });

    await fireEvent.press(screen.getByRole("button", { name: "Create my first track" }));

    expect(mockWriteFirstTrack).toHaveBeenCalledTimes(1);
    expect(mockIntroMarkSeen).toHaveBeenCalledTimes(1);
    expect(consumeIntroLoginPermit()).toBe(false);
    mockIntroIsSeen.mockResolvedValue(false);
    const auth = await render(<AuthLayout />);
    expect(await auth.findByText("redirect:/welcome?step=1")).toBeTruthy();
  });

  it("uses top-aligned scroll flow below 600px while preserving one readable card", async () => {
    mockWindow = { width: 720, height: 599 };
    const screen = await render(
      <PublicProductIntro
        step={1}
        mode="first-run"
        callbacks={{
          onBack: jest.fn(),
          onContinue: jest.fn(),
          onCreate: jest.fn(),
          onExistingAccount: jest.fn(),
        }}
      />,
    );

    expect(screen.getByTestId("public-intro-scroll")).toBeTruthy();
    expect(
      RNStyleSheet.flatten(screen.getByTestId("public-intro-content").props.style),
    ).toEqual(expect.objectContaining({ justifyContent: "flex-start" }));
    expect(RNStyleSheet.flatten(screen.getByTestId("public-intro-card").props.style))
      .toEqual(expect.objectContaining({ maxWidth: 720, width: "100%" }));
    expect(screen.getAllByTestId("public-intro-primary-action")).toHaveLength(1);
  });

  it("gives every visible action a minimum 44 by 44 target and accessible names", async () => {
    const screen = await render(
      <PublicProductIntro
        step={2}
        mode="first-run"
        callbacks={{
          onBack: jest.fn(),
          onContinue: jest.fn(),
          onCreate: jest.fn(),
          onExistingAccount: jest.fn(),
        }}
      />,
    );

    for (const name of ["Back", "Continue", "I already have an account"]) {
      const action = screen.getByRole("button", { name });
      const style = RNStyleSheet.flatten(action.props.style);
      expect(style.minWidth ?? style.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(style.minHeight ?? style.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});

describe("auth intro eligibility gate", () => {
  beforeEach(() => {
    observeIntroRouteTransition(["test-reset"]);
    consumeIntroLoginPermit();
    mockAuthState = { session: null };
    mockIntroIsSeen.mockReset();
    mockTrackProductEvent.mockReset().mockResolvedValue(undefined);
  });

  it("renders neither Login nor welcome before eligibility resolves", async () => {
    mockIntroIsSeen.mockReturnValue(new Promise(() => undefined));
    const screen = await render(<AuthLayout />);

    expect(screen.queryByTestId("auth-stack")).toBeNull();
    expect(screen.queryByText("redirect:/welcome?step=1")).toBeNull();
  });

  it("redirects an unseen signed-out installation to the first intro page", async () => {
    mockIntroIsSeen.mockResolvedValue(false);
    const screen = await render(<AuthLayout />);

    expect(await screen.findByText("redirect:/welcome?step=1")).toBeTruthy();
    expect(screen.queryByTestId("auth-stack")).toBeNull();
  });

  it("renders Login only after a seen installation is eligible", async () => {
    mockIntroIsSeen.mockResolvedValue(true);
    const screen = await render(<AuthLayout />);

    expect(await screen.findByTestId("auth-stack")).toBeTruthy();
    expect(screen.queryByText("redirect:/welcome?step=1")).toBeNull();
  });

  it("does not block Login when eligibility storage cannot be read", async () => {
    mockIntroIsSeen.mockRejectedValue(new Error("private storage contents"));
    const screen = await render(<AuthLayout />);

    expect(await screen.findByTestId("auth-stack")).toBeTruthy();
  });
});
