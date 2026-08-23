import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { supabase } from "@/src/api/supabase";
import { queryKeys } from "@/src/api/queries";
import { useCurrentUser } from "../use-auth";
import { useDailyDrop } from "../use-daily-drop";
import { useDJs } from "../use-home";
import { useLocalDate } from "../use-local-date";

const mockInvokeWithAuthScope = jest.fn();

jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}));
jest.mock("../use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("../use-home", () => ({
  toPlayerTrack: (track: unknown) => track,
  useDJs: jest.fn(),
}));
jest.mock("../use-local-date", () => ({ useLocalDate: jest.fn() }));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: "en" }),
}));
jest.mock("@/src/api/auth-scope", () => ({
  authMutationKey: (operation: string, userId: string) => [operation, userId],
  captureAuthScope: (userId: string) => ({ userId, authorization: `Bearer ${userId}` }),
  invokeWithAuthScope: (...args: unknown[]) => mockInvokeWithAuthScope(...args),
}));

const djOne = {
  id: "dj-1",
  owner_id: "user-a",
  name: "DJ One",
  avatar_url: null,
  genre_specialties: ["Ambient"],
};
const djTwo = { ...djOne, id: "dj-2", name: "DJ Two" };

let userId = "user-a";
let dropDate = "2026-08-01";
let djs = [djOne];
let rowResponse: { data: unknown; error: unknown } = { data: undefined, error: null };
const readCalls: [string, string][][] = [];

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function client() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useDailyDrop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(supabase.functions.invoke).mockReset();
    jest.mocked(supabase.from).mockReset();
    mockInvokeWithAuthScope.mockReset();
    mockInvokeWithAuthScope.mockImplementation(
      (_functions, _scope, name, options) => supabase.functions.invoke(name, options),
    );
    userId = "user-a";
    dropDate = "2026-08-01";
    djs = [djOne];
    rowResponse = { data: { status: "pending", dj_id: "dj-1", djs: djOne }, error: null };
    readCalls.length = 0;
    jest.mocked(useCurrentUser).mockImplementation(() => ({ id: userId }) as never);
    jest.mocked(useLocalDate).mockImplementation(() => dropDate);
    jest.mocked(useDJs).mockImplementation(() => ({ data: djs }) as never);
    jest.mocked(supabase.from).mockImplementation(() => {
      const filters: [string, string][] = [];
      let builder: { select: jest.Mock; eq: jest.Mock; single: jest.Mock };
      builder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column: string, value: string) => {
          filters.push([column, value]);
          return builder;
        }),
        single: jest.fn(async () => {
          readCalls.push(filters);
          return rowResponse;
        }),
      };
      return builder as never;
    });
  });

  afterEach(() => cleanup());

  it("turns an ensure failure into a retryable failed state", async () => {
    jest.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce({ data: null, error: new Error("offline") } as never)
      .mockResolvedValueOnce({ data: { jobId: "job-1" }, error: null } as never);
    const hook = await renderHook(() => useDailyDrop(), { wrapper: wrapper(client()) });

    await waitFor(() => expect(hook.result.current.status).toBe("failed"));
    await act(async () => hook.result.current.retry());
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledTimes(2));
    await hook.unmount();
  });

  it("treats a server daily quota as bounded and does not resubmit on retry", async () => {
    const quotaError = new FunctionsHttpError({
      json: jest.fn(async () => ({
        code: "daily_quota_reached",
        dailyLimit: 1,
      })),
    } as never);
    jest.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: quotaError,
    } as never);

    const hook = await renderHook(() => useDailyDrop(), { wrapper: wrapper(client()) });
    await waitFor(() => expect(hook.result.current.status).toBe("failed"));

    await act(async () => hook.result.current.retry());
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    await hook.unmount();
  });

  it("drops the old job across user/date identities and ignores its late ensure", async () => {
    const oldEnsure = deferred<{ data: { jobId: string }; error: null }>();
    jest.mocked(supabase.functions.invoke)
      .mockReturnValueOnce(oldEnsure.promise as never)
      .mockResolvedValueOnce({ data: { jobId: "job-b" }, error: null } as never)
      .mockResolvedValueOnce({ data: { jobId: "job-next-day" }, error: null } as never);
    rowResponse = { data: { status: "pending", dj_id: "dj-1", djs: djOne }, error: null };
    const hook = await renderHook(() => useDailyDrop(), { wrapper: wrapper(client()) });
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledTimes(1));

    userId = "user-b";
    await hook.rerender({});
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledTimes(2));
    await act(async () => {
      oldEnsure.resolve({ data: { jobId: "job-a" }, error: null });
      await oldEnsure.promise;
    });
    await waitFor(() => expect(readCalls.at(-1)).toEqual([
      ["id", "job-b"],
      ["user_id", "user-b"],
    ]));
    expect(readCalls.flat()).not.toContainEqual(["id", "job-a"]);

    dropDate = "2026-08-02";
    await hook.rerender({});
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(readCalls.at(-1)).toEqual([
      ["id", "job-next-day"],
      ["user_id", "user-b"],
    ]));
    await hook.unmount();
  });

  it("keeps the persisted DJ when the local proposal changes", async () => {
    jest.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { jobId: "job-1" }, error: null,
    } as never);
    rowResponse = {
      data: {
        status: "ready",
        dj_id: "dj-1",
        djs: djOne,
        tracks: { id: "track", title: "Track", audio_url: "track.mp3" },
      },
      error: null,
    };
    const hook = await renderHook(() => useDailyDrop(), { wrapper: wrapper(client()) });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    djs = [djTwo];
    await hook.rerender({});

    expect(hook.result.current.dj?.name).toBe("DJ One");
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    await hook.unmount();
  });

  it("requeues a known failed row but retries a failed read first when no row is known", async () => {
    jest.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { jobId: "job-1" }, error: null,
    } as never);
    rowResponse = {
      data: { status: "failed", dj_id: "dj-1", djs: djOne }, error: null,
    };
    const knownClient = client();
    const known = await renderHook(() => useDailyDrop(), { wrapper: wrapper(knownClient) });
    await waitFor(() => expect(known.result.current.status).toBe("failed"));
    rowResponse = { data: null, error: new Error("later read failed") };
    await act(async () => {
      await knownClient.refetchQueries({
        queryKey: queryKeys.generationJobs.detail("user-a", "job-1"),
      });
    });
    await waitFor(() => expect(known.result.current.stale).toBe(true));
    rowResponse = {
      data: {
        status: "ready",
        dj_id: "dj-1",
        djs: djOne,
        tracks: { id: "track-requeued", title: "Requeued", audio_url: "ready.mp3" },
      },
      error: null,
    };
    const readsBeforeRequeue = readCalls.length;
    await act(async () => known.result.current.retry());
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readCalls.length).toBeGreaterThan(readsBeforeRequeue));
    await waitFor(() => expect(known.result.current.status).toBe("ready"));
    await known.unmount();

    jest.clearAllMocks();
    readCalls.length = 0;
    rowResponse = { data: null, error: new Error("read failed") };
    jest.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { jobId: "job-2" }, error: null,
    } as never);
    const unknown = await renderHook(() => useDailyDrop(), { wrapper: wrapper(client()) });
    await waitFor(() => expect(unknown.result.current.status).toBe("failed"));
    const readsBeforeRetry = readCalls.length;
    await act(async () => unknown.result.current.retry());
    await waitFor(() => expect(readCalls.length).toBeGreaterThan(readsBeforeRetry));
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    await unknown.unmount();
  });

  it("keeps cached pending data stale and retries its failed row read", async () => {
    jest.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { jobId: "job-pending" }, error: null,
    } as never);
    rowResponse = {
      data: { status: "pending", dj_id: "dj-1", djs: djOne }, error: null,
    };
    const queryClient = client();
    const hook = await renderHook(() => useDailyDrop(), {
      wrapper: wrapper(queryClient),
    });
    await waitFor(() => expect(readCalls).toHaveLength(1));

    rowResponse = { data: null, error: new Error("refetch failed") };
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: queryKeys.generationJobs.detail("user-a", "job-pending"),
      });
    });
    await waitFor(() => expect(hook.result.current.stale).toBe(true));
    expect(hook.result.current.status).toBe("pending");
    const readsBeforeRetry = readCalls.length;

    await act(async () => hook.result.current.retry());
    await waitFor(() => expect(readCalls.length).toBeGreaterThan(readsBeforeRetry));
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    await hook.unmount();
  });
});
