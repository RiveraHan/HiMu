import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { BETA_SMOKE_TRACK, BETA_SMOKE_TRACK_ID, BETA_SMOKE_USER_ID } from "@/src/beta-smoke";
import { supabase } from "@/src/api/supabase";
import { useIsFavorited, useToggleFavorite } from "@/src/hooks/use-favorites";
import { useTrackOwnership } from "@/src/hooks/use-home";
import { useTrackPrivateDetails } from "@/src/hooks/use-track-private-details";

let mockUser: { id: string } | null = { id: BETA_SMOKE_USER_ID };

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => mockUser,
}));
jest.mock("@/src/api/supabase", () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
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
  mockUser = { id: BETA_SMOKE_USER_ID };
  process.env.EXPO_PUBLIC_BETA_SMOKE = "1";
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_BETA_SMOKE;
});

test("the exact smoke Player fixture never reaches Supabase ownership, private-details, or favorites boundaries", async () => {
  const view = await renderHook(() => ({
    ownership: useTrackOwnership(BETA_SMOKE_TRACK_ID),
    privateDetails: useTrackPrivateDetails(BETA_SMOKE_TRACK_ID, true),
    favorite: useIsFavorited(BETA_SMOKE_TRACK_ID),
    toggleFavorite: useToggleFavorite(),
  }), { wrapper: wrapper() });

  await waitFor(() => {
    expect(view.result.current.ownership.fetchStatus).toBe("idle");
    expect(view.result.current.privateDetails.fetchStatus).toBe("idle");
    expect(view.result.current.favorite.fetchStatus).toBe("idle");
  });
  expect(view.result.current.ownership.data).toBe(false);
  expect(view.result.current.privateDetails.data).toBeNull();
  expect(view.result.current.favorite.data).toBe(false);
  expect(supabase.from).not.toHaveBeenCalled();

  await act(async () => {
    await view.result.current.toggleFavorite.mutateAsync({
      track: BETA_SMOKE_TRACK,
      isFavorited: false,
    });
  });
  expect(supabase.from).not.toHaveBeenCalled();
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
