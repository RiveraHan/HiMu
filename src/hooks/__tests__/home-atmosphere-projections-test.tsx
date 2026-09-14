import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import {
  useAIMixTracks,
  useRecentTracks,
  useTimeOfDayShelf,
} from "@/src/hooks/use-home";

const selectedColumns: string[] = [];
const builder: Record<string, jest.Mock> = {};

for (const method of ["eq", "not", "order", "limit", "overlaps", "returns"]) {
  builder[method] = jest.fn(() => builder);
}
builder.select = jest.fn((columns: string) => {
  selectedColumns.push(columns);
  return builder;
});
builder.then = jest.fn((resolve: (value: { data: []; error: null }) => void) =>
  resolve({ data: [], error: null }),
);

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "listener" }),
}));
jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn(() => builder) },
}));

beforeEach(() => {
  selectedColumns.length = 0;
  Object.values(builder).forEach((mock) => mock.mockClear());
});

test("requests energy only for Home pools that use atmosphere weighting", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(
    () => ({
      aiMix: useAIMixTracks(),
      contextual: useTimeOfDayShelf(),
      fresh: useRecentTracks(),
    }),
    { wrapper: Wrapper },
  );

  await waitFor(() => {
    expect(hook.result.current.aiMix.isSuccess).toBe(true);
    expect(hook.result.current.contextual.isSuccess).toBe(true);
    expect(hook.result.current.fresh.isSuccess).toBe(true);
  });

  const automaticQueueProjection =
    "id, title, artist, audio_url, album_art_url, duration, genre, energy_level, mood_tags, owner_id, is_public";
  expect(selectedColumns.filter((columns) => columns === automaticQueueProjection)).toHaveLength(2);
  expect(selectedColumns).toContain(
    "id, title, artist, audio_url, album_art_url, duration, genre, mood_tags, owner_id, is_public, dj_id, created_at, dj:djs(id, name, avatar_url, genre_specialties, owner_id, is_public)",
  );
  hook.unmount();
  client.clear();
});
