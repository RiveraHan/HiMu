import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import type { ActivityItem } from "@/src/activity/types";
import { LocaleContext, type LocaleContextValue } from "@/src/i18n/use-locale";
import { useCurrentUser } from "../use-auth";
import { useGenerateMix } from "../use-generate-mix";

jest.mock("@/src/api/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock("../use-auth", () => ({ useCurrentUser: jest.fn() }));

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
    detail: null,
    seen: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  jest.mocked(useCurrentUser).mockReturnValue({ id: "listener" } as never);
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { jobId: "job-1" },
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
    });
  });

  expect(supabase.functions.invoke).toHaveBeenCalledWith("generate-mix", {
    body: {
      djId: "dj-one",
      language: "en",
      localHour: 17,
      lyrics: "neon rain",
    },
  });
  expect(queryClient.getQueryData(queryKeys.generationJobs.activity("listener"))).toEqual([
    expect.objectContaining({
      id: "generation:job-1",
      status: "queued",
      djId: "dj-one",
      title: "DJ One",
      retryLyrics: "neon rain",
    }),
  ]);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.generationJobs.activity("listener"),
  });

  finishInvalidation();
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
    await result.current.generateAsync({ djId: "dj-one", title: "DJ One" });
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
      result.current.generateAsync({ djId: "dj-one", title: "DJ One" }),
    ).rejects.toThrow("generate-mix did not return a jobId");
  });

  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
});
