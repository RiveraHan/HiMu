import {
  disposePreferenceCommitQueues,
  getOrCreatePreferenceCommitQueue,
  PreferenceCommitQueue,
  type PreferencePatch,
} from "../preference-commit-queue";
import { queryKeys } from "@/src/api/queries";
import { useMusicPreferences } from "../use-music-preferences";
import type { MusicPreferences } from "@/src/types/music-preferences";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type PropsWithChildren } from "react";

const mockPreferenceRead = jest.fn<
  Promise<{ data: unknown; error: null }>,
  []
>();

jest.mock("../use-auth", () => ({
  useCurrentUser: () => ({ id: "A" }),
}));
jest.mock("@/src/api/supabase", () => {
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "maybeSingle"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (onFulfilled: unknown, onRejected: unknown) =>
    mockPreferenceRead().then(onFulfilled as never, onRejected as never);
  return { supabase: { from: jest.fn(() => builder) } };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const baseline: MusicPreferences = {
  genres: [],
  excludedMoods: [],
  vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
  aiFrequency: "optimal",
  discoveryDepth: false,
};

const ensureGenre = (genre: string, present: boolean): PreferencePatch =>
  (current) => ({
    ...current,
    genres: present
      ? current.genres.includes(genre)
        ? current.genres
        : [...current.genres, genre]
      : current.genres.filter((value) => value !== genre),
  });

test("optimistically replays rapid edits but persists one cumulative head at a time", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const persisted: MusicPreferences[] = [];
  const writes: MusicPreferences[] = [];
  const persist = jest
    .fn()
    .mockImplementationOnce((snapshot: MusicPreferences) => {
      persisted.push(snapshot);
      return first.promise;
    })
    .mockImplementationOnce((snapshot: MusicPreferences) => {
      persisted.push(snapshot);
      return second.promise;
    });
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic: (next) => writes.push(next),
    persist,
    cancel: jest.fn(),
    invalidate: jest.fn(),
    onFailure: jest.fn(),
  });

  queue.commit(ensureGenre("Ambient", true));
  queue.commit((current) => ({ ...current, discoveryDepth: true }));

  expect(writes.at(-1)).toMatchObject({
    genres: ["Ambient"],
    discoveryDepth: true,
  });
  expect(persist).toHaveBeenCalledTimes(1);
  first.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(persist).toHaveBeenCalledTimes(2);
  expect(persisted[1]).toMatchObject({
    genres: ["Ambient"],
    discoveryDepth: true,
  });
  second.resolve();
  await queue.whenIdle();
});
test("a failed head rolls back only itself and preserves a newer same-chip intent", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const writes: MusicPreferences[] = [];
  const onFailure = jest.fn();
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic: (next) => writes.push(next),
    persist: jest
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise),
    cancel: jest.fn(),
    invalidate: jest.fn(),
    onFailure,
  });

  queue.commit(ensureGenre("Ambient", true));
  queue.commit(ensureGenre("Ambient", false));
  first.reject(new Error("first failed"));
  await Promise.resolve();
  await Promise.resolve();

  expect(writes.at(-1)?.genres).toEqual([]);
  expect(onFailure).toHaveBeenCalledTimes(1);
  second.resolve();
  await queue.whenIdle();
  expect(writes.at(-1)?.genres).toEqual([]);
});

test("dispose makes an old user's deferred completion invisible", async () => {
  const save = deferred<void>();
  const writeOptimistic = jest.fn();
  const invalidate = jest.fn();
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic,
    persist: () => save.promise,
    cancel: jest.fn(),
    invalidate,
    onFailure: jest.fn(),
  });

  queue.commit(ensureGenre("House", true));
  queue.dispose();
  save.resolve();
  await Promise.resolve();
  await Promise.resolve();

  expect(writeOptimistic).toHaveBeenCalledTimes(1);
  expect(invalidate).not.toHaveBeenCalled();
});

