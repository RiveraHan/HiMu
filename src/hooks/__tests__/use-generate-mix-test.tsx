import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import type { ActivityItem } from "@/src/activity/types";
import { LocaleContext, type LocaleContextValue } from "@/src/i18n/use-locale";
import { useCurrentUser } from "../use-auth";
import { useDeleteDJ } from "../use-delete-dj";
import { useGenerateMix } from "../use-generate-mix";

type GenerateVariables = Parameters<
  ReturnType<typeof useGenerateMix>["generate"]
>[0];
const generateInputRequiresTitle: {
  djId: string;
  lyrics: string;
} extends GenerateVariables
  ? false
  : true = true;
void generateInputRequiresTitle;
const generateInputRequiresVisibility: {
  djId: string;
  title: string;
} extends GenerateVariables
  ? false
  : true = true;
void generateInputRequiresVisibility;

jest.mock("@/src/api/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock("../use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/api/auth-scope", () => {
  const actual = jest.requireActual("@/src/api/auth-scope");
  return {
    ...actual,
    captureAuthScope: (userId: string) => {
      if (mockUserId !== userId) throw new actual.AuthScopeChangedError();
      return {
        userId,
        authorization: `Bearer fixture-${userId}`,
      };
    },
    isCurrentMutationUser: (userId: string) => mockUserId === userId,
  };
});

let mockUserId = "listener";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const localeValue: LocaleContextValue = {
  preference: "en",
  resolvedLanguage: "en",
  setPreference: jest.fn(),
  isSaving: false,
};

function client() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <LocaleContext.Provider value={localeValue}>
          {children}
        </LocaleContext.Provider>
      </QueryClientProvider>
    );
  };
}

function activity(status: ActivityItem["status"]): ActivityItem {
  return {
    id: "generation:job-1",
    source: "server",
    kind: "mix",
    status,
    title: "DJ One",
    djId: "dj-one",
    trackId: null,
    createdAt: "2026-07-29T12:00:00.000Z",
    updatedAt: "2026-07-29T12:01:00.000Z",
    error: null,
    failureReason: null,
    recoveryAvailable: false,
    retryLyrics: null,
    visibility: "private",
    detail: null,
    seen: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockUserId = "listener";
  jest.mocked(useCurrentUser).mockImplementation(
    () => ({ id: mockUserId }) as never,
  );
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { jobId: "job-1", isPublic: false },
    error: null,
  } as never);
});

test("seeds the confirmed job before activity invalidation settles without sending its title", async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 6, 29, 17, 5));
  const queryClient = client();
  let finishInvalidation!: () => void;
  const invalidation = new Promise<void>((resolve) => {
    finishInvalidation = resolve;
  });
  const invalidate = jest
    .spyOn(queryClient, "invalidateQueries")
    .mockReturnValue(invalidation);
  const { result } = await renderHook(() => useGenerateMix(), {
    wrapper: wrapper(queryClient),
  });

  await act(async () => {
    await result.current.generateAsync({
      djId: "dj-one",
      title: "DJ One",
      lyrics: "neon rain",
      isPublic: true,
    });
  });

  expect(supabase.functions.invoke).toHaveBeenCalledWith("generate-mix", {
    body: {
      djId: "dj-one",
      language: "en",
      localHour: 17,
      lyrics: "neon rain",
      isPublic: true,
    },
    headers: { Authorization: "Bearer fixture-listener" },
  });
  expect(queryClient.getQueryData(queryKeys.generationJobs.activity("listener"))).toEqual([
    expect.objectContaining({
      id: "generation:job-1",
      status: "queued",
      djId: "dj-one",
      title: "DJ One",
      retryLyrics: "neon rain",
      visibility: "private",
    }),
  ]);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.generationJobs.activity("listener"),
  });

  await act(async () => finishInvalidation());
});

test("does not downgrade a running cache item when the start response races activity polling", async () => {
  const queryClient = client();
  const running = activity("running");
  queryClient.setQueryData(
    queryKeys.generationJobs.activity("listener"),
    [running],
  );
  jest.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const { result } = await renderHook(() => useGenerateMix(), {
    wrapper: wrapper(queryClient),
  });

  await act(async () => {
    await result.current.generateAsync({ djId: "dj-one", title: "DJ One", isPublic: false });
  });

  expect(queryClient.getQueryData(queryKeys.generationJobs.activity("listener"))).toEqual([
    running,
  ]);
});

test("rejects a successful Edge response without a job id", async () => {
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: {},
    error: null,
  } as never);
  const { result } = await renderHook(() => useGenerateMix(), {
    wrapper: wrapper(client()),
  });

  await act(async () => {
    await expect(
      result.current.generateAsync({ djId: "dj-one", title: "DJ One", isPublic: false }),
    ).rejects.toThrow("generate-mix returned an invalid response");
  });

  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
});

test("a generate completion after rerendering A as B has no B callback effects", async () => {
  const invoke = deferred<{ data: { jobId: string; isPublic: boolean }; error: null }>();
  jest.mocked(supabase.functions.invoke).mockReturnValue(invoke.promise as never);
  const queryClient = client();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const hook = await renderHook(() => useGenerateMix(), {
    wrapper: wrapper(queryClient),
  });

  let pending!: Promise<{ jobId: string; isPublic: boolean }>;
  await act(async () => {
    pending = hook.result.current.generateAsync({
      djId: "dj-one",
      title: "DJ One",
      isPublic: false,
    });
    await Promise.resolve();
  });
  expect(supabase.functions.invoke).toHaveBeenCalledWith("generate-mix", {
    body: expect.objectContaining({ djId: "dj-one" }),
    headers: { Authorization: "Bearer fixture-listener" },
  });

  mockUserId = "B";
  await hook.rerender(undefined);
  await act(async () => {
    invoke.resolve({ data: { jobId: "job-a", isPublic: false }, error: null });
    await pending;
  });

  expect(
    queryClient.getQueryData(queryKeys.generationJobs.activity("listener")),
  ).toBeUndefined();
  expect(
    queryClient.getQueryData(queryKeys.generationJobs.activity("B")),
  ).toBeUndefined();
  expect(invalidate).not.toHaveBeenCalled();
});

test("a delete completion after rerendering A as B does not invalidate B", async () => {
  const invoke = deferred<{ data: { ok: true }; error: null }>();
  jest.mocked(supabase.functions.invoke).mockReturnValue(invoke.promise as never);
  const queryClient = client();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const hook = await renderHook(() => useDeleteDJ(), {
    wrapper: wrapper(queryClient),
  });

  let pending!: Promise<{ ok: boolean } | null>;
  await act(async () => {
    pending = hook.result.current.mutateAsync({ djId: "dj-a" });
    await Promise.resolve();
  });
  expect(supabase.functions.invoke).toHaveBeenCalledWith("delete-dj", {
    body: { djId: "dj-a" },
    headers: { Authorization: "Bearer fixture-listener" },
  });

  mockUserId = "B";
  await hook.rerender(undefined);
  await act(async () => {
    invoke.resolve({ data: { ok: true }, error: null });
    await pending;
  });

  expect(invalidate).not.toHaveBeenCalled();
});
