import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "../use-auth";
import { useOnboarding, useSaveOnboarding } from "../use-onboarding";
import {
  loadOnboardingRecord,
  saveOnboardingRecord,
} from "@/src/onboarding/onboarding-storage";
import type { OnboardingRecord } from "@/src/onboarding/types";
import {
  createOnboardingState,
  reduceOnboarding,
} from "@/src/onboarding/onboarding-machine";

jest.mock("../use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn() },
}));
jest.mock("@/src/onboarding/onboarding-storage", () => ({
  loadOnboardingRecord: jest.fn(),
  saveOnboardingRecord: jest.fn(),
}));

const domainRecord = (
  overrides: Partial<OnboardingRecord> = {},
): OnboardingRecord => ({
  userId: "user-1",
  version: 1,
  status: "in_progress",
  lastStep: "home.daily-drop",
  startedAt: "2026-07-16T10:00:00.000Z",
  completedAt: null,
  skippedAt: null,
  firstPlayAt: null,
  contextualTips: {},
  replayCount: 0,
  lastReplayedAt: null,
  updatedAt: "2026-07-16T10:05:00.000Z",
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  user_id: "user-1",
  version: 1,
  status: "in_progress",
  last_step: "home.daily-drop",
  started_at: "2026-07-16T10:00:00.000Z",
  completed_at: null,
  skipped_at: null,
  first_play_at: null,
  contextual_tips: {},
  replay_count: 0,
  last_replayed_at: null,
  updated_at: "2026-07-16T10:05:00.000Z",
  ...overrides,
});

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function mockServerQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle,
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  jest.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

