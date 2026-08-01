import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { supabase } from "@/src/api/supabase";
import type {
  UserPreferences,
  UserPreferencesPatch,
} from "@/src/types/preferences";
import { useCurrentUser } from "../use-auth";
import { useSettings, useUpdateSettings } from "../use-settings";

jest.mock("../use-auth", () => ({ useCurrentUser: jest.fn() }));
jest.mock("@/src/api/auth-scope", () => {
  const actual = jest.requireActual("@/src/api/auth-scope");
  return {
    ...actual,
    captureAuthScope: (userId: string) => ({
      userId,
      authorization: `Bearer fixture-${userId}`,
    }),
    assertCurrentMutationUser: jest.fn(),
    isCurrentMutationUser: () => true,
  };
});
jest.mock("@/src/api/supabase", () => ({
  supabase: { from: jest.fn() },
}));

const profileFixtures: Record<string, UserPreferences> = {
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

function clonePreferences(value: UserPreferences): UserPreferences {
  return {
    language: value.language,
    audio: { ...value.audio },
    notifications: { ...value.notifications },
  };
}

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
    const selectBuilder = {
      eq: jest.fn(),
      maybeSingle: jest.fn(async () => ({
        data: { preferences: clonePreferences(profileFixtures[selectedUserId]) },
        error: null,
      })),
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
    profileFixtures["user-1"],
  );
  expect(client.getQueryData(["settings", "me", "user-2"])).toEqual(
    profileFixtures["user-2"],
  );
  await view.unmount();
});

test("serializes field patches per user and merges each against latest remote settings", async () => {
  const remoteProfiles: Record<string, UserPreferences> = {
    "user-1": clonePreferences(profileFixtures["user-1"]),
    "user-2": clonePreferences(profileFixtures["user-2"]),
  };
  const firstWriteGate = deferred<void>();
  const blockedUsers = new Set<string>();
  const selectOrder: string[] = [];
  const updateOrder: { userId: string; preferences: UserPreferences }[] = [];
  const activeByUser = new Map<string, number>();
  const maxActiveByUser = new Map<string, number>();

  jest.mocked(supabase.from).mockImplementation(() => ({
    select: jest.fn(() => {
      let userId = "";
      const builder = {
        eq: jest.fn(),
        maybeSingle: jest.fn(async () => {
          selectOrder.push(userId);
          return {
            data: { preferences: clonePreferences(remoteProfiles[userId]) },
            error: null,
          };
        }),
      };
      builder.eq.mockImplementation((_field: string, nextUserId: string) => {
        userId = nextUserId;
        return builder;
      });
      return builder;
    }),
    update: jest.fn(
      ({ preferences }: { preferences: UserPreferencesPatch | UserPreferences }) => ({
        eq: jest.fn(async (_field: string, userId: string) => {
          const snapshot = preferences as UserPreferences;
          updateOrder.push({
            userId,
            preferences: snapshot,
          });
          const active = (activeByUser.get(userId) ?? 0) + 1;
          activeByUser.set(userId, active);
          maxActiveByUser.set(
            userId,
            Math.max(maxActiveByUser.get(userId) ?? 0, active),
          );

          if (userId === "user-1" && !blockedUsers.has(userId)) {
            blockedUsers.add(userId);
            await firstWriteGate.promise;
          }

          remoteProfiles[userId] = snapshot;
          activeByUser.set(userId, active - 1);
          return { error: null };
        }),
      }),
    ),
  })) as never;

  const client = queryClient();
  client.setQueryData(
    ["settings", "me", "user-1"],
    clonePreferences(profileFixtures["user-1"]),
  );
  client.setQueryData(
    ["settings", "me", "user-2"],
    clonePreferences(profileFixtures["user-2"]),
  );

  jest.mocked(useCurrentUser).mockReturnValue({ id: "user-1" } as never);
  const userOne = await renderHook(
    () => ({
      locale: useUpdateSettings(),
      account: useUpdateSettings(),
    }),
    { wrapper: wrapper(client) },
  );
  let operations!: Promise<void>[];
  await act(async () => {
    operations = [
      userOne.result.current.locale.mutateAsync({ language: "es" }),
      userOne.result.current.account.mutateAsync({ audio: { lossless: true } }),
      userOne.result.current.account.mutateAsync({
        notifications: { push: false },
      }),
    ];
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(updateOrder.some(({ userId }) => userId === "user-1")).toBe(true);
  });
  const userOneStartsBeforeRelease = updateOrder.filter(
    ({ userId }) => userId === "user-1",
  ).length;

  await act(async () => {
    firstWriteGate.resolve();
    await Promise.all(operations);
  });

  await waitFor(() => {
    expect(userOne.result.current.locale.isSuccess).toBe(true);
    expect(userOne.result.current.account.isSuccess).toBe(true);
  });

  await userOne.unmount();
  jest.mocked(useCurrentUser).mockReturnValue({ id: "user-2" } as never);
  const userTwo = await renderHook(() => useUpdateSettings(), {
    wrapper: wrapper(client),
  });
  await act(async () => {
    await userTwo.result.current.mutateAsync({ language: "system" });
  });
  await waitFor(() => expect(userTwo.result.current.isSuccess).toBe(true));

  const userOneSnapshots = updateOrder
    .filter(({ userId }) => userId === "user-1")
    .map(({ preferences }) => preferences);
  expect(userOneStartsBeforeRelease).toBe(1);
  expect(maxActiveByUser).toEqual(
    new Map([
      ["user-1", 1],
      ["user-2", 1],
    ]),
  );
  expect(selectOrder.filter((userId) => userId === "user-1")).toHaveLength(3);
  expect(selectOrder.filter((userId) => userId === "user-2")).toHaveLength(1);
  expect(userOneSnapshots).toEqual([
    {
      ...profileFixtures["user-1"],
      language: "es",
    },
    {
      ...profileFixtures["user-1"],
      language: "es",
      audio: { lossless: true, downloadQuality: "high" },
    },
    {
      language: "es",
      audio: { lossless: true, downloadQuality: "high" },
      notifications: { push: false, emailNewsletters: false },
    },
  ]);
  expect(remoteProfiles).toEqual({
    "user-1": {
      language: "es",
      audio: { lossless: true, downloadQuality: "high" },
      notifications: { push: false, emailNewsletters: false },
    },
    "user-2": {
      language: "system",
      audio: { lossless: true, downloadQuality: "lossless" },
      notifications: { push: false, emailNewsletters: true },
    },
  });
  expect(client.getQueryData(["settings", "me", "user-1"])).toEqual(
    remoteProfiles["user-1"],
  );
  expect(client.getQueryData(["settings", "me", "user-2"])).toEqual(
    remoteProfiles["user-2"],
  );
  await userTwo.unmount();
});
