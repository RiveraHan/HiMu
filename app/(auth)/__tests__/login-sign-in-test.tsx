import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import LoginScreen from "@/app/(auth)/login";
import { authApi } from "@/src/api/auth";
import i18n from "@/src/i18n";

const mockToastError = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

jest.mock("@/src/api/auth", () => ({
  authApi: { signInWithGoogle: jest.fn() },
}));

jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ next: jest.fn(), prev: jest.fn(), toggle: jest.fn() }),
}));

jest.mock("expo-audio", () => ({
  useAudioPlayer: jest.fn(),
  useAudioPlayerStatus: jest.fn(),
}));

jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({ error: mockToastError, info: jest.fn() }),
}));

describe("LoginScreen Google sign-in", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockToastError.mockClear();
    jest.mocked(authApi.signInWithGoogle).mockReset();
  });

  it("makes a pending sign-in busy and prevents a second request", async () => {
    const signIn = deferred<null>();
    jest.mocked(authApi.signInWithGoogle).mockReturnValue(signIn.promise);
    const screen = await render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
      await Promise.resolve();
    });

    const pendingButton = screen.getByRole("button", { name: "Signing in..." });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton.props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
    await fireEvent.press(pendingButton);
    expect(authApi.signInWithGoogle).toHaveBeenCalledTimes(1);

    await act(async () => {
      signIn.resolve(null);
      await signIn.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    });
  });

  it("shows safe feedback for a rejected sign-in and permits a retry", async () => {
    const providerError = new Error("provider details must not reach the user");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest
      .mocked(authApi.signInWithGoogle)
      .mockRejectedValueOnce(providerError)
      .mockResolvedValueOnce(null);
    const screen = await render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Sign-in failed",
        "We couldn't sign you in. Please try again.",
      );
    });
    expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining("provider details"));

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    });
    await waitFor(() => {
      expect(authApi.signInWithGoogle).toHaveBeenCalledTimes(2);
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[LoginScreen] Google sign-in error:",
      providerError,
    );
    consoleError.mockRestore();
  });
});
