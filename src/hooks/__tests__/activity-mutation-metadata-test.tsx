import {
  defaultScheduler,
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { supabase } from "@/src/api/supabase";
import { activityMutationKeys } from "@/src/activity/mutation-keys";
import { useSessionActivities } from "@/src/activity/use-session-activities";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useCreateDJ } from "../use-create-dj";
import { useRegenerateCover } from "../use-home";
import { useUpdateDJ } from "../use-update-dj";

jest.mock("@/src/api/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/api/auth-scope", () => {
  const actual = jest.requireActual("@/src/api/auth-scope");
  return {
    ...actual,
    captureAuthScope: (userId: string) => ({
      userId,
      authorization: `Bearer fixture-${userId}`,
    }),
    isCurrentMutationUser: () => true,
  };
});
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ setCoverForTrack: jest.fn() }),
}));

let currentUserId = "user-a";

function client() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
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

function mutationFor(queryClient: QueryClient, root: readonly unknown[]) {
  return queryClient
    .getMutationCache()
    .findAll({ mutationKey: root, exact: false })
    .at(-1)!;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  currentUserId = "user-a";
  jest.mocked(useCurrentUser).mockImplementation(
    () => ({ id: currentUserId }) as never,
  );
  notifyManager.setScheduler((callback) => callback());
});

afterEach(() => {
  notifyManager.setScheduler(defaultScheduler);
  jest.restoreAllMocks();
});

test("stores create identity, variables, submission context, and returned DJ ID", async () => {
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { djId: "dj-luna", avatarReady: true },
    error: null,
  } as never);
  const queryClient = client();
  jest
    .spyOn(queryClient, "invalidateQueries")
    .mockReturnValue(new Promise(() => undefined));
  const { result } = await renderHook(() => useCreateDJ(), {
    wrapper: wrapper(queryClient),
  });
  const variables = {
    name: "Luna",
    genres: ["Ambient"],
    moods: ["Focus"],
    energy: 5,
    isInstrumental: true,
  };

  await act(async () => {
    await result.current.mutateAsync(variables);
  });
  const mutation = mutationFor(queryClient, activityMutationKeys.createDjRoot);

  expect(mutation.options.mutationKey).toEqual(
    activityMutationKeys.createDj("user-a"),
  );
  expect(mutation.options.gcTime).toBe(Infinity);
  expect(mutation.state.context).toEqual({ submittedUserId: "user-a" });
  expect(mutation.state.variables).toEqual(variables);
  expect(mutation.state.data).toEqual({
    djId: "dj-luna",
    avatarReady: true,
  });
  expect(mutation.state.status).toBe("success");
});

test("stores update identity and returned DJ target", async () => {
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { djId: "dj-luna", avatarUrl: null },
    error: null,
  } as never);
  const queryClient = client();
  jest
    .spyOn(queryClient, "invalidateQueries")
    .mockReturnValue(new Promise(() => undefined));
  const { result } = await renderHook(() => useUpdateDJ(), {
    wrapper: wrapper(queryClient),
  });
  const variables = {
    djId: "dj-luna",
    name: "Luna",
    genres: ["Ambient"],
    moods: ["Focus"],
    energy: 5,
    isInstrumental: true,
    regenerateAvatar: true,
  };

  await act(async () => {
    await result.current.mutateAsync(variables);
  });
  const mutation = mutationFor(queryClient, activityMutationKeys.updateDjRoot);

  expect(mutation.options.mutationKey).toEqual(
    activityMutationKeys.updateDj("user-a"),
  );
  expect(mutation.options.gcTime).toBe(Infinity);
  expect(mutation.state.context).toEqual({ submittedUserId: "user-a" });
  expect(mutation.state.variables).toEqual(variables);
  expect(mutation.state.data).toEqual({ djId: "dj-luna", avatarUrl: null });
  expect(mutation.state.status).toBe("success");
});

test("stores cover title and returns the track target without awaiting invalidation", async () => {
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { album_art_url: "https://example.com/luna.png" },
    error: null,
  } as never);
  const queryClient = client();
  jest
    .spyOn(queryClient, "invalidateQueries")
    .mockReturnValue(new Promise(() => undefined));
  const { result } = await renderHook(() => useRegenerateCover(), {
    wrapper: wrapper(queryClient),
  });

  await act(async () => {
    await result.current.mutateAsync({ trackId: "track-luna", title: "Glow" });
  });
  const mutation = mutationFor(
    queryClient,
    activityMutationKeys.regenerateCoverRoot,
  );

  expect(mutation.options.mutationKey).toEqual(
    activityMutationKeys.regenerateCover("user-a"),
  );
  expect(mutation.options.gcTime).toBe(Infinity);
  expect(mutation.state.context).toEqual({ submittedUserId: "user-a" });
  expect(mutation.state.variables).toEqual({
    trackId: "track-luna",
    title: "Glow",
  });
  expect(mutation.state.data).toEqual({
    trackId: "track-luna",
    title: "Glow",
    albumArtUrl: "https://example.com/luna.png",
  });
  expect(mutation.state.status).toBe("success");
});

test("keeps an in-flight A mutation keyed and contextualized as A after the hook rerenders under B", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () => new Promise((resolve) => (finish = resolve)) as never,
  );
  const queryClient = client();
  const rendered = await renderHook(() => useCreateDJ(), {
    wrapper: wrapper(queryClient),
  });
  const observer = await renderHook(() => useSessionActivities(), {
    wrapper: wrapper(queryClient),
  });

  let mutationPromise!: Promise<unknown>;
  await act(async () => {
    mutationPromise = rendered.result.current.mutateAsync({
      name: "Luna",
      genres: [],
      moods: [],
      energy: 5,
      isInstrumental: true,
    });
    await Promise.resolve();
  });
  expect(observer.result.current).toEqual([
    expect.objectContaining({ kind: "create-dj", status: "running" }),
  ]);

  currentUserId = "user-b";
  await rendered.rerender(undefined);
  await observer.rerender(undefined);
  const mutation = mutationFor(queryClient, activityMutationKeys.createDjRoot);

  expect(mutation.options.mutationKey).toEqual(
    activityMutationKeys.createDj("user-a"),
  );
  expect(mutation.state.context).toEqual({ submittedUserId: "user-a" });
  expect(observer.result.current).toEqual([]);

  await act(async () => {
    finish({ data: { djId: "dj-luna", avatarReady: true }, error: null });
    await mutationPromise;
  });
  expect(observer.result.current).toEqual([]);

  currentUserId = "user-a";
  await observer.rerender(undefined);
  expect(observer.result.current).toEqual([
    expect.objectContaining({
      kind: "create-dj",
      status: "ready",
      djId: "dj-luna",
    }),
  ]);

  act(() => {
    const cache = queryClient.getMutationCache();
    cache.getAll().forEach((cachedMutation) => cache.remove(cachedMutation));
  });
  await waitFor(() => expect(observer.result.current).toEqual([]));
  await observer.unmount();
  await rendered.unmount();
});
