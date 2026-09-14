import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { AuthScopeChangedError } from "@/src/api/auth-scope";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useTrackMoment } from "@/src/hooks/use-track-moment";

let mockCurrentUserId = "00000000-0000-4000-8000-000000000011";

jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/api/auth-scope", () => {
  const actual = jest.requireActual("@/src/api/auth-scope");
  return {
    ...actual,
    captureAuthScope: (userId: string) => {
      if (mockCurrentUserId !== userId) throw new actual.AuthScopeChangedError();
      return { userId, authorization: `Bearer fixture-${userId}` };
    },
    assertCurrentMutationUser: (userId: string) => {
      if (mockCurrentUserId !== userId) throw new actual.AuthScopeChangedError();
    },
    isCurrentMutationUser: (userId: string) => mockCurrentUserId === userId,
  };
});
jest.mock("@/src/api/supabase", () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

const USER_ID = "00000000-0000-4000-8000-000000000011";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000012";
const TRACK_ID = "00000000-0000-4000-8000-000000000021";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
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

function queryResult<T>(value: T) {
  const builder = {
    eq: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(async () => value),
    setHeader: jest.fn(),
  };
  builder.eq.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.setHeader.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUserId = USER_ID;
  jest.mocked(useCurrentUser).mockReturnValue({ id: USER_ID } as never);
});

test("loads only an owned ready generated Moment and keeps owner and feedback caches distinct", async () => {
  const tracks = queryResult({
    data: {
      id: TRACK_ID,
      owner_id: USER_ID,
      is_public: false,
      is_ai_generated: true,
      audio_url: "r2-private://tracks/generated/user/track.mp3",
      album_art_url: "https://media.himu.test/cover.jpg",
    },
    error: null,
  });
  const jobs = queryResult({ data: { id: "job-ready" }, error: null });
  const feedback = queryResult({
    data: { surprised: true, would_share: null },
    error: null,
  });
  jest.mocked(supabase.from).mockImplementation((table: string) => ({
    select: jest.fn(() =>
      table === "tracks" ? tracks : table === "generation_jobs" ? jobs : feedback),
  }) as never);

  const client = createClient();
  const view = await renderHook(() => useTrackMoment(TRACK_ID), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(view.result.current.owner.data).toEqual({
    trackId: TRACK_ID,
    visibility: "private",
    audioUrl: "r2-private://tracks/generated/user/track.mp3",
    albumArtUrl: "https://media.himu.test/cover.jpg",
  }));
  await waitFor(() => expect(view.result.current.feedback.data).toEqual({
    surprised: true,
    wouldShare: null,
  }));

  expect(client.getQueryData(queryKeys.trackMoments.owner(USER_ID, TRACK_ID)))
    .toEqual(view.result.current.owner.data);
  expect(client.getQueryData(queryKeys.trackMoments.feedback(USER_ID, TRACK_ID)))
    .toEqual(view.result.current.feedback.data);
  expect(tracks.setHeader).toHaveBeenCalledWith(
    "Authorization",
    `Bearer fixture-${USER_ID}`,
  );
  expect(jobs.setHeader).toHaveBeenCalledWith(
    "Authorization",
    `Bearer fixture-${USER_ID}`,
  );
  expect(feedback.setHeader).toHaveBeenCalledWith(
    "Authorization",
    `Bearer fixture-${USER_ID}`,
  );
  await view.unmount();
});

test("upserts only the changed feedback answer so the database preserves the other value atomically", async () => {
  const returned = queryResult({
    data: { surprised: false, would_share: true },
    error: null,
  });
  const writeBuilder = {
    select: jest.fn(() => returned),
    setHeader: jest.fn(),
  };
  writeBuilder.setHeader.mockReturnValue(writeBuilder);
  const upsert = jest.fn(() => writeBuilder);
  jest.mocked(supabase.from).mockImplementation((table: string) => {
    if (table !== "track_experience_feedback") return {} as never;
    return { upsert } as never;
  });

  const client = createClient();
  const view = await renderHook(() => useTrackMoment(undefined), {
    wrapper: wrapper(client),
  });

  await act(async () => {
    await view.result.current.setFeedback.mutateAsync({
      trackId: TRACK_ID,
      surprised: false,
    });
  });

  expect(upsert).toHaveBeenCalledWith({
    user_id: USER_ID,
    track_id: TRACK_ID,
    surprised: false,
  }, { onConflict: "user_id,track_id" });
  await waitFor(() => expect(view.result.current.setFeedback.data).toEqual({
    surprised: false,
    wouldShare: true,
  }));
  expect(client.getQueryData(queryKeys.trackMoments.feedback(USER_ID, TRACK_ID)))
    .toEqual({ surprised: false, wouldShare: true });
  await view.unmount();
});

