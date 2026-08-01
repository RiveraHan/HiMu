import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { router } from "expo-router";

import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { secureStorage } from "@/src/lib/secure-storage";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useToast } from "@/src/hooks/use-toast";
import { useLocale } from "@/src/i18n/use-locale";
import { ActivityProvider, useActivity } from "../ActivityProvider";
import type { ActivityItem } from "../types";
import { useGenerationActivity } from "../use-generation-activity";

jest.mock("../use-generation-activity", () => ({
  useGenerationActivity: jest.fn(),
}));
jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/hooks/use-toast", () => ({ useToast: jest.fn() }));
jest.mock("@/src/i18n/use-locale", () => ({ useLocale: jest.fn() }));
jest.mock("@/src/api/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: mockPlayerLoad }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const mockToastInfo = jest.fn();
const mockToastError = jest.fn();
const mockRefetch = jest.fn(async () => undefined);
const mockPlayerLoad = jest.fn();
let mockUserId: string | null = "user-a";
let mockLanguage: "en" | "es" = "en";
let mockActivities: ActivityItem[] | undefined = [];
let mockQueryError: Error | null = null;
let mockFetchStatus: "idle" | "fetching" | "paused" = "idle";
let mockIsLoading = false;
const mockStored = new Map<string, string>();

function activity(
  id: string,
  status: ActivityItem["status"],
  overrides: Partial<ActivityItem> = {},
): ActivityItem {
  return {
    id,
    source: "server",
    kind: "mix",
    status,
    title: "Nova",
    djId: "dj-1",
    trackId: status === "ready" ? "track-1" : null,
    createdAt: "2026-07-29T12:00:00.000Z",
    updatedAt: "2026-07-29T12:01:00.000Z",
    error: status === "failed" ? "raw provider failure" : null,
    failureReason: status === "failed" ? "generationFailed" : null,
    recoveryAvailable: false,
    retryLyrics: "neon rain",
    detail: null,
    seen: false,
    ...overrides,
  };
}

function client() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <ActivityProvider>{children}</ActivityProvider>
      </QueryClientProvider>
    );
  };
}

async function renderActivity(queryClient = client()) {
  const rendered = await renderHook(() => useActivity(), {
    wrapper: wrapper(queryClient),
  });
  return { ...rendered, queryClient };
}