test("a same-user remount reuses the writer but refreshes callbacks for queued work", async () => {
  const firstSave = deferred<void>();
  const secondSave = deferred<void>();
  const client = new QueryClient();
  const originalPersist = jest.fn(() => firstSave.promise);
  const remountedPersist = jest.fn(() => secondSave.promise);
  const options = {
    baseline,
    writeOptimistic: jest.fn(),
    cancel: jest.fn(),
    invalidate: jest.fn(),
    onFailure: jest.fn(),
  };
  const queue = getOrCreatePreferenceCommitQueue(client, "A", {
    ...options,
    persist: originalPersist,
  });

  queue.commit(ensureGenre("Ambient", true));
  queue.commit((current) => ({ ...current, discoveryDepth: true }));
  const remountedQueue = getOrCreatePreferenceCommitQueue(client, "A", {
    ...options,
    persist: remountedPersist,
  });
  expect(remountedQueue).toBe(queue);

  firstSave.resolve();
  await Promise.resolve();
  await Promise.resolve();

  expect(originalPersist).toHaveBeenCalledTimes(1);
  expect(remountedPersist).toHaveBeenCalledWith(
    expect.objectContaining({
      genres: ["Ambient"],
      discoveryDepth: true,
    }),
  );

  secondSave.resolve();
  await queue.whenIdle();
  disposePreferenceCommitQueues(client);
  client.clear();
});

test("drains a commit queued while the idle invalidation is still pending", async () => {
  const firstInvalidation = deferred<void>();
  const persist = jest.fn(async () => undefined);
  const cancel = jest.fn(async () => undefined);
  const invalidate = jest
    .fn()
    .mockImplementationOnce(() => firstInvalidation.promise)
    .mockResolvedValue(undefined);
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic: jest.fn(),
    persist,
    cancel,
    invalidate,
    onFailure: jest.fn(),
  });

  queue.commit(ensureGenre("Ambient", true));
  await Promise.resolve();
  await Promise.resolve();
  expect(invalidate).toHaveBeenCalledTimes(1);

  queue.commit((current) => ({ ...current, discoveryDepth: true }));
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(persist).toHaveBeenCalledTimes(1);

  firstInvalidation.resolve();
  await queue.whenIdle();

  expect(persist).toHaveBeenCalledTimes(2);
  expect(persist).toHaveBeenLastCalledWith(
    expect.objectContaining({
      genres: ["Ambient"],
      discoveryDepth: true,
    }),
  );
  expect(invalidate).toHaveBeenCalledTimes(2);
});

test("first failure preserves and persists a newer unrelated preference", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const writes: MusicPreferences[] = [];
  const persisted: MusicPreferences[] = [];
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic: (next) => writes.push(next),
    persist: jest
      .fn()
      .mockImplementationOnce((next) => {
        persisted.push(next);
        return first.promise;
      })
      .mockImplementationOnce((next) => {
        persisted.push(next);
        return second.promise;
      }),
    cancel: jest.fn(),
    invalidate: jest.fn(),
    onFailure: jest.fn(),
  });

  queue.commit(ensureGenre("Ambient", true));
  queue.commit((current) => ({ ...current, discoveryDepth: true }));
  first.reject(new Error("first failed"));
  await Promise.resolve();
  await Promise.resolve();

  expect(writes.at(-1)).toMatchObject({ genres: [], discoveryDepth: true });
  expect(persisted[1]).toMatchObject({ genres: [], discoveryDepth: true });
  second.resolve();
  await queue.whenIdle();
  expect(writes.at(-1)).toMatchObject({ genres: [], discoveryDepth: true });
});

test("second failure rolls back only itself after the first preference commits", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const writes: MusicPreferences[] = [];
  const onFailure = jest.fn();
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic: (next) => writes.push(next),
    persist: jest
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise),
    cancel: jest.fn(),
    invalidate: jest.fn(),
    onFailure,
  });

  queue.commit(ensureGenre("Ambient", true));
  queue.commit((current) => ({ ...current, discoveryDepth: true }));
  first.resolve();
  await Promise.resolve();
  await Promise.resolve();
  second.reject(new Error("second failed"));
  await queue.whenIdle();

  expect(writes.at(-1)).toMatchObject({
    genres: ["Ambient"],
    discoveryDepth: false,
  });
  expect(onFailure).toHaveBeenCalledTimes(1);
});

