import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useTasteProfile } from "@/src/hooks/use-taste-profile";
import type { MusicPreferences } from "@/src/types/music-preferences";

let mockPreferences: MusicPreferences = {
  genres: ["Ambient"],
  excludedMoods: ["Focus"],
  atmosphere: "balanced" as const,
};

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => null,
}));
jest.mock("@/src/api/supabase", () => ({ supabase: {} }));
jest.mock("@/src/hooks/use-music-preferences", () => ({
  useMusicPreferences: () => ({ data: mockPreferences }),
}));

beforeEach(() => {
  mockPreferences = {
    genres: ["Ambient"],
    excludedMoods: ["Focus"],
    atmosphere: "balanced",
  };
});

test("keeps excluded moods stable across a recreated atmosphere-only preference", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useTasteProfile(), { wrapper: Wrapper });
  const excludedMoods = hook.result.current.excludedMoods;

  mockPreferences = {
    genres: ["Ambient"],
    excludedMoods: ["Focus"],
    atmosphere: "intense",
  };
  await hook.rerender(undefined);

  expect(hook.result.current.atmosphere).toBe("intense");
  expect(hook.result.current.excludedMoods).toBe(excludedMoods);

  hook.unmount();
  client.clear();
});
