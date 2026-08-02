import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import {
  focusManager,
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { QueryProvider } from "../query-provider";
import { useAuthStore } from "@/src/stores/auth-store";
import type { Session } from "@supabase/supabase-js";
import {
  authMutationKey,
  isCurrentMutationUser,
} from "../auth-scope";
import { getOrCreatePreferenceCommitQueue } from "@/src/hooks/preference-commit-queue";
import type { MusicPreferences } from "@/src/types/music-preferences";

let mockNetInfoListener: ((state: NetInfoState) => void) | undefined;
const mockNetInfoUnsubscribe = jest.fn();

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((listener: (state: NetInfoState) => void) => {
      mockNetInfoListener = listener;
      return mockNetInfoUnsubscribe;
    }),
  },
}));

const originalExpoOs = process.env.EXPO_OS;
const originalOnline = onlineManager.isOnline();
const originalFocused = focusManager.isFocused();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  process.env.EXPO_OS = originalExpoOs;
  onlineManager.setOnline(originalOnline);
  focusManager.setFocused(originalFocused);
  jest.restoreAllMocks();
  mockNetInfoUnsubscribe.mockClear();
  useAuthStore.setState({ session: null });
});

test("forwards NetInfo offline and online events to TanStack onlineManager", async () => {
  const { unmount } = await renderHook(() => useQueryClient(), {
    wrapper: QueryProvider,
  });
  await waitFor(() => expect(NetInfo.addEventListener).toHaveBeenCalled());
  expect(mockNetInfoListener).toBeDefined();

  await act(() => {
    mockNetInfoListener!({ isConnected: false } as NetInfoState);
  });
  expect(onlineManager.isOnline()).toBe(false);

  await act(() => {
    mockNetInfoListener!({ isConnected: true } as NetInfoState);
  });
  expect(onlineManager.isOnline()).toBe(true);
  await unmount();
  expect(mockNetInfoUnsubscribe).toHaveBeenCalledTimes(1);
});

