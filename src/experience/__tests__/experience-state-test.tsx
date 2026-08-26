import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";

import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useAuthStore } from "@/src/stores/auth-store";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { experienceActions } from "@/shared/experience-action";
import {
  useClaimPreferenceNudge,
  useExperienceState,
  type ExperienceState,
} from "../experience-state";

jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}));
jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: jest.fn() }));

const userA = "user-a";
const userB = "user-b";
const trackId = "00000000-0000-4000-8000-000000000201";
let mockUserId = userA;

const rowA = {
  intro_version_seen: 2,
  first_owned_track_id: trackId,
  first_owned_track_ready_at: "2026-08-25T12:00:00.000Z",
  preference_nudge_status: "eligible",
  preference_nudge_track_id: trackId,
};

function session(userId: string): Session {
  return {
    access_token: `token-${userId}`,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
    },
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

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = userA;
  useAuthStore.setState({ session: session(userA) });
  jest.mocked(useCurrentUser).mockImplementation(
    () => ({ id: mockUserId }) as never,
  );
  jest.mocked(supabase.from).mockImplementation(() => {
    let selectedUserId = "";
    let builder: {
      select: jest.Mock;
      eq: jest.Mock;
      maybeSingle: jest.Mock;
    };
    builder = {
      select: jest.fn(() => builder),
      eq: jest.fn((_column: string, value: string) => {
        selectedUserId = value;
        return builder;
      }),
      maybeSingle: jest.fn(async () => ({
        data: selectedUserId === userA ? rowA : null,
        error: null,
      })),
    };
    return builder as never;
  });
});

afterEach(() => useAuthStore.setState({ session: null }));

test("reads only the current user's experience state into its dedicated query key", async () => {
  const queryClient = client();
  const view = await renderHook(() => useExperienceState(), {
    wrapper: wrapper(queryClient),
  });

  await waitFor(() => expect(view.result.current.data).toEqual<ExperienceState>({
    introVersionSeen: 2,
    firstOwnedTrackId: trackId,
    firstOwnedTrackReadyAt: "2026-08-25T12:00:00.000Z",
    preferenceNudgeStatus: "eligible",
    preferenceNudgeTrackId: trackId,
  }));
  expect(queryClient.getQueryData(queryKeys.experienceState.me(userA))).toEqual({
    introVersionSeen: 2,
    firstOwnedTrackId: trackId,
    firstOwnedTrackReadyAt: "2026-08-25T12:00:00.000Z",
    preferenceNudgeStatus: "eligible",
    preferenceNudgeTrackId: trackId,
  });
  await view.unmount();
});

test("claims a nudge through the captured user's Edge authorization", async () => {
  jest.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { state: rowA },
    error: null,
  } as never);
  const queryClient = client();
  const view = await renderHook(() => useClaimPreferenceNudge(), {
    wrapper: wrapper(queryClient),
  });

  await act(async () => { await view.result.current.mutateAsync(trackId); });

  expect(supabase.functions.invoke).toHaveBeenCalledWith("experience-state", {
    body: experienceActions.claimNudge(trackId),
    headers: { Authorization: `Bearer token-${userA}` },
  });
  expect(queryClient.getQueryData(queryKeys.experienceState.me(userA))).toEqual({
    introVersionSeen: 2,
    firstOwnedTrackId: trackId,
    firstOwnedTrackReadyAt: "2026-08-25T12:00:00.000Z",
    preferenceNudgeStatus: "eligible",
    preferenceNudgeTrackId: trackId,
  });
  await view.unmount();
});

test("does not write a completed mutation into a new user's experience cache", async () => {
  const request = deferred<{ data: { state: unknown }; error: null }>();
  jest.mocked(supabase.functions.invoke).mockReturnValue(request.promise as never);
  const queryClient = client();
  const view = await renderHook(() => useClaimPreferenceNudge(), {
    wrapper: wrapper(queryClient),
  });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = view.result.current.mutateAsync(trackId);
    await Promise.resolve();
  });
  await act(async () => { useAuthStore.setState({ session: session(userB) }); });
  mockUserId = userB;
  await view.rerender(undefined);
  await act(async () => {
    request.resolve({ data: { state: rowA }, error: null });
    await mutation;
  });

  expect(queryClient.getQueryData(queryKeys.experienceState.me(userA))).toBeUndefined();
  expect(queryClient.getQueryData(queryKeys.experienceState.me(userB))).toBeUndefined();
  await view.unmount();
});