function mockMutationServer({
  readData = null,
  readError = null,
  upsertData = null,
  upsertError = null,
  order,
}: {
  readData?: unknown;
  readError?: unknown;
  upsertData?: unknown;
  upsertError?: unknown;
  order?: string[];
}) {
  const maybeSingle = jest.fn().mockImplementation(async () => {
    order?.push("server-read");
    return { data: readData, error: readError };
  });
  const mutationBuilder = {
    select: jest.fn(),
    single: jest.fn().mockResolvedValue({ data: upsertData, error: upsertError }),
  };
  mutationBuilder.select.mockReturnValue(mutationBuilder);
  const upsert = jest.fn().mockImplementation(() => {
    order?.push("server-write");
    return mutationBuilder;
  });
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle,
    upsert,
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  jest.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("useOnboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadOnboardingRecord).mockResolvedValue(null);
    jest.mocked(saveOnboardingRecord).mockResolvedValue(undefined);
  });

  it("does not query without an authenticated user", async () => {
    jest.mocked(useCurrentUser).mockReturnValue(null);

    await renderHook(() => useOnboarding(1), { wrapper: wrapper(queryClient()) });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("filters by the authenticated user and exact onboarding version", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    const builder = mockServerQuery({ data: null, error: null });

    const { result } = await renderHook(() => useOnboarding(2), {
      wrapper: wrapper(queryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabase.from).toHaveBeenCalledWith("user_onboarding");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "version", 2);
    expect(loadOnboardingRecord).toHaveBeenCalledWith("user-1", 2);
  });

  it("maps a missing server and local row to null", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    mockServerQuery({ data: null, error: null });

    const { result } = await renderHook(() => useOnboarding(1), {
      wrapper: wrapper(queryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it("resolves a valid local record without waiting for an offline server", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    let resolveServer!: (value: { data: unknown; error: unknown }) => void;
    const maybeSingle = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolveServer = resolve;
    }));
    const builder = { select: jest.fn(), eq: jest.fn(), maybeSingle };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    jest.mocked(supabase.from).mockReturnValue(builder as never);
    const local = domainRecord({ status: "completed", completedAt: "2026-07-16T10:06:00.000Z" });
    jest.mocked(loadOnboardingRecord).mockResolvedValue(local);

    const { result } = await renderHook(() => useOnboarding(1), {
      wrapper: wrapper(queryClient()),
    });
    await waitFor(() => expect(result.current.data).toEqual(local));
    expect(result.current.isSuccess).toBe(true);

    await act(async () => resolveServer({ data: null, error: new Error("offline") }));
  });

  it("maps rows and reconciles server and local records", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    mockServerQuery({
      data: row({
        status: "skipped",
        skipped_at: "2026-07-16T10:10:00.000Z",
        updated_at: "2026-07-16T10:10:00.000Z",
      }),
      error: null,
    });
    jest.mocked(loadOnboardingRecord).mockResolvedValue(
      domainRecord({
        status: "completed",
        completedAt: "2026-07-16T09:00:00.000Z",
        updatedAt: "2026-07-16T09:00:00.000Z",
      }),
    );

    const { result } = await renderHook(() => useOnboarding(1), {
      wrapper: wrapper(queryClient()),
    });

    await waitFor(() => expect(result.current.data?.status).toBe("completed"));
    expect(result.current.data).toMatchObject({
      userId: "user-1",
      lastStep: "home.daily-drop",
    });
  });

  it("cannot let a delayed initial server read regress a newer optimistic mutation", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    const initial = domainRecord();
    const latest = domainRecord({
      status: "completed",
      lastStep: "home.ready",
      completedAt: "2026-07-16T11:00:00.000Z",
      contextualTips: { "discover.search": "2026-07-16T10:30:00.000Z" },
      replayCount: 3,
      lastReplayedAt: "2026-07-16T10:45:00.000Z",
      updatedAt: "2026-07-16T11:00:00.000Z",
    });
    let mirror = initial;
    const mirrorWrites: OnboardingRecord[] = [];
    jest.mocked(loadOnboardingRecord).mockImplementation(async () => mirror);
    jest.mocked(saveOnboardingRecord).mockImplementation(async (record) => {
      mirror = record;
      mirrorWrites.push(record);
    });

    let resolveInitialServer!: (value: { data: unknown; error: unknown }) => void;
    const initialRead = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn().mockReturnValue(new Promise((resolve) => {
        resolveInitialServer = resolve;
      })),
    };
    initialRead.select.mockReturnValue(initialRead);
    initialRead.eq.mockReturnValue(initialRead);

    const mutationRead = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mutationRead.select.mockReturnValue(mutationRead);
    mutationRead.eq.mockReturnValue(mutationRead);

    const mutationResult = {
      select: jest.fn(),
      single: jest.fn().mockResolvedValue({
        data: row({
          status: "completed",
          last_step: "home.ready",
          completed_at: latest.completedAt,
          contextual_tips: latest.contextualTips,
          replay_count: latest.replayCount,
          last_replayed_at: latest.lastReplayedAt,
          updated_at: latest.updatedAt,
        }),
        error: null,
      }),
    };
    mutationResult.select.mockReturnValue(mutationResult);
    const mutationWrite = {
      upsert: jest.fn().mockReturnValue(mutationResult),
    };
    jest.mocked(supabase.from)
      .mockReturnValueOnce(initialRead as never)
      .mockReturnValueOnce(mutationRead as never)
      .mockReturnValueOnce(mutationWrite as never);

    const client = queryClient();
    const key = queryKeys.onboarding.current("user-1", 1);
    const { result } = await renderHook(
      () => ({ query: useOnboarding(1), save: useSaveOnboarding() }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.query.data).toEqual(initial));

    await act(async () => {
      await result.current.save.mutateAsync(latest);
    });
    expect(client.getQueryData(key)).toEqual(latest);
    expect(mirror).toEqual(latest);

    await act(async () => {
      resolveInitialServer({ data: row(), error: null });
    });
    await waitFor(() => expect(mirrorWrites.length).toBeGreaterThanOrEqual(3));

    expect(client.getQueryData(key)).toEqual(latest);
    expect(mirror).toEqual(latest);
  });

  it("exposes a server query error", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    mockServerQuery({ data: null, error: new Error("server unavailable") });

    const { result } = await renderHook(() => useOnboarding(1), {
      wrapper: wrapper(queryClient()),
    });

    await waitFor(() =>
      expect(result.current.error).toEqual(new Error("server unavailable")),
    );
  });

  it("exposes malformed server timestamps as a query error", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    mockServerQuery({
      data: row({ updated_at: "not-a-timestamp" }),
      error: null,
    });

    const { result } = await renderHook(() => useOnboarding(1), {
      wrapper: wrapper(queryClient()),
    });

    await waitFor(() =>
      expect(result.current.error).toEqual(
        expect.objectContaining({ message: expect.stringMatching(/timestamp/i) }),
      ),
    );
  });

  it("exposes malformed server tip timestamps as a query error", async () => {
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    mockServerQuery({
      data: row({ contextual_tips: { "discover.search": 42 } }),
      error: null,
    });

    const { result } = await renderHook(() => useOnboarding(1), {
      wrapper: wrapper(queryClient()),
    });

    await waitFor(() =>
      expect(result.current.error).toEqual(
        expect.objectContaining({ message: expect.stringMatching(/timestamp/i) }),
      ),
    );
  });
});