test("serializes feedback patches so concurrent answers cannot overwrite one another", async () => {
  let remote = {
    surprised: null as boolean | null,
    would_share: null as boolean | null,
  };
  let active = 0;
  let maxActive = 0;
  const writes: typeof remote[] = [];

  jest.mocked(supabase.from).mockImplementation((table: string) => {
    if (table !== "track_experience_feedback") return {} as never;
    return {
      select: jest.fn(() => queryResult({ data: { ...remote }, error: null })),
      upsert: jest.fn((next: Partial<typeof remote> & {
        user_id: string;
        track_id: string;
      }) => {
        const writeBuilder = {
          select: jest.fn(() => {
            const response = queryResult({
              data: null as typeof remote | null,
              error: null,
            });
            response.maybeSingle.mockImplementation(async () => {
              active += 1;
              maxActive = Math.max(maxActive, active);
              await Promise.resolve();
              remote = {
                surprised: next.surprised ?? remote.surprised,
                would_share: next.would_share ?? remote.would_share,
              };
              writes.push({ ...remote });
              active -= 1;
              return { data: { ...remote }, error: null };
            });
            return response;
          }),
          setHeader: jest.fn(),
        };
        writeBuilder.setHeader.mockReturnValue(writeBuilder);
        return writeBuilder;
      }),
    } as never;
  });

  const view = await renderHook(() => useTrackMoment(undefined), {
    wrapper: wrapper(createClient()),
  });

  await act(async () => {
    await Promise.all([
      view.result.current.setFeedback.mutateAsync({ trackId: TRACK_ID, surprised: true }),
      view.result.current.setFeedback.mutateAsync({ trackId: TRACK_ID, wouldShare: false }),
    ]);
  });

  expect(maxActive).toBe(1);
  expect(writes).toEqual([
    { surprised: true, would_share: null },
    { surprised: true, would_share: false },
  ]);
  await view.unmount();
});

test("a stale feedback response cannot mutate the next user's cache", async () => {
  const gate = Promise.withResolvers<void>();
  const selected = queryResult({
    data: { surprised: null, would_share: null },
    error: null,
  });
  selected.maybeSingle.mockImplementation(async () => {
    await gate.promise;
    return { data: { surprised: null, would_share: null }, error: null };
  });
  jest.mocked(supabase.from).mockReturnValue({
    select: jest.fn(() => selected),
  } as never);

  const client = createClient();
  const view = await renderHook(() => useTrackMoment(undefined), {
    wrapper: wrapper(client),
  });
  let operation!: Promise<unknown>;
  await act(async () => {
    operation = view.result.current.setFeedback.mutateAsync({
      trackId: TRACK_ID,
      surprised: true,
    });
    mockCurrentUserId = OTHER_USER_ID;
    gate.resolve();
    await expect(operation).rejects.toBeInstanceOf(AuthScopeChangedError);
  });
  expect(client.getQueryData(queryKeys.trackMoments.feedback(USER_ID, TRACK_ID)))
    .toBeUndefined();
  expect(client.getQueryData(queryKeys.trackMoments.feedback(OTHER_USER_ID, TRACK_ID)))
    .toBeUndefined();
  await view.unmount();
});

test("visibility changes use only the authenticated Edge action and cache its authoritative response", async () => {
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: {
      trackId: TRACK_ID,
      visibility: "public",
      audioUrl: "https://media.himu.test/tracks/generated/track.moment.mp3",
      albumArtUrl: "https://media.himu.test/cover.jpg",
    },
    error: null,
  } as never);

  const client = createClient();
  const view = await renderHook(() => useTrackMoment(undefined), {
    wrapper: wrapper(client),
  });
  await act(async () => {
    await expect(view.result.current.setVisibility.mutateAsync({
      trackId: TRACK_ID,
      visibility: "public",
    })).resolves.toEqual({
      trackId: TRACK_ID,
      visibility: "public",
      audioUrl: "https://media.himu.test/tracks/generated/track.moment.mp3",
      albumArtUrl: "https://media.himu.test/cover.jpg",
    });
  });

  expect(supabase.functions.invoke).toHaveBeenCalledWith("track-moment", {
    body: { action: "set_visibility", trackId: TRACK_ID, visibility: "public" },
    headers: { Authorization: `Bearer fixture-${USER_ID}` },
  });
  expect(supabase.from).not.toHaveBeenCalled();
  expect(client.getQueryData(queryKeys.trackMoments.owner(USER_ID, TRACK_ID)))
    .toEqual(view.result.current.setVisibility.data);
  await view.unmount();
});

test("a stale visibility result is rejected before owner or public caches change", async () => {
  const gate = Promise.withResolvers<void>();
  jest.mocked(supabase.functions.invoke).mockImplementation(async () => {
    await gate.promise;
    return {
      data: {
        trackId: TRACK_ID,
        visibility: "public",
        audioUrl: "https://media.himu.test/track.mp3",
        albumArtUrl: null,
      },
      error: null,
    } as never;
  });
  const client = createClient();
  const view = await renderHook(() => useTrackMoment(undefined), {
    wrapper: wrapper(client),
  });
  let operation!: Promise<unknown>;
  await act(async () => {
    operation = view.result.current.setVisibility.mutateAsync({
      trackId: TRACK_ID,
      visibility: "public",
    });
    mockCurrentUserId = OTHER_USER_ID;
    gate.resolve();
    await expect(operation).rejects.toBeInstanceOf(AuthScopeChangedError);
  });
  expect(client.getQueryData(queryKeys.trackMoments.owner(USER_ID, TRACK_ID)))
    .toBeUndefined();
  expect(client.getQueryData(queryKeys.publicTracks.detail(TRACK_ID)))
    .toBeUndefined();
  await view.unmount();
});
