import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useTrackPrivateDetails } from "../use-track-private-details";
import { supabase } from "@/src/api/supabase";

let mockUser: { id: string } | null = { id: "owner" };

jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: () => mockUser }));
jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn() },
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: "owner" };
});

test("loads private lyrics and the source DJ only for the authenticated owner", async () => {
  const privateSingle = jest.fn().mockResolvedValue({
    data: { track_id: "track-one", confirmed_lyrics: "[Verse]\nMine\n[Chorus]\nStill mine" },
    error: null,
  });
  const trackSingle = jest.fn().mockResolvedValue({
    data: { dj_id: "dj-one" },
    error: null,
  });
  jest.mocked(supabase.from)
    .mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: privateSingle }) }),
    } as never)
    .mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: trackSingle }) }),
    } as never);

  const view = await renderHook(
    () => useTrackPrivateDetails("track-one", true),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(view.result.current.data).toEqual({
    trackId: "track-one",
    confirmedLyrics: "[Verse]\nMine\n[Chorus]\nStill mine",
    djId: "dj-one",
  }));
  expect(supabase.from).toHaveBeenNthCalledWith(1, "track_private_details");
  expect(supabase.from).toHaveBeenNthCalledWith(2, "tracks");
});

test.each([
  [null, true],
  [{ id: "listener" }, false],
] as const)("does not request private data without an owner session", async (user, isOwner) => {
  mockUser = user;
  const view = await renderHook(
    () => useTrackPrivateDetails("track-one", isOwner),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(view.result.current.fetchStatus).toBe("idle"));
  expect(supabase.from).not.toHaveBeenCalled();
});
