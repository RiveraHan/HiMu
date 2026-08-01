import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { queryKeys } from "@/src/api/queries";
import { useGenerationActivity } from "@/src/activity/use-generation-activity";
import { useDJ, useDJTracks } from "@/src/hooks/use-dj";
import { useFavorites, useIsFavorited } from "@/src/hooks/use-favorites";
import {
  useAIMixTracks,
  useDJs,
  useFocusTracks,
  useRecentTracks,
  useTimeOfDayShelf,
  useTrackOwnership,
} from "@/src/hooks/use-home";
import { useMusicPreferences } from "@/src/hooks/use-music-preferences";
import { useOnboarding } from "@/src/hooks/use-onboarding";
import {
  useDjsHeard,
  useListeningTotals,
  useProfile,
} from "@/src/hooks/use-profile";
import { useSettings } from "@/src/hooks/use-settings";
import { useTasteProfile } from "@/src/hooks/use-taste-profile";
import { useVibeCheck } from "@/src/hooks/use-vibe-check";
import { timeOfDayBucket } from "@/src/utils/home-curation";

let mockUserId = "A";

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: mockUserId }),
}));
jest.mock("@/src/api/supabase", () => {
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of [
    "select",
    "eq",
    "gte",
    "not",
    "order",
    "limit",
    "maybeSingle",
    "single",
    "returns",
    "overlaps",
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = jest.fn();
  return { supabase: { from: jest.fn(() => builder) } };
});

const preferences = {
  genres: [],
  excludedMoods: [],
  vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
  aiFrequency: "optimal",
  discoveryDepth: false,
};

function useAllUserQueries() {
  const queries = [
    useFavorites(),
    useIsFavorited("track"),
    useMusicPreferences(),
    useDJs(),
    useAIMixTracks(),
    useFocusTracks(),
    useRecentTracks(60),
    useTimeOfDayShelf(),
    useTrackOwnership("track"),
    useDJ("dj"),
    useDJTracks("dj"),
    useGenerationActivity(),
    useProfile(),
    useListeningTotals(),
    useDjsHeard(),
    useVibeCheck(),
    useSettings(),
    useOnboarding(1),
  ];
  useTasteProfile();
  return queries;
}

function keys(userId: string) {
  const bucket = timeOfDayBucket(new Date().getHours());
  return [
    queryKeys.favorites.all(userId),
    queryKeys.favorites.isFavorited(userId, "track"),
    queryKeys.musicPreferences.me(userId),
    queryKeys.djs.list(userId),
    queryKeys.tracks.aiMix(userId),
    queryKeys.tracks.focus(userId),
    queryKeys.tracks.recent(userId, 60),
    queryKeys.tracks.contextual(userId, bucket),
    queryKeys.tracks.ownership(userId, "track"),
    queryKeys.djs.details(userId, "dj"),
    queryKeys.tracks.byDj(userId, "dj"),
    queryKeys.generationJobs.activity(userId),
    queryKeys.profile.me(userId),
    queryKeys.stats.listening(userId),
    queryKeys.stats.djsHeard(userId),
    queryKeys.stats.vibeCheck(userId),
    queryKeys.settings.me(userId),
    queryKeys.onboarding.current(userId, 1),
    queryKeys.stats.topGenre(userId),
  ];
}

test("actual RLS query hooks never expose A's fresh cache after rerendering as B", async () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  const aKeys = keys("A");
  const fixtures: unknown[] = [
    [],
    false,
    preferences,
    [],
    [],
    [],
    [],
    { bucket: "morning", tracks: [] },
    false,
    { id: "dj" },
    [],
    [],
    { id: "A" },
    0,
    0,
    { days: [] },
    {},
    null,
    "Ambient",
  ];
  aKeys.forEach((key, index) => {
    client.setQueryData(key, fixtures[index]);
  });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  mockUserId = "A";
  const hook = await renderHook(() => useAllUserQueries(), { wrapper: Wrapper });
  expect(hook.result.current.every((query) => query.data !== undefined)).toBe(true);

  mockUserId = "B";
  await hook.rerender(undefined);

  expect(hook.result.current.every((query) => query.data === undefined)).toBe(true);
  keys("B").forEach((key) => expect(client.getQueryData(key)).toBeUndefined());
  aKeys.forEach((key) => expect(client.getQueryData(key)).toBeDefined());
  await hook.unmount();
  client.clear();
});

test("recent-track limits and per-user detail keys never alias", () => {
  expect(queryKeys.tracks.recent("A", 10)).not.toEqual(
    queryKeys.tracks.recent("A", 60),
  );
  expect(queryKeys.tracks.byDj("A", "dj")).not.toEqual(
    queryKeys.tracks.byDj("B", "dj"),
  );
  expect(queryKeys.djs.details("A", "dj")).not.toEqual(
    queryKeys.djs.details("B", "dj"),
  );
});
