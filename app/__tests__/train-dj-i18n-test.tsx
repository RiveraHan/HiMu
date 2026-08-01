/* eslint-disable @typescript-eslint/no-require-imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import TrainDJScreen from "@/app/train-dj/[id]";
import { ActivityProvider, useActivity } from "@/src/activity/ActivityProvider";
import { supabase } from "@/src/api/supabase";
import i18n from "@/src/i18n";

const mockUpdate = jest.fn();
const mockToastInfo = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();
let mockPending = false;
let mockUseRealUpdate = false;
let mockLatestActivity: ReturnType<typeof useActivity> | null = null;

jest.mock("@/src/hooks/use-dj", () => ({
  useDJ: () => ({ data: {
    id: "dj-one",
    owner_id: "listener",
    name: "Lumen",
    avatar_url: null,
    genre_specialties: ["Ambient"],
    mood_tags: ["Focus"],
    personality_traits: { energy: 5, vibe: "", isInstrumental: true },
  }, isLoading: false }),
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
  useCurrentUser: () => ({ id: "listener" }),
}));
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
  const { Pressable, Text, View } = require("react-native");
  return {
    Avatar: () => React.createElement(View),
    DjTraitsForm: () => React.createElement(View),
    EqualizerBars: () => React.createElement(View),
    Text: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
    PrefSection: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) =>
      React.createElement(View, null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        children,
      ),
    ScreenHeader: ({ title, subtitle, disabled }: { title: string; subtitle: string; disabled?: boolean }) =>
      React.createElement(View, null,
        React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Back", accessibilityState: { disabled }, disabled }),
        React.createElement(Text, null, title),
        React.createElement(Text, null, subtitle),
      ),
    Button: ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled, onPress },
        React.createElement(Text, null, label)),
    canSubmitDjTraits: () => true,
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: "dj-one" }),
}));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { RefreshCw: () => React.createElement(View) };
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
  mockPending = false;
  mockUseRealUpdate = false;
  mockLatestActivity = null;
});

test("renders Spanish training and preserves canonical saved values", async () => {
  mockPending = false;
  await i18n.changeLanguage("es");
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByText("Entrenar tu DJ")).toBeTruthy();
  expect(screen.getByText("Guardar cambios")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ genres: ["Ambient"], moods: ["Focus"] }),
    expect.any(Object),
  );
});

test("keeps Back available while an update is pending", async () => {
  mockPending = true;
  const screen = await render(<TrainDJScreen />);

  expect(screen.getByRole("button", { name: "Back" }).props.accessibilityState.disabled).toBeFalsy();
});

test("keeps real portrait regeneration globally visible after its origin unmounts and warns once", async () => {
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

  await screen.rerender(
    <IntegrationHarness queryClient={queryClient} showOrigin={false} />,
  );
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
    <IntegrationHarness queryClient={queryClient} showOrigin={false} />,
  );
  expect(mockToastWarning).toHaveBeenCalledTimes(1);
  await screen.unmount();
  queryClient.getMutationCache().getAll().forEach((mutation) => {
    queryClient.getMutationCache().remove(mutation);
  });
});
