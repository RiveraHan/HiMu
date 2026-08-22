/* eslint-disable @typescript-eslint/no-require-imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import TrainDJScreen from "@/app/train-dj/[id]";
import { ActivityProvider, useActivity } from "@/src/activity/ActivityProvider";
import { supabase } from "@/src/api/supabase";
import { TrainDjSkeleton } from "@/src/components/dj/TrainDjSkeleton";
import { resolveResponsiveFormStyle } from "@/src/components/forms/form-layout";
import i18n from "@/src/i18n";

const mockUpdate = jest.fn();
const mockToastInfo = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();
const mockDjRefetch = jest.fn();
let mockPending = false;
let mockUseRealUpdate = false;
let mockLatestActivity: ReturnType<typeof useActivity> | null = null;
let mockOnline = true;
let mockUser: { id: string } | null = { id: "listener" };
let mockRouteId = "dj-one";

const ownedDj = {
  id: "dj-one",
  owner_id: "listener",
  name: "Lumen",
  identity_concept: "A quiet navigator shaping spacious rooms for uninterrupted thought.",
  avatar_url: null,
  genre_specialties: ["Ambient"],
  mood_tags: ["Focus"],
  personality_traits: { energy: 5, vibe: "", isInstrumental: true },
};

type MockDjQuery = {
  data:
    | (Omit<typeof ownedDj, "owner_id"> & { owner_id: string | null })
    | null
    | undefined;
  isLoading: boolean;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: jest.Mock;
};

const settledDjQuery = (
  data: MockDjQuery["data"],
  overrides: Partial<MockDjQuery> = {},
): MockDjQuery => ({
  data,
  isLoading: false,
  isPending: false,
  isError: false,
  isSuccess: true,
  fetchStatus: "idle",
  refetch: mockDjRefetch,
  ...overrides,
});

let mockDjQuery = settledDjQuery(ownedDj);

jest.mock("@/src/hooks/use-dj", () => ({
  useDJ: () => mockDjQuery,
}));
jest.mock("@/src/hooks/use-update-dj", () => {
  const actual = jest.requireActual("@/src/hooks/use-update-dj");
  return {
    ...actual,
    useUpdateDJ: () =>
      mockUseRealUpdate
        ? actual.useUpdateDJ()
        : { mutate: mockUpdate, isPending: mockPending },
  };
});
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => mockUser,
}));
jest.mock("@/src/hooks/use-online-status", () => ({ useOnlineStatus: () => mockOnline }));
jest.mock("@/src/api/auth-scope", () => {
  const actual = jest.requireActual("@/src/api/auth-scope");
  return {
    ...actual,
    captureAuthScope: (userId: string) => ({
      userId,
      authorization: `Bearer fixture-${userId}`,
    }),
    isCurrentMutationUser: () => true,
  };
});
jest.mock("@/src/activity/use-generation-activity", () => ({
  useGenerationActivity: () => ({
    data: [],
    error: null,
    isLoading: false,
    isPending: false,
    fetchStatus: "idle",
    refetch: jest.fn(),
  }),
}));
jest.mock("@/src/api/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ load: jest.fn() }),
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) =>
    selector({ currentTrack: null }),
}));
jest.mock("@/src/hooks/use-phase-rotation", () => ({ usePhaseRotation: (phases: string[]) => phases[0] }));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useMiniPlayerPadding: () => 0 }));
jest.mock("@/src/hooks/use-toast", () => ({
  useToast: () => ({
    info: mockToastInfo,
    warning: mockToastWarning,
    error: mockToastError,
  }),
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: require("@/src/i18n").default.resolvedLanguage }),
}));
jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text, TextInput, View } = require("react-native");
  const { TrainDjSkeleton } = jest.requireActual("@/src/components/dj/TrainDjSkeleton");
  const { ResponsiveFormShell } = jest.requireActual("@/src/components/forms/ResponsiveFormShell");
  return {
    Avatar: () => React.createElement(View),
    DjTraitsForm: ({ values, onChange, disabled }: {
      values: { name: string; genres: string[]; moods: string[]; energy: number; mode: string; vibe: string };
      onChange: (patch: { name?: string }) => void;
      disabled?: boolean;
    }) => React.createElement(View, { testID: "dj-traits-form" },
      React.createElement(TextInput, {
        accessibilityLabel: "DJ name",
        value: values.name,
        editable: !disabled,
        onChangeText: (name: string) => onChange({ name }),
      }),
      React.createElement(Text, null, values.genres.join(", ")),
      React.createElement(Text, null, values.moods.join(", ")),
      React.createElement(Text, null, String(values.energy)),
      React.createElement(Text, null, values.mode),
      React.createElement(Text, null, values.vibe),
    ),
    EqualizerBars: () => React.createElement(View),
    ResponsiveFormShell,
    TrainDjSkeleton,
    Text: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
    PrefSection: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) =>
      React.createElement(View, null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        children,
      ),
    ScreenHeader: ({ title, subtitle, disabled, fallbackHref }: { title: string; subtitle?: string; disabled?: boolean; fallbackHref?: string }) =>
      React.createElement(View, null,
        React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Back", accessibilityState: { disabled }, disabled, testID: "train-back", fallbackHref }),
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
      ),
    ScreenScrollView: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: "screen-scroll-view", ...props }, children),
    StateNotice: ({ title, message, actionLabel, onAction, compact }: {
      title: string;
      message?: string;
      actionLabel?: string;
      onAction?: () => void;
      compact?: boolean;
    }) => React.createElement(View, { testID: compact ? "compact-notice" : "state-notice" },
      React.createElement(Text, null, title),
      message ? React.createElement(Text, null, message) : null,
      actionLabel && onAction
        ? React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: actionLabel, onPress: onAction }, React.createElement(Text, null, actionLabel))
        : null,
    ),
    Button: ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled, onPress },
        React.createElement(Text, null, label)),
    canSubmitDjTraits: () => true,
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => ({ id: mockRouteId }),
}));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ChevronLeft: () => React.createElement(View),
    RefreshCw: () => React.createElement(View),
    X: () => React.createElement(View),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

function ActivityProbe() {
  mockLatestActivity = useActivity();
  return null;
}

function IntegrationHarness({
  queryClient,
  showOrigin,
}: {
  queryClient: QueryClient;
  showOrigin: boolean;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ActivityProvider>
        {showOrigin ? <TrainDJScreen /> : null}
        <ActivityProbe />
      </ActivityProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockPending = false;
  mockUseRealUpdate = false;
  mockLatestActivity = null;
  mockOnline = true;
  mockUser = { id: "listener" };
  mockRouteId = "dj-one";
  mockDjQuery = settledDjQuery(ownedDj);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("keeps the Back header and form-shaped skeleton in the normal shell while loading", async () => {
  mockDjQuery = settledDjQuery(undefined, {
    isLoading: true,
    isPending: true,
    isSuccess: false,
    fetchStatus: "fetching",
  });
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByTestId("screen-scroll-view")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  expect(screen.getByText("Train your DJ")).toBeTruthy();
  expect(screen.getByTestId("train-dj-skeleton")).toBeTruthy();
  expect(screen.getByTestId("portrait-skeleton", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getAllByTestId("trait-row-skeleton")).toHaveLength(3);
  expect(screen.getByTestId("submit-skeleton", { includeHiddenElements: true })).toBeTruthy();
});

test("renders the real Train skeleton with copy, portrait, trait, and submit structure", async () => {
  const screen = await render(<TrainDjSkeleton />);

  expect(screen.getAllByTestId("header-copy-skeleton", { includeHiddenElements: true })).toHaveLength(2);
  expect(screen.getByTestId("portrait-skeleton", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getAllByTestId("trait-row-skeleton")).toHaveLength(3);
  expect(screen.getByTestId("submit-skeleton", { includeHiddenElements: true })).toBeTruthy();
});

test.each([
  [false, "paused", "You're offline"],
  [true, "idle", "DJ unavailable"],
] as const)("shows a retryable blocking state online=%s", async (online, fetchStatus, title) => {
  mockOnline = online;
  mockDjQuery = settledDjQuery(undefined, {
    isError: online,
    isSuccess: false,
    fetchStatus,
  });
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  expect(screen.getByText(title)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockDjRefetch).toHaveBeenCalledTimes(1);
});

test("reserves not-found copy for a successful null result", async () => {
  mockDjQuery = settledDjQuery(null);
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByText("DJ not found")).toBeTruthy();
  expect(screen.queryByText("This DJ can't be edited.")).toBeNull();
});

test.each([
  [null, { id: "listener" }],
  ["another-listener", { id: "listener" }],
  ["listener", null],
] as const)("shows authorization copy for owner=%s user=%o", async (ownerId, user) => {
  mockUser = user;
  mockDjQuery = settledDjQuery({ ...ownedDj, owner_id: ownerId });
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByText("This DJ can't be edited.")).toBeTruthy();
  expect(screen.queryByText("DJ not found")).toBeNull();
});

test.each([
  [true, "idle", "DJ unavailable"],
  [false, "paused", "You're offline"],
] as const)("keeps cached editable DJ visible on refresh failure online=%s", async (online, fetchStatus, title) => {
  mockOnline = online;
  mockDjQuery = settledDjQuery(ownedDj, { isError: online, fetchStatus });
  const screen = await render(<TrainDJScreen />);

  expect(screen.getAllByText("Save changes").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.getByTestId("compact-notice")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockDjRefetch).toHaveBeenCalledTimes(1);
});

test("renders Spanish training and preserves canonical saved values", async () => {
  mockPending = false;
  await i18n.changeLanguage("es");
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByText("Entrenar tu DJ")).toBeTruthy();
  expect(screen.getAllByText("Guardar cambios").length).toBeGreaterThanOrEqual(1);

  fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ genres: ["Ambient"], moods: ["Focus"] }),
    expect.any(Object),
  );
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("identityConcept");
});

test("keeps Back available while an update is pending", async () => {
  mockPending = true;
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByRole("button", { name: "Back" }).props.accessibilityState.disabled).toBeFalsy();
});

test.each([390, 1440])(
  "composes the saved Train DJ values at %ipx through one rail/editor/review tree without implicit save",
  async (width) => {
    await i18n.changeLanguage("en");
    const screen = await render(<TrainDJScreen />);

    const contentStyle = StyleSheet.flatten(
      screen.getByTestId("responsive-form-content").props.style,
    );
    const railStyle = StyleSheet.flatten(
      screen.getByTestId("form-step-rail").props.style,
    );
    const reviewStyle = StyleSheet.flatten(
      screen.getByTestId("sticky-review-panel").props.style,
    );

    expect(resolveResponsiveFormStyle(contentStyle.flexDirection, width)).toBe(
      width < 1024 ? "column" : "row",
    );
    expect(resolveResponsiveFormStyle(railStyle.display, width)).toBe(
      width < 1024 ? "none" : "flex",
    );
    expect(resolveResponsiveFormStyle(reviewStyle.position, width)).toBe(
      width < 1024 ? "relative" : "sticky",
    );
    expect(screen.getByTestId("train-dj-review")).toHaveTextContent(/Lumen/);
    expect(screen.getByTestId("train-dj-review")).toHaveTextContent(/Ambient/);
    expect(screen.getByTestId("train-dj-review")).toHaveTextContent(/Focus/);
    expect(screen.getAllByRole("button", { name: "Save changes" })).toHaveLength(1);

    fireEvent(screen.getByDisplayValue("Lumen"), "blur");
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockUpdate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lumen",
        genres: ["Ambient"],
        moods: ["Focus"],
        energy: 5,
        isInstrumental: true,
        regenerateAvatar: false,
      }),
      expect.any(Object),
    );
  },
);

test("resets the local editor to the newly loaded DJ when the route id changes", async () => {
  await i18n.changeLanguage("en");
  const screen = await render(<TrainDJScreen />);
  await fireEvent.changeText(screen.getByDisplayValue("Lumen"), "Unsaved Lumen");
  expect(screen.getByDisplayValue("Unsaved Lumen")).toBeTruthy();

  mockRouteId = "dj-two";
  mockDjQuery = settledDjQuery({
    ...ownedDj,
    id: "dj-two",
    name: "Solace",
    identity_concept: "A careful curator balancing quiet pulse with open-air warmth.",
    genre_specialties: ["Jazz"],
    mood_tags: ["Dreamy"],
  });
  await screen.rerender(<TrainDJScreen />);

  expect(screen.getByDisplayValue("Solace")).toBeTruthy();
  expect(screen.queryByDisplayValue("Unsaved Lumen")).toBeNull();
  expect(mockUpdate).not.toHaveBeenCalled();
});

test.each([
  ["mounted", true],
  ["unmounted", false],
] as const)("warns once for real portrait partial success with its origin %s", async (_label, keepOriginMounted) => {
  mockUseRealUpdate = true;
  await i18n.changeLanguage("en");
  let finishUpdate!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () => new Promise((resolve) => (finishUpdate = resolve)) as never,
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const screen = await render(
    <IntegrationHarness queryClient={queryClient} showOrigin />,
  );

  await fireEvent.press(
    screen.getByRole("button", { name: "Regenerate portrait" }),
  );
  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({ kind: "update-dj", status: "running" }),
    ]),
  );
  expect(
    screen.getByRole("button", { name: "Back" }).props.accessibilityState
      .disabled,
  ).toBeFalsy();

  if (!keepOriginMounted) {
    await screen.rerender(
      <IntegrationHarness queryClient={queryClient} showOrigin={false} />,
    );
  }
  await act(async () => {
    finishUpdate({
      data: { djId: "dj-one", avatarUrl: null },
      error: null,
    });
  });

  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({
        kind: "update-dj",
        status: "ready",
        detail: "portraitUnavailable",
      }),
    ]),
  );
  expect(mockToastWarning).toHaveBeenCalledWith(
    "Lumen was updated",
    "The DJ is ready, but its new portrait is unavailable.",
  );
  expect(mockToastWarning).toHaveBeenCalledTimes(1);

  await screen.rerender(
    <IntegrationHarness
      queryClient={queryClient}
      showOrigin={keepOriginMounted}
    />,
  );
  expect(mockToastWarning).toHaveBeenCalledTimes(1);
  await screen.unmount();
  queryClient.getMutationCache().getAll().forEach((mutation) => {
    queryClient.getMutationCache().remove(mutation);
  });
});

test.each([
  ["mounted", true],
  ["unmounted", false],
] as const)("announces real update failure once with its origin %s", async (_label, keepOriginMounted) => {
  mockUseRealUpdate = true;
  await i18n.changeLanguage("en");
  let finishUpdate!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () => new Promise((resolve) => (finishUpdate = resolve)) as never,
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const screen = await render(
    <IntegrationHarness queryClient={queryClient} showOrigin />,
  );

  await fireEvent.press(
    screen.getByRole("button", { name: "Regenerate portrait" }),
  );
  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({ kind: "update-dj", status: "running" }),
    ]),
  );

  if (!keepOriginMounted) {
    await screen.rerender(
      <IntegrationHarness queryClient={queryClient} showOrigin={false} />,
    );
  }
  await act(async () => {
    finishUpdate({
      data: null,
      error: new Error("raw secret provider failure"),
    });
  });

  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({ kind: "update-dj", status: "failed" }),
    ]),
  );
  expect(mockToastError).toHaveBeenCalledWith(
    "Couldn't update Lumen",
    "The operation couldn't be completed.",
  );
  expect(mockToastError).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(mockToastError.mock.calls)).not.toContain("raw secret");

  await screen.rerender(
    <IntegrationHarness
      queryClient={queryClient}
      showOrigin={keepOriginMounted}
    />,
  );
  expect(mockToastError).toHaveBeenCalledTimes(1);
  await screen.unmount();
  queryClient.getMutationCache().getAll().forEach((mutation) => {
    queryClient.getMutationCache().remove(mutation);
  });
});