describe("useSaveOnboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
    jest.mocked(loadOnboardingRecord).mockResolvedValue(null);
    jest.mocked(saveOnboardingRecord).mockResolvedValue(undefined);
  });

  it("durably writes local storage and cache before attempting server synchronization", async () => {
    const order: string[] = [];
    const { upsert } = mockMutationServer({ order });
    jest.mocked(saveOnboardingRecord).mockImplementation(async () => {
      order.push("local");
    });
    const client = queryClient();
    client.setQueryData(
      queryKeys.onboarding.current("user-1", 1),
      domainRecord({ status: "completed", completedAt: "2026-07-16T10:10:00.000Z" }),
    );
    const next = domainRecord({
      status: "in_progress",
      updatedAt: "2026-07-16T11:00:00.000Z",
    });
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(next);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(order).toEqual(["local", "server-read", "server-write", "local"]);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        version: 1,
        status: "completed",
        updated_at: "2026-07-16T10:05:00.000Z",
      }),
      { onConflict: "user_id,version" },
    );
    expect(saveOnboardingRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
    expect(
      client.getQueryData<OnboardingRecord>(
        queryKeys.onboarding.current("user-1", 1),
      )?.status,
    ).toBe("completed");
  });

  it("persists reducer Back and advance cursors over older same-status sources", async () => {
    const at = "2026-07-16T10:05:00.000Z";
    const older = domainRecord({ lastStep: "welcome.djs", updatedAt: at });
    const olderRow = row({ last_step: "welcome.djs", updated_at: at });
    const { upsert } = mockMutationServer({ readData: olderRow });
    jest.mocked(loadOnboardingRecord).mockResolvedValue(older);
    const client = queryClient();
    const key = queryKeys.onboarding.current("user-1", 1);
    client.setQueryData(key, older);

    let state = createOnboardingState({
      userId: "user-1",
      version: 1,
      currentRoute: "home",
    });
    state = reduceOnboarding(state, {
      type: "ELIGIBILITY_RESOLVED",
      record: older,
    }).state;
    state = reduceOnboarding(state, { type: "HOME_READY", at }).state;
    state = reduceOnboarding(state, { type: "CONTINUE_REQUESTED" }).state;
    const backed = reduceOnboarding(state, { type: "WELCOME_BACK", at });
    const advanced = reduceOnboarding(backed.state, {
      type: "WELCOME_CONTINUED",
      at,
    });
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(backed.state.record!);
      await result.current.mutateAsync(advanced.state.record!);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      last_step: "welcome.intro",
      updated_at: "2026-07-16T10:05:00.001Z",
    }), { onConflict: "user_id,version" });
    expect(upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      last_step: "welcome.djs",
      updated_at: "2026-07-16T10:05:00.002Z",
    }), { onConflict: "user_id,version" });
    expect(saveOnboardingRecord).toHaveBeenLastCalledWith(expect.objectContaining({
      lastStep: "welcome.djs",
      updatedAt: "2026-07-16T10:05:00.002Z",
    }));
    expect(client.getQueryData(key)).toEqual(expect.objectContaining({
      lastStep: "welcome.djs",
      updatedAt: "2026-07-16T10:05:00.002Z",
    }));
  });

  it("persists reducer replay metadata over older server, local, and cached records", async () => {
    const older = domainRecord({
      status: "completed",
      completedAt: "2026-07-16T10:00:00.000Z",
      replayCount: 1,
      lastReplayedAt: "2026-07-16T09:00:00.000Z",
    });
    const { upsert } = mockMutationServer({
      readData: row({
        status: "completed",
        completed_at: "2026-07-16T10:00:00.000Z",
        replay_count: 1,
        last_replayed_at: "2026-07-16T09:00:00.000Z",
      }),
    });
    jest.mocked(loadOnboardingRecord).mockResolvedValue(older);
    const client = queryClient();
    const key = queryKeys.onboarding.current("user-1", 1);
    client.setQueryData(key, older);

    let state = createOnboardingState({
      userId: "user-1",
      version: 1,
      currentRoute: "profile",
    });
    state = reduceOnboarding(state, {
      type: "ELIGIBILITY_RESOLVED",
      record: older,
    }).state;
    const replayed = reduceOnboarding(state, {
      type: "REPLAY_REQUESTED",
      at: "2026-07-16T11:00:00+01:00",
    });
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(replayed.state.record!);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      replay_count: 2,
      last_replayed_at: "2026-07-16T10:00:00.000Z",
    }), { onConflict: "user_id,version" });
    expect(saveOnboardingRecord).toHaveBeenCalledWith(expect.objectContaining({
      replayCount: 2,
      lastReplayedAt: "2026-07-16T10:00:00.000Z",
    }));
    expect(client.getQueryData(key)).toEqual(expect.objectContaining({
      replayCount: 2,
      lastReplayedAt: "2026-07-16T10:00:00.000Z",
    }));
  });

  it("cannot regress a terminal server row when the cache is cold", async () => {
    const { upsert } = mockMutationServer({
      readData: row({
        status: "completed",
        completed_at: "2026-07-16T10:10:00Z",
        updated_at: "2026-07-16T10:10:00Z",
      }),
    });
    const client = queryClient();
    const next = domainRecord({
      status: "in_progress",
      updatedAt: "2026-07-16T12:00:00Z",
    });
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(next);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        completed_at: "2026-07-16T10:10:00.000Z",
      }),
      { onConflict: "user_id,version" },
    );
    expect(saveOnboardingRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("prefers a terminal server row over a stale cache", async () => {
    const { upsert } = mockMutationServer({
      readData: row({
        status: "completed",
        completed_at: "2026-07-16T10:10:00Z",
        updated_at: "2026-07-16T10:10:00Z",
      }),
    });
    const client = queryClient();
    client.setQueryData(
      queryKeys.onboarding.current("user-1", 1),
      domainRecord({ updatedAt: "2026-07-16T12:00:00Z" }),
    );
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(
        domainRecord({ updatedAt: "2026-07-16T13:00:00Z" }),
      );
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
      { onConflict: "user_id,version" },
    );
    expect(
      client.getQueryData<OnboardingRecord>(
        queryKeys.onboarding.current("user-1", 1),
      )?.status,
    ).toBe("completed");
  });

  it("mirrors the trigger-adjusted server row after an atomic race", async () => {
    mockMutationServer({
      upsertData: row({
        status: "completed",
        last_step: "home.djs",
        completed_at: "2026-07-16T10:10:00Z",
        updated_at: "2026-07-16T13:00:00Z",
      }),
    });
    const client = queryClient();
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(
        domainRecord({ updatedAt: "2026-07-16T12:00:00Z" }),
      );
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(saveOnboardingRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        lastStep: "home.djs",
        updatedAt: "2026-07-16T13:00:00.000Z",
      }),
    );
    expect(client.getQueryData<OnboardingRecord>(
      queryKeys.onboarding.current("user-1", 1),
    )).toEqual(expect.objectContaining({
      status: "completed",
      lastStep: "home.djs",
      updatedAt: "2026-07-16T13:00:00.000Z",
    }));
  });

  it("writes local state and cache when the server fails, then exposes a retryable error", async () => {
    const serverError = new Error("offline");
    mockMutationServer({ upsertError: serverError });
    const client = queryClient();
    const next = domainRecord();
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(next)).rejects.toBe(serverError);
    });

    expect(saveOnboardingRecord).toHaveBeenCalledWith(next);
    expect(
      client.getQueryData(queryKeys.onboarding.current("user-1", 1)),
    ).toEqual(next);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("preserves local state and cache when the server read fails", async () => {
    const serverError = new Error("read offline");
    const { upsert } = mockMutationServer({ readError: serverError });
    const localCompleted = domainRecord({
      status: "completed",
      completedAt: "2026-07-16T09:00:00Z",
      updatedAt: "2026-07-16T09:00:00Z",
    });
    jest.mocked(loadOnboardingRecord).mockResolvedValue(localCompleted);
    const client = queryClient();
    const next = domainRecord();
    const { result } = await renderHook(() => useSaveOnboarding(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(next)).rejects.toBe(serverError);
    });

    expect(upsert).not.toHaveBeenCalled();
    expect(saveOnboardingRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
    expect(
      client.getQueryData<OnboardingRecord>(
        queryKeys.onboarding.current("user-1", 1),
      )?.status,
    ).toBe("completed");
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
