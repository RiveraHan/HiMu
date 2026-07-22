import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { supabase } from "@/src/api/supabase";
import type { UserPreferences } from "@/src/types/preferences";
import { useCurrentUser } from "../use-auth";
import { useSettings, useUpdateSettings } from "../use-settings";

jest.mock("../use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const profiles: Record<string, UserPreferences> = {
  "user-1": {
    language: "en",
    audio: { lossless: false, downloadQuality: "high" },
    notifications: { push: true, emailNewsletters: false },
  },
  "user-2": {
    language: "es",
    audio: { lossless: true, downloadQuality: "lossless" },
    notifications: { push: false, emailNewsletters: true },
  },
};

function queryClient() {
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(supabase.from).mockImplementation(() => {
    let selectedUserId = "";
    const maybeSingle = jest.fn(async () => ({
      data: { preferences: profiles[selectedUserId] },
      error: null,
    }));
    const selectBuilder = {
      eq: jest.fn(),
      maybeSingle,
    };
    selectBuilder.eq.mockImplementation((_field: string, userId: string) => {
      selectedUserId = userId;
      return selectBuilder;
    });
    return {
      select: jest.fn(() => selectBuilder),
      update: jest.fn(),
    } as never;
  });
});

test("switching users reads from separate settings cache entries", async () => {
  const client = queryClient();
  jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
  const view = await renderHook(() => useSettings(), {
    wrapper: wrapper(client),
  });
  await waitFor(() => expect(view.result.current.data?.language).toBe("en"));

  jest.mocked(useCurrentUser).mockReturnValue({ id: "user-2" } as never);
  await view.rerender(undefined);

  await waitFor(() => expect(view.result.current.data?.language).toBe("es"));
  expect(client.getQueryData(["settings", "me", "user-1"])).toEqual(
    profiles["user-1"],
  );
  expect(client.getQueryData(["settings", "me", "user-2"])).toEqual(
    profiles["user-2"],
  );
});

test("an update targets and optimistically changes only the current user", async () => {
  const updateGate = deferred<{ error: null }>();
  const updateEq = jest.fn(() => updateGate.promise);
  jest.mocked(supabase.from).mockReturnValue({
    update: jest.fn(() => ({ eq: updateEq })),
  } as never);
  const client = queryClient();
  client.setQueryData(["settings", "me", "user-1"], profiles["user-1"]);
  client.setQueryData(["settings", "me", "user-2"], profiles["user-2"]);
  jest.mocked(useCurrentUser).mockReturnValue({ id: "user-2" } as never);
  const view = await renderHook(() => useUpdateSettings(), {
    wrapper: wrapper(client),
  });
  const next = { ...profiles["user-2"], language: "system" as const };

  let update!: Promise<void>;
  await act(async () => {
    update = view.result.current.mutateAsync(next);
    await Promise.resolve();
  });

  expect(client.getQueryData(["settings", "me", "user-1"])).toEqual(
    profiles["user-1"],
  );
  expect(client.getQueryData(["settings", "me", "user-2"])).toEqual(next);
  expect(updateEq).toHaveBeenCalledWith("id", "user-2");

  await act(async () => {
    updateGate.resolve({ error: null });
    await update;
  });
});
