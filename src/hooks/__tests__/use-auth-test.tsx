import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { authApi } from "@/src/api/auth";
import { useAuthInit } from "@/src/hooks/use-auth";
import { useAuthStore } from "@/src/stores/auth-store";

const mockUnsubscribe = jest.fn();
let mockAuthCallback:
  | ((event: AuthChangeEvent, session: Session | null) => void)
  | null = null;

jest.mock("@/src/api/auth", () => ({
  authApi: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
  },
}));

function session(userId: string, accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("useAuthInit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthCallback = null;
    useAuthStore.setState({ session: null, isLoading: true });
    jest.mocked(authApi.onAuthStateChange).mockImplementation((callback) => {
      mockAuthCallback = callback;
      return {
        data: {
          subscription: {
            id: "auth-test",
            callback,
            unsubscribe: mockUnsubscribe,
          },
        },
      };
    });
  });

  it("hydrates the initial session and opens the loading gate", async () => {
    const initial = session("user-initial", "token-initial");
    jest.mocked(authApi.getSession).mockResolvedValue(initial);

    await renderHook(() => useAuthInit());

    await waitFor(() => {
      expect(useAuthStore.getState()).toMatchObject({
        session: initial,
        isLoading: false,
      });
    });
  });

  it("clears a persisted session and opens the gate when initialization fails", async () => {
    const error = new Error("secure storage unavailable");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    useAuthStore.setState({
      session: session("user-stale", "token-stale"),
      isLoading: true,
    });
    jest.mocked(authApi.getSession).mockRejectedValue(error);

    await renderHook(() => useAuthInit());

    await waitFor(() => {
      expect(useAuthStore.getState()).toMatchObject({
        session: null,
        isLoading: false,
      });
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[useAuthInit] Failed to initialize auth:",
      error,
    );
    consoleError.mockRestore();
  });

  it("does not let a stale initial lookup overwrite a newer auth event", async () => {
    const initialLookup = deferred<Session | null>();
    const signedIn = session("user-new", "token-new");
    jest.mocked(authApi.getSession).mockReturnValue(initialLookup.promise);

    await renderHook(() => useAuthInit());

    await act(async () => {
      mockAuthCallback?.("SIGNED_IN", signedIn);
    });
    expect(useAuthStore.getState().session).toEqual(signedIn);

    await act(async () => {
      initialLookup.resolve(null);
      await initialLookup.promise;
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
    expect(useAuthStore.getState().session).toEqual(signedIn);
  });

  it("unsubscribes from auth events when the owner unmounts", async () => {
    jest.mocked(authApi.getSession).mockResolvedValue(null);
    const hook = await renderHook(() => useAuthInit());

    await waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
    await hook.unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