test("ignores a stale refetch baseline while a local commit is pending", async () => {
  const save = deferred<void>();
  const writes: MusicPreferences[] = [];
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic: (next) => writes.push(next),
    persist: () => save.promise,
    cancel: jest.fn(),
    invalidate: jest.fn(),
    onFailure: jest.fn(),
  });

  queue.commit(ensureGenre("Ambient", true));
  queue.syncBaseline({ ...baseline, genres: ["House"] });
  save.resolve();
  await queue.whenIdle();

  expect(writes.at(-1)?.genres).toEqual(["Ambient"]);
});

test("rolls back a failed second same-chip toggle to the first committed intent", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const writes: MusicPreferences[] = [];
  const queue = new PreferenceCommitQueue({
    baseline,
    writeOptimistic: (next) => writes.push(next),
    persist: jest
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise),
    cancel: jest.fn(),
    invalidate: jest.fn(),
    onFailure: jest.fn(),
  });

  queue.commit(ensureGenre("Ambient", true));
  queue.commit(ensureGenre("Ambient", false));
  expect(writes.at(-1)?.genres).toEqual([]);

  first.resolve();
  await Promise.resolve();
  await Promise.resolve();
  second.reject(new Error("second toggle failed"));
  await queue.whenIdle();

  expect(writes.at(-1)?.genres).toEqual(["Ambient"]);
});

test("a real deferred refetch cannot overwrite an optimistic serialized save", async () => {
  const staleRefetch = deferred<{ data: unknown; error: null }>();
  const save = deferred<void>();
  const key = queryKeys.musicPreferences.me("A");
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  client.setQueryData(key, baseline);
  const Wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  mockPreferenceRead
    .mockReset()
    .mockReturnValueOnce(staleRefetch.promise)
    .mockResolvedValue({
      data: {
        genres: ["Ambient"],
        moods: [],
        vibe_mapping: {
          organic_electronic: 0.5,
          melancholic_euphoric: 0.5,
        },
        ai_frequency: "optimal",
        discovery_depth: false,
      },
      error: null,
    });
  const hook = await renderHook(() => useMusicPreferences(), {
    wrapper: Wrapper,
  });
  expect(hook.result.current.data).toEqual(baseline);

  const refetch = hook.result.current.refetch();
  await waitFor(() => expect(mockPreferenceRead).toHaveBeenCalledTimes(1));
  const queue = new PreferenceCommitQueue({
    baseline,
    cancel: () => client.cancelQueries({ queryKey: key }),
    writeOptimistic: (next) => client.setQueryData(key, next),
    persist: () => save.promise,
    invalidate: () => client.invalidateQueries({ queryKey: key }),
    onFailure: jest.fn(),
  });

  await act(async () => {
    queue.commit(ensureGenre("Ambient", true));
    await Promise.resolve();
  });
  expect(client.getQueryData<MusicPreferences>(key)?.genres).toEqual([
    "Ambient",
  ]);

  await act(async () => {
    staleRefetch.resolve({
      data: {
        genres: [],
        moods: [],
        vibe_mapping: {
          organic_electronic: 0.5,
          melancholic_euphoric: 0.5,
        },
        ai_frequency: "optimal",
        discovery_depth: false,
      },
      error: null,
    });
    await refetch;
  });
  expect(client.getQueryData<MusicPreferences>(key)?.genres).toEqual([
    "Ambient",
  ]);

  await act(async () => {
    save.resolve();
    await queue.whenIdle();
  });
  expect(client.getQueryData<MusicPreferences>(key)?.genres).toEqual([
    "Ambient",
  ]);
  await hook.unmount();
  client.clear();
});