function receiptKey(userId: string) {
  return `activity-receipts.${userId}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockStored.clear();
  mockUserId = "user-a";
  mockLanguage = "en";
  mockActivities = [];
  mockQueryError = null;
  mockFetchStatus = "idle";
  mockIsLoading = false;

  jest.mocked(useCurrentUser).mockImplementation(
    () => (mockUserId ? ({ id: mockUserId } as never) : null),
  );
  jest.mocked(useLocale).mockImplementation(
    () => ({ resolvedLanguage: mockLanguage } as never),
  );
  jest.mocked(useToast).mockReturnValue({
    info: mockToastInfo,
    warning: jest.fn(),
    error: mockToastError,
  });
  jest.mocked(useGenerationActivity).mockImplementation(
    () =>
      ({
        data: mockActivities,
        error: mockQueryError,
        isLoading: mockIsLoading,
        isPending: mockIsLoading,
        fetchStatus: mockFetchStatus,
        refetch: mockRefetch,
      }) as never,
  );
  jest.mocked(secureStorage.getItem).mockImplementation(async (key) => {
    return mockStored.get(key) ?? null;
  });
  jest.mocked(secureStorage.setItem).mockImplementation(async (key, value) => {
    mockStored.set(key, value);
  });
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { jobId: "job-2" },
    error: null,
  } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("throws a clear error outside ActivityProvider", async () => {
  await expect(renderHook(() => useActivity())).rejects.toThrow(
    "useActivity must be used within ActivityProvider",
  );
});

test("announces a running-to-ready transition once, refreshes dependents, and never loads the player", async () => {
  mockActivities = [activity("generation:job-1", "running")];
  const queryClient = client();
  const invalidate = jest
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  const rendered = await renderActivity(queryClient);
  await waitFor(() => expect(secureStorage.getItem).toHaveBeenCalled());
  expect(mockToastInfo).not.toHaveBeenCalled();

  mockActivities = [activity("generation:job-1", "ready")];
  await rendered.rerender(undefined);

  await waitFor(() =>
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Your mix is ready",
      "Nova finished a new mix.",
    ),
  );
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.tracks.all });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.tracks.byDj("dj-1"),
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.djs.details("dj-1"),
  });
  expect(mockPlayerLoad).not.toHaveBeenCalled();

  await rendered.rerender(undefined);
  await act(async () => undefined);
  expect(mockToastInfo).toHaveBeenCalledTimes(1);
});

test("persists and announces two simultaneous completions exactly once each", async () => {
  mockActivities = [
    activity("generation:job-1", "ready"),
    activity("generation:job-2", "ready", {
      title: "Echo",
      djId: "dj-2",
      trackId: "track-2",
    }),
  ];
  const { rerender } = await renderActivity();

  await waitFor(() => expect(mockToastInfo).toHaveBeenCalledTimes(2));
  const stored = JSON.parse(mockStored.get(receiptKey("user-a")) ?? "{}") as Record<
    string,
    unknown
  >;
  expect(Object.keys(stored).sort()).toEqual([
    "generation:job-1",
    "generation:job-2",
  ]);

  await rerender(undefined);
  await act(async () => undefined);
  expect(mockToastInfo).toHaveBeenCalledTimes(2);
});

test("ignores a previous user's hydration after switching users and closes the panel", async () => {
  let resolveA!: (value: string | null) => void;
  let resolveB!: (value: string | null) => void;
  jest.mocked(secureStorage.getItem).mockImplementation(
    (key) =>
      new Promise((resolve) => {
        if (key === receiptKey("user-a")) resolveA = resolve;
        else resolveB = resolve;
      }),
  );
  mockActivities = [activity("generation:a", "ready", { title: "Alpha" })];
  const rendered = await renderActivity();
  await act(() => rendered.result.current.openPanel());
  await waitFor(() => expect(rendered.result.current.panelOpen).toBe(true));
  await waitFor(() => expect(resolveA).toBeDefined());

  mockUserId = "user-b";
  mockActivities = [activity("generation:b", "ready", { title: "Beta" })];
  await rendered.rerender(undefined);
  await waitFor(() => expect(resolveB).toBeDefined());
  expect(rendered.result.current.panelOpen).toBe(false);

  await act(async () => resolveA(null));
  expect(mockToastInfo).not.toHaveBeenCalled();
  await act(async () => resolveB(null));
  await waitFor(() =>
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Your mix is ready",
      "Beta finished a new mix.",
    ),
  );
  expect(mockToastInfo).toHaveBeenCalledTimes(1);
});

test("keeps active lookup and counts limited to queued, running, and slow", async () => {
  mockActivities = [
    activity("q", "queued"),
    activity("r", "running", { djId: "dj-2" }),
    activity("s", "slow", { djId: "dj-3", recoveryAvailable: true }),
    activity("ready", "ready", { djId: "dj-4" }),
    activity("failed", "failed", { djId: "dj-5" }),
  ];
  const { result } = await renderActivity();
  await waitFor(() => expect(result.current.items).toHaveLength(5));

  expect(result.current.activeCount).toBe(3);
  expect(result.current.activeMixForDj("dj-1")?.id).toBe("q");
  expect(result.current.activeMixForDj("dj-2")?.id).toBe("r");
  expect(result.current.activeMixForDj("dj-3")?.id).toBe("s");
  expect(result.current.activeMixForDj("dj-4")).toBeNull();
  expect(result.current.activeMixForDj("dj-5")).toBeNull();
});

test("keeps a recoverable slow mix active and actionable without failure feedback", async () => {
  const slow = activity("generation:slow", "slow", {
    recoveryAvailable: true,
    error: null,
    failureReason: null,
  });
  mockActivities = [slow];
  const { result } = await renderActivity();
  await waitFor(() => expect(result.current.activeCount).toBe(1));

  expect(result.current.items[0]).toMatchObject({
    id: "generation:slow",
    status: "slow",
    recoveryAvailable: true,
  });
  expect(result.current.primary?.id).toBe("generation:slow");
  expect(mockToastInfo).not.toHaveBeenCalled();
  expect(mockToastError).not.toHaveBeenCalled();
});

test("sorts active rows before terminal rows while primary independently promotes failure", async () => {
  mockActivities = [
    activity("ready", "ready", { updatedAt: "2026-07-29T12:04:00.000Z" }),
    activity("queued", "queued", { updatedAt: "2026-07-29T12:03:00.000Z" }),
    activity("failed", "failed", { updatedAt: "2026-07-29T12:02:00.000Z" }),
    activity("running", "running", { updatedAt: "2026-07-29T12:01:00.000Z" }),
  ];
  const { result } = await renderActivity();
  await waitFor(() => expect(result.current.items).toHaveLength(4));

  expect(result.current.items.map(({ id }) => id)).toEqual([
    "running",
    "queued",
    "ready",
    "failed",
  ]);
  expect(result.current.primary?.id).toBe("failed");
});

test("forwards cold-start errors, offline state, and refetch while retaining cached items", async () => {
  mockActivities = undefined;
  mockQueryError = new Error("offline query failure");
  mockFetchStatus = "paused";
  mockIsLoading = true;
  const rendered = await renderActivity();

  expect(rendered.result.current.isInitialLoading).toBe(true);
  expect(rendered.result.current.isOffline).toBe(true);
  expect(rendered.result.current.queryError).toBe(mockQueryError);
  await rendered.result.current.refetch();
  expect(mockRefetch).toHaveBeenCalledTimes(1);

  mockActivities = [activity("cached", "running")];
  mockIsLoading = false;
  await rendered.rerender(undefined);
  expect(rendered.result.current.items.map(({ id }) => id)).toEqual(["cached"]);
  expect(rendered.result.current.queryError).toBe(mockQueryError);
});

test("opens active, ready, failed, and malformed mixes with safe destinations and seen policy", async () => {
  const running = activity("running", "running");
  const ready = activity("ready", "ready");
  const failed = activity("failed", "failed");
  const malformed = activity("malformed", "ready", { trackId: null });
  mockActivities = [running, ready, failed, malformed];
  const { result } = await renderActivity();
  await waitFor(() => expect(result.current.items).toHaveLength(4));

  await act(async () => result.current.openActivity(running));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/dj/[id]",
    params: { id: "dj-1" },
  });
  expect(mockStored.has(receiptKey("user-a"))).toBe(true); // terminal notifications only
  const afterRunning = mockStored.get(receiptKey("user-a"))!;

  await act(async () => result.current.openActivity(ready));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/dj/[id]",
    params: { id: "dj-1", highlightTrackId: "track-1" },
  });
  expect(mockStored.get(receiptKey("user-a"))).not.toBe(afterRunning);

  await act(async () => result.current.openActivity(failed));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/dj/[id]",
    params: { id: "dj-1" },
  });
  await act(async () => result.current.openActivity(malformed));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/dj/[id]",
    params: { id: "dj-1" },
  });
});

test("does not offer or open a mix without a DJ destination", async () => {
  const noDestination = activity("failed", "failed", { djId: null });
  mockActivities = [noDestination];
  const { result } = await renderActivity();
  await waitFor(() => expect(result.current.items).toHaveLength(1));

  expect(result.current.canOpenActivity(noDestination)).toBe(false);
  await act(async () => result.current.openActivity(noDestination));
  expect(router.push).not.toHaveBeenCalled();
  await act(async () => result.current.markSeen(noDestination));
  await waitFor(() => expect(result.current.items).toHaveLength(0));
});

test("removes a dismissed terminal activity from both items and primary", async () => {
  const failed = activity("generation:dismissed", "failed", { djId: null });
  mockActivities = [failed];
  const { result } = await renderActivity();
  await waitFor(() => expect(result.current.primary?.id).toBe(failed.id));

  await act(async () => result.current.markSeen(failed));

  await waitFor(() => expect(result.current.items).toHaveLength(0));
  expect(result.current.primary).toBeNull();
});

test("retries a recoverable slow mix, replaces it in cache, and keeps one active item through a failed refetch", async () => {
  jest.spyOn(Date.prototype, "getHours").mockReturnValue(17);
  const slow = activity("generation:old-job", "slow", {
    error: null,
    failureReason: null,
    recoveryAvailable: true,
  });
  mockActivities = [slow];
  const queryClient = client();
  queryClient.setQueryData(queryKeys.generationJobs.activity("user-a"), [slow]);
  const invalidate = jest
    .spyOn(queryClient, "invalidateQueries")
    .mockRejectedValue(new Error("refetch remains failed"));
  const { result } = await renderActivity(queryClient);
  await waitFor(() => expect(result.current.activeCount).toBe(1));

  await act(async () => result.current.retryActivity(slow));

  expect(supabase.functions.invoke).toHaveBeenCalledWith("generate-mix", {
    body: {
      djId: "dj-1",
      language: "en",
      localHour: 17,
      lyrics: "neon rain",
    },
  });
  expect(queryClient.getQueryData(queryKeys.generationJobs.activity("user-a"))).toEqual([
    expect.objectContaining({
      id: "generation:job-2",
      status: "queued",
      djId: "dj-1",
      retryLyrics: "neon rain",
    }),
  ]);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.generationJobs.activity("user-a"),
  });
  const receipts = JSON.parse(mockStored.get(receiptKey("user-a")) ?? "{}");
  expect(receipts["generation:old-job"].seenAt).not.toBeNull();
  expect(result.current.retryingIds.has("generation:old-job")).toBe(false);
  expect(result.current.activeCount).toBe(1);
});

test("same-ID retry refreshes cache without creating a seen receipt", async () => {
  const slow = activity("generation:same-job", "slow", {
    recoveryAvailable: true,
  });
  mockActivities = [slow];
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { jobId: "same-job" },
    error: null,
  } as never);
  const queryClient = client();
  queryClient.setQueryData(queryKeys.generationJobs.activity("user-a"), [slow]);
  jest.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const { result } = await renderActivity(queryClient);
  await waitFor(() => expect(result.current.activeCount).toBe(1));

  await act(async () => result.current.retryActivity(slow));

  expect(queryClient.getQueryData<ActivityItem[]>(
    queryKeys.generationJobs.activity("user-a"),
  )?.[0]).toMatchObject({
    id: "generation:same-job",
    status: "slow",
    recoveryAvailable: false,
  });
  expect(mockStored.get(receiptKey("user-a"))).toBeUndefined();
});

test.each([
  [{ data: null, error: new Error("raw invoke error") }, "invoke error"],
  [{ data: {}, error: null }, "malformed success"],
] as const)("keeps the old row actionable after %s", async (response, _label) => {
  const failed = activity("generation:old-job", "failed");
  mockActivities = [failed];
  jest.mocked(supabase.functions.invoke).mockResolvedValue(response as never);
  const queryClient = client();
  queryClient.setQueryData(queryKeys.generationJobs.activity("user-a"), [failed]);
  const { result } = await renderActivity(queryClient);
  await waitFor(() => expect(result.current.items).toHaveLength(1));

  await act(async () => result.current.retryActivity(failed));

  expect(queryClient.getQueryData(queryKeys.generationJobs.activity("user-a"))).toEqual([
    failed,
  ]);
  expect(mockToastError).toHaveBeenCalledWith(
    "The operation couldn't be completed.",
  );
  expect(JSON.stringify(mockToastError.mock.calls)).not.toContain("raw invoke error");
  expect(result.current.retryingIds.has(failed.id)).toBe(false);
});

test("guards unsupported retries and duplicate taps until the accepted request settles", async () => {
  let resolveInvoke!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () => new Promise((resolve) => (resolveInvoke = resolve)) as never,
  );
  const failed = activity("generation:failed", "failed");
  const ready = activity("generation:ready", "ready");
  mockActivities = [failed, ready];
  const { result } = await renderActivity();
  await waitFor(() => expect(result.current.items).toHaveLength(2));

  let first!: Promise<void>;
  await act(async () => {
    first = result.current.retryActivity(failed);
    void result.current.retryActivity(failed);
    void result.current.retryActivity(ready);
    await Promise.resolve();
  });
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(result.current.retryingIds.has(failed.id)).toBe(true),
  );

  await act(async () => {
    resolveInvoke({ data: { jobId: "replacement" }, error: null });
    await first;
  });
  expect(result.current.retryingIds.has(failed.id)).toBe(false);
});

test("preserves each user's retry flight across account switches", async () => {
  const invokeResolvers: ((value: unknown) => void)[] = [];
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () =>
      new Promise((resolve) => {
        invokeResolvers.push(resolve);
      }) as never,
  );
  const failed = activity("generation:account-race", "failed");
  mockActivities = [failed];
  const rendered = await renderActivity();
  await waitFor(() => expect(rendered.result.current.items).toHaveLength(1));

  let first!: Promise<void>;
  await act(async () => {
    first = rendered.result.current.retryActivity(failed);
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(rendered.result.current.retryingIds.has(failed.id)).toBe(true),
  );

  mockUserId = "user-b";
  mockActivities = [];
  await rendered.rerender(undefined);
  await waitFor(() => expect(rendered.result.current.retryingIds.size).toBe(0));

  mockUserId = "user-a";
  mockActivities = [failed];
  await rendered.rerender(undefined);
  await waitFor(() =>
    expect(rendered.result.current.retryingIds.has(failed.id)).toBe(true),
  );

  let second!: Promise<void>;
  await act(async () => {
    second = rendered.result.current.retryActivity(failed);
    await Promise.resolve();
  });
  const invokeCountBeforeSettlement = jest.mocked(supabase.functions.invoke)
    .mock.calls.length;

  await act(async () => {
    invokeResolvers.forEach((resolve) =>
      resolve({ data: { jobId: "account-race" }, error: null }),
    );
    await Promise.all([first, second]);
  });

  expect(invokeCountBeforeSettlement).toBe(1);
  expect(rendered.result.current.retryingIds.has(failed.id)).toBe(false);
});

test("logs bounded raw activity errors but never displays them in a toast", async () => {
  const log = jest.mocked(console.error);
  mockActivities = [activity("generation:failed", "failed")];
  await renderActivity();

  await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  expect(mockToastError).toHaveBeenCalledWith(
    "Mix generation needs attention",
    "The mix couldn't be completed. You can try again.",
  );
  expect(JSON.stringify(mockToastError.mock.calls)).not.toContain(
    "raw provider failure",
  );
  expect(log).toHaveBeenCalledWith(
    "Activity generation failed",
    expect.objectContaining({
      id: "generation:failed",
      error: "raw provider failure",
    }),
  );
});