test("forwards native AppState changes to focusManager and removes the listener", async () => {
  process.env.EXPO_OS = "ios";
  let appStateListener: ((status: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove };
  });

  const { result, unmount } = await renderHook(() => useQueryClient(), {
    wrapper: QueryProvider,
  });
  expect(result.current).toBeDefined();
  await waitFor(() => expect(appStateListener).toBeDefined());

  await act(() => appStateListener!("background"));
  expect(focusManager.isFocused()).toBe(false);
  await act(() => appStateListener!("active"));
  expect(focusManager.isFocused()).toBe(true);

  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

function session(userId: string, token: string): Session {
  return {
    access_token: token,
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

test("uses a fresh private client at each auth identity boundary", async () => {
  useAuthStore.setState({ session: session("A", "token-a") });
  const hook = await renderHook(() => useQueryClient(), {
    wrapper: QueryProvider,
  });
  const clientA = hook.result.current;
  clientA.setQueryData(["private"], "A optimistic");

  await act(() =>
    useAuthStore.setState({ session: session("B", "token-b") }),
  );
  const clientB = hook.result.current;

  expect(clientB).not.toBe(clientA);
  expect(clientB.getQueryData(["private"])).toBeUndefined();
  clientB.setQueryData(["private"], "B success");

  await act(() =>
    useAuthStore.setState({ session: session("B", "token-b-refreshed") }),
  );
  expect(hook.result.current).toBe(clientB);
  expect(hook.result.current.getQueryData(["private"])).toBe("B success");

  await act(() =>
    useAuthStore.setState({ session: session("A", "token-a-new") }),
  );
  expect(hook.result.current).not.toBe(clientA);
  expect(hook.result.current.getQueryData(["private"])).toBeUndefined();
});

function useAccountRuntime(
  mutationFn: (ownerUserId: string) => Promise<{ ownerUserId: string }>,
  onVisibleSuccess: (ownerUserId: string) => void,
) {
  const userId = useAuthStore((state) => state.session?.user.id ?? "signed-out");
  const queryClient = useQueryClient();
  const accountQuery = useQuery({
    queryKey: ["account-query", userId],
    queryFn: async () => `${userId} query`,
    retry: false,
  });
  const mutation = useMutation({
    mutationKey: authMutationKey("runtime-test", userId),
    mutationFn: () => mutationFn(userId),
    onSuccess: (result) => {
      if (!isCurrentMutationUser(result.ownerUserId)) return;
      queryClient.setQueryData(
        ["account-side-effect", result.ownerUserId],
        "visible",
      );
      onVisibleSuccess(result.ownerUserId);
    },
  });
  return { userId, queryClient, accountQuery, mutation };
}

test("drops an offline A mutation at the identity boundary and reconnects only B", async () => {
  onlineManager.setOnline(false);
  const mutationFn = jest.fn(async (ownerUserId: string) => ({ ownerUserId }));
  const onVisibleSuccess = jest.fn();
  useAuthStore.setState({ session: session("A", "token-a") });
  const hook = await renderHook(
    () => useAccountRuntime(mutationFn, onVisibleSuccess),
    { wrapper: QueryProvider },
  );
  const clientA = hook.result.current.queryClient;

  await act(() => hook.result.current.mutation.mutate());
  await waitFor(() => expect(hook.result.current.mutation.isPaused).toBe(true));
  expect(mutationFn).not.toHaveBeenCalled();

  await act(() =>
    useAuthStore.setState({ session: session("B", "token-b") }),
  );
  const clientB = hook.result.current.queryClient;
  expect(clientB).not.toBe(clientA);

  await act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(hook.result.current.accountQuery.data).toBe("B query"));
  expect(mutationFn).not.toHaveBeenCalled();
  expect(onVisibleSuccess).not.toHaveBeenCalled();
  expect(clientB.getQueryData(["account-side-effect", "A"])).toBeUndefined();
});

test("a started A completion cannot publish cache or visible side effects into B", async () => {
  let resolveA!: (value: { ownerUserId: string }) => void;
  const mutationFn = jest.fn(
    () =>
      new Promise<{ ownerUserId: string }>((resolve) => {
        resolveA = resolve;
      }),
  );
  const onVisibleSuccess = jest.fn();
  useAuthStore.setState({ session: session("A", "token-a") });
  const hook = await renderHook(
    () => useAccountRuntime(mutationFn, onVisibleSuccess),
    { wrapper: QueryProvider },
  );
  const clientA = hook.result.current.queryClient;

  await act(async () => {
    hook.result.current.mutation.mutate();
    await Promise.resolve();
  });
  expect(mutationFn).toHaveBeenCalledWith("A");

  await act(() =>
    useAuthStore.setState({ session: session("B", "token-b") }),
  );
  const clientB = hook.result.current.queryClient;
  await waitFor(() => expect(hook.result.current.accountQuery.data).toBe("B query"));

  await act(async () => {
    resolveA({ ownerUserId: "A" });
    await Promise.resolve();
  });

  expect(clientB).not.toBe(clientA);
  expect(onVisibleSuccess).not.toHaveBeenCalled();
  expect(clientB.getQueryData(["account-side-effect", "A"])).toBeUndefined();
  expect(clientB.getQueryData(["account-query", "B"])).toBe("B query");
});

const preferenceBaseline: MusicPreferences = {
  genres: [],
  excludedMoods: [],
  vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
  aiFrequency: "optimal",
  discoveryDepth: false,
};

test("disposes A's preference queue before clearing its runtime at the identity boundary", async () => {
  const firstSave = deferred<void>();
  const persist = jest.fn(() => firstSave.promise);
  const onFailure = jest.fn();
  useAuthStore.setState({ session: session("A", "token-a") });
  const hook = await renderHook(() => {
    const userId = useAuthStore(
      (state) => state.session?.user.id ?? "signed-out",
    );
    const queryClient = useQueryClient();
    const queryKey = ["music-preferences", userId] as const;
    const queue = getOrCreatePreferenceCommitQueue(queryClient, userId, {
      baseline: preferenceBaseline,
      cancel: () => queryClient.cancelQueries({ queryKey }),
      writeOptimistic: (next) => queryClient.setQueryData(queryKey, next),
      persist,
      invalidate: () => queryClient.invalidateQueries({ queryKey }),
      onFailure,
    });
    return { queryClient, queue };
  }, { wrapper: QueryProvider });
  const clientA = hook.result.current.queryClient;

  await act(async () => {
    hook.result.current.queue.commit((current) => ({
      ...current,
      genres: ["Ambient"],
    }));
    hook.result.current.queue.commit((current) => ({
      ...current,
      excludedMoods: ["Focus"],
    }));
    await Promise.resolve();
  });
  expect(persist).toHaveBeenCalledTimes(1);

  await act(() =>
    useAuthStore.setState({ session: session("B", "token-b") }),
  );
  const clientB = hook.result.current.queryClient;
  expect(clientB).not.toBe(clientA);
  expect(clientA.getQueryData(["music-preferences", "A"])).toBeUndefined();

  await act(async () => {
    firstSave.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(persist).toHaveBeenCalledTimes(1);
  expect(clientA.getQueryData(["music-preferences", "A"])).toBeUndefined();
  expect(clientB.getQueryData(["music-preferences", "A"])).toBeUndefined();
  expect(clientB.getQueryData(["music-preferences", "B"])).toBeUndefined();
  expect(onFailure).not.toHaveBeenCalled();
  await hook.unmount();
});
