import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useCurrentUser } from "@/src/hooks/use-auth";
import { activityMutationKeys } from "../mutation-keys";
import {
  normalizeMutationActivities,
  useSessionActivities,
  type MutationActivityState,
} from "../use-session-activities";

jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: jest.fn() }));

const BASE_MS = Date.parse("2026-07-29T12:00:00.000Z");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function client() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

function state(
  overrides: Partial<MutationActivityState> = {},
): MutationActivityState {
  return {
    mutationId: 7,
    kind: "create-dj",
    keyUserId: "user-a",
    submittedUserId: "user-a",
    status: "pending",
    isPaused: false,
    submittedAt: BASE_MS,
    variables: { name: "Luna" },
    data: undefined,
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useRealTimers();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(Date, "now").mockReturnValue(BASE_MS);
  jest.mocked(useCurrentUser).mockReturnValue({ id: "user-a" } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("keeps observing an in-flight create after its origin unmounts and reports the returned destination", async () => {
  const queryClient = client();
  const request = deferred<{ djId: string; avatarReady: boolean }>();
  const origin = await renderHook(
    () =>
      useMutation({
        mutationKey: activityMutationKeys.createDj("user-a"),
        gcTime: Infinity,
        mutationFn: (_variables: { name: string }) => request.promise,
        onMutate: () => ({ submittedUserId: "user-a" }),
      }),
    { wrapper: wrapper(queryClient) },
  );
  const observer = await renderHook(() => useSessionActivities(), {
    wrapper: wrapper(queryClient),
  });

  act(() => origin.result.current.mutate({ name: "Luna" }));
  await waitFor(() =>
    expect(observer.result.current).toEqual([
      expect.objectContaining({
        source: "mutation",
        kind: "create-dj",
        status: "running",
        title: "Luna",
        createdAt: "2026-07-29T12:00:00.000Z",
        updatedAt: "2026-07-29T12:00:00.000Z",
      }),
    ]),
  );

  await origin.unmount();
  await act(async () => {
    request.resolve({ djId: "dj-luna", avatarReady: true });
    await request.promise;
  });
  await waitFor(() =>
    expect(observer.result.current[0]).toEqual(
      expect.objectContaining({ status: "ready", djId: "dj-luna" }),
    ),
  );
  act(() => {
    const cache = queryClient.getMutationCache();
    cache.getAll().forEach((mutation) => cache.remove(mutation));
  });
  await waitFor(() => expect(observer.result.current).toEqual([]));
  await observer.unmount();
});

test("normalizes queued, running, and slow without changing active timestamps", () => {
  jest.restoreAllMocks();
  jest.useFakeTimers().setSystemTime(BASE_MS);

  const queued = normalizeMutationActivities({
    states: [state({ isPaused: true })],
    userId: "user-a",
    nowMs: BASE_MS + 31_000,
    settledAtById: new Map(),
  }).items[0];
  const beforeSlow = normalizeMutationActivities({
    states: [state()],
    userId: "user-a",
    nowMs: BASE_MS + 29_999,
    settledAtById: new Map(),
  }).items[0];
  const slow = normalizeMutationActivities({
    states: [state()],
    userId: "user-a",
    nowMs: BASE_MS + 30_000,
    settledAtById: new Map(),
  }).items[0];

  expect(queued.status).toBe("queued");
  expect(beforeSlow.status).toBe("running");
  expect(slow.status).toBe("slow");
  expect(slow.updatedAt).toBe("2026-07-29T12:00:00.000Z");
});

test("filters both identity boundaries and uses mutation IDs to distinguish same-millisecond submissions", () => {
  const normalized = normalizeMutationActivities({
    states: [
      state({ mutationId: 1 }),
      state({ mutationId: 2, variables: { name: "Nova" } }),
      state({ mutationId: 3, keyUserId: "user-b" }),
      state({ mutationId: 4, submittedUserId: "user-b" }),
    ],
    userId: "user-a",
    nowMs: BASE_MS,
    settledAtById: new Map(),
  });

  expect(normalized.items.map(({ id }) => id)).toEqual([
    "mutation:create-dj:1",
    "mutation:create-dj:2",
  ]);
  expect(normalized.items.map(({ title }) => title)).toEqual(["Luna", "Nova"]);
});

test("retains terminal activity until the exact five-minute settlement boundary", () => {
  const settledAt = BASE_MS + 10 * 60_000;
  const settled = new Map([[7, settledAt]]);
  const success = state({
    status: "success",
    data: { djId: "dj-luna", avatarReady: true },
  });

  const before = normalizeMutationActivities({
    states: [success],
    userId: "user-a",
    nowMs: settledAt + 5 * 60_000 - 1,
    settledAtById: settled,
  });
  const boundary = normalizeMutationActivities({
    states: [success],
    userId: "user-a",
    nowMs: settledAt + 5 * 60_000,
    settledAtById: settled,
  });

  expect(before.items[0].updatedAt).toBe(new Date(settledAt).toISOString());
  expect(boundary).toEqual({ items: [], expiredMutationIds: [7] });
  expect(settled).toEqual(new Map([[7, settledAt]]));
});

test("normalizes portrait partial success and unknown errors without exposing them as presentation copy", () => {
  const normalized = normalizeMutationActivities({
    states: [
      state({
        status: "success",
        data: { djId: "dj-luna", avatarReady: false },
      }),
      state({
        mutationId: 8,
        kind: "update-dj",
        status: "success",
        variables: { name: "Luna", regenerateAvatar: true },
        data: { djId: "dj-luna", avatarUrl: null },
      }),
      state({
        mutationId: 9,
        kind: "update-dj",
        status: "success",
        variables: { name: "Luna", regenerateAvatar: false },
        data: { djId: "dj-luna", avatarUrl: null },
      }),
      state({ mutationId: 10, status: "error", error: { private: true } }),
    ],
    userId: "user-a",
    nowMs: BASE_MS + 40_000,
    settledAtById: new Map([
      [7, BASE_MS + 40_000],
      [8, BASE_MS + 40_000],
      [9, BASE_MS + 40_000],
      [10, BASE_MS + 40_000],
    ]),
  });

  expect(normalized.items).toEqual([
    expect.objectContaining({ detail: "portraitUnavailable" }),
    expect.objectContaining({ detail: "portraitUnavailable" }),
    expect.objectContaining({ detail: null }),
    expect.objectContaining({
      error: "[object Object]",
      failureReason: "operationFailed",
      status: "failed",
    }),
  ]);
});
