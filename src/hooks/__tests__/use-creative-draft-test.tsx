import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import {
  useDjIdentityDrafts,
  useRegenerateTrackField,
  useTrackBriefDraft,
} from "../use-creative-draft";
import { supabase } from "@/src/api/supabase";

let mockCurrent = true;

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "listener" }),
}));
jest.mock("@/src/api/auth-scope", () => {
  const actual = jest.requireActual("@/src/api/auth-scope");
  return {
    ...actual,
    captureAuthScope: (userId: string) => ({
      userId,
      authorization: `Bearer fixture-${userId}`,
    }),
    assertCurrentMutationUser: () => {
      if (!mockCurrent) throw new actual.AuthScopeChangedError();
    },
  };
});
jest.mock("@/src/api/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrent = true;
});

const traits = {
  genres: ["House"],
  moods: ["Dreamy"],
  energy: 6,
  isInstrumental: false,
  vibe: null,
};

test("identity drafting sends the bounded discriminated request with auth scope", async () => {
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { version: 1, kind: "dj-identity", draft: { candidates: [] } },
    error: null,
  } as never);
  const view = await renderHook(() => useDjIdentityDrafts(), { wrapper: wrapper() });
  const { result } = view;

  await act(async () => {
    await result.current.mutateAsync({
      language: "en",
      traits,
      exclude: Array.from({ length: 14 }, (_, index) => ` Past   ${index} `),
    });
  });

  expect(supabase.functions.invoke).toHaveBeenCalledWith(
    "creative-draft",
    expect.objectContaining({
      headers: { Authorization: "Bearer fixture-listener" },
      body: expect.objectContaining({
        version: 1,
        kind: "dj-identity",
        exclude: Array.from({ length: 10 }, (_, index) => `Past ${index + 4}`),
      }),
    }),
  );
  await view.unmount();
});

test("an auth-scope change discards a completed response", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () => new Promise((resolve) => (finish = resolve)) as never,
  );
  const view = await renderHook(() => useTrackBriefDraft(), { wrapper: wrapper() });
  const { result } = view;

  await waitFor(() => expect(result.current).not.toBeNull());
  let promise!: Promise<unknown>;
  await act(async () => {
    promise = result.current.mutateAsync({
      language: "en",
      djId: "dj-1",
      current: {},
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(finish).toBeDefined());
  mockCurrent = false;
  await act(async () => {
    finish({
      data: { version: 1, kind: "track-brief", draft: {} },
      error: null,
    });
    await expect(promise).rejects.toThrow("Authentication scope changed");
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  await view.unmount();
});

test("field mutations keep independent pending and error state", async () => {
  let finishTitle!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    (_name, options) => {
      const kind = (options?.body as { kind: string }).kind;
      if (kind === "track-title") {
        return new Promise((resolve) => (finishTitle = resolve)) as never;
      }
      return Promise.resolve({ data: null, error: new Error("lyrics unavailable") }) as never;
    },
  );
  const titleView = await renderHook(
    () => useRegenerateTrackField("track-title"),
    { wrapper: wrapper() },
  );
  const lyricsView = await renderHook(
    () => useRegenerateTrackField("lyrics"),
    { wrapper: wrapper() },
  );

  await act(async () => {
    titleView.result.current.mutate({ language: "en", djId: "dj-1", current: {} });
    lyricsView.result.current.mutate({ language: "en", djId: "dj-1", current: {} });
    await Promise.resolve();
  });
  await waitFor(() => expect(lyricsView.result.current.isError).toBe(true));
  expect(titleView.result.current.isPending).toBe(true);
  expect(titleView.result.current.error).toBeNull();

  await act(async () => {
    finishTitle({
      data: { version: 1, kind: "track-title", draft: { title: "Glass Antennas" } },
      error: null,
    });
  });
  await waitFor(() => expect(titleView.result.current.isSuccess).toBe(true));
  expect(lyricsView.result.current.error).toEqual(new Error("lyrics unavailable"));
  await titleView.unmount();
  await lyricsView.unmount();
});
