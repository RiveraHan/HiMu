import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { supabase } from "@/src/api/supabase";
import type { ActivityItem, GenerationJobRow } from "../types";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useGenerationActivity } from "../use-generation-activity";

jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const generationJob: GenerationJobRow = {
  id: "job-1",
  user_id: "user-1",
  dj_id: "dj-1",
  status: "generating",
  prompt: "A bright synth mix",
  error: null,
  created_at: "2026-07-29T12:00:00.000Z",
  updated_at: "2026-07-29T12:00:10.000Z",
  drop_date: null,
  track_id: null,
  djs: { id: "dj-1", name: "Nova" },
  tracks: null,
};

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function mockGenerationJobsQuery(
  response: { data: GenerationJobRow[]; error: null } | { data: null; error: Error },
) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    returns: jest.fn(async () => response),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  jest.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("queries current-user non-drop jobs and normalizes running activity", async () => {
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-29T12:01:00.000Z"));
  const builder = mockGenerationJobsQuery({ data: [generationJob], error: null });
  const client = queryClient();
  const { result, unmount } = await renderHook(() => useGenerationActivity(), {
    wrapper: wrapper(client),
  });

  await waitFor(() =>
    expect(result.current.data).toEqual([
      expect.objectContaining({ id: "generation:job-1", status: "running" }),
    ]),
  );
  expect(supabase.from).toHaveBeenCalledWith("generation_jobs");
  expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
  expect(builder.is).toHaveBeenCalledWith("drop_date", null);
  expect(client.getQueryData(["generation-jobs", "activity", "user-1"])).toEqual(
    result.current.data,
  );

  await unmount();
});

test("does not query generation jobs without a current user", async () => {
  jest.mocked(useCurrentUser).mockReturnValue(null);
  const client = queryClient();
  const { result, unmount } = await renderHook(() => useGenerationActivity(), {
    wrapper: wrapper(client),
  });

  expect(result.current.fetchStatus).toBe("idle");
  expect(supabase.from).not.toHaveBeenCalled();

  await unmount();
});

test("recomputes the 24-hour cutoff every time the query executes", async () => {
  let nowMs = Date.parse("2026-07-29T12:00:00.000Z");
  jest.spyOn(Date, "now").mockImplementation(() => nowMs);
  const builder = mockGenerationJobsQuery({ data: [generationJob], error: null });
  const client = queryClient();
  const { result, unmount } = await renderHook(() => useGenerationActivity(), {
    wrapper: wrapper(client),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  nowMs += 25 * 60 * 60 * 1000;
  await act(async () => {
    await result.current.refetch();
  });

  expect(builder.or).toHaveBeenNthCalledWith(
    1,
    "status.in.(queued,generating),created_at.gte.2026-07-28T12:00:00.000Z",
  );
  expect(builder.or).toHaveBeenNthCalledWith(
    2,
    "status.in.(queued,generating),created_at.gte.2026-07-29T13:00:00.000Z",
  );

  await unmount();
});

test("throws Supabase query errors through the query result", async () => {
  const queryError = new Error("generation jobs unavailable");
  mockGenerationJobsQuery({ data: null, error: queryError });
  const client = queryClient();
  const { result, unmount } = await renderHook(() => useGenerationActivity(), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(result.current.error).toBe(queryError));

  await unmount();
});

test("polls active activity and always refetches on focus and reconnect", async () => {
  mockGenerationJobsQuery({ data: [generationJob], error: null });
  const client = queryClient();
  const { result, unmount } = await renderHook(() => useGenerationActivity(), {
    wrapper: wrapper(client),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  const query = client.getQueryCache().find({
    queryKey: ["generation-jobs", "activity", "user-1"],
  });
  expect(query).toBeDefined();
  type CachedActivityQuery = NonNullable<typeof query>;
  const activityQuery = query as CachedActivityQuery;
  const options = activityQuery.options as CachedActivityQuery["options"] & {
    refetchInterval: (value: CachedActivityQuery) => number | false;
    staleTime: number;
    refetchOnWindowFocus: "always";
    refetchOnReconnect: "always";
  };
  expect(options.refetchInterval(activityQuery)).toBe(3000);
  client.setQueryData<ActivityItem[]>(
    ["generation-jobs", "activity", "user-1"],
    [{ ...result.current.data![0], status: "ready" }],
  );
  expect(options.refetchInterval(activityQuery)).toBe(false);
  expect(options.staleTime).toBe(0);
  expect(options.refetchOnWindowFocus).toBe("always");
  expect(options.refetchOnReconnect).toBe("always");
  expect(options.networkMode).not.toBe("always");

  await unmount();
});
