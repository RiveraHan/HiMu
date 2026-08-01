/* eslint-disable @typescript-eslint/no-require-imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import CreateDJScreen from "@/app/create-dj";
import { ActivityProvider, useActivity } from "@/src/activity/ActivityProvider";
import { supabase } from "@/src/api/supabase";
import i18n from "@/src/i18n";

const mockCreate = jest.fn();
const mockToastInfo = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();
let mockPending = false;
let mockUseRealCreate = false;
let mockLatestActivity: ReturnType<typeof useActivity> | null = null;

jest.mock("@/src/hooks/use-create-dj", () => {
  const actual = jest.requireActual("@/src/hooks/use-create-dj");
  return {
    ...actual,
    useCreateDJ: () =>
      mockUseRealCreate
        ? actual.useCreateDJ()
        : { mutate: mockCreate, isPending: mockPending },
  };
});
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "listener" }),
}));
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
jest.mock("@/src/components/GlassInput", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return { GlassInput: (props: object) => React.createElement(TextInput, props) };
});
jest.mock("@/src/components/preferences/PrefSection", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return { PrefSection: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) =>
    React.createElement(View, null,
      React.createElement(Text, null, title),
      subtitle ? React.createElement(Text, null, subtitle) : null,
      children,
    ) };
});
jest.mock("@/src/components/preferences/GroupedChipPicker", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return { GroupedChipPicker: ({ groups, getItemLabel, onToggle }: {
    groups: readonly { items: readonly string[] }[];
    getItemLabel: (value: string) => string;
    onToggle: (value: string) => void;
  }) => {
    const item = groups[0].items[0];
    const label = getItemLabel(item);
    return React.createElement(View, null,
      React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: label, onPress: () => onToggle(item) },
        React.createElement(Text, null, label)),
    );
  } };
});
jest.mock("@/src/components/preferences/Segmented", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Segmented: ({ options }: { options: { label: string }[] }) =>
    React.createElement(Text, null, options.map((option) => option.label).join(" / ")) };
});
jest.mock("@/src/components/preferences/VibeSlider", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { VibeSlider: ({ leftLabel, rightLabel }: { leftLabel: string; rightLabel: string }) =>
    React.createElement(Text, null, `${leftLabel} / ${rightLabel}`) };
});
jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const traits = jest.requireActual("@/src/components/dj/DjTraitsForm");
  return {
    ...traits,
    DjBirthOverlay: () => React.createElement(View, { testID: "birth-overlay" }),
    ScreenHeader: ({ title, subtitle, disabled }: { title: string; subtitle: string; disabled?: boolean }) =>
      React.createElement(View, null,
        React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Back", accessibilityState: { disabled }, disabled }),
        React.createElement(Text, null, title),
        React.createElement(Text, null, subtitle),
      ),
    Button: ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled, onPress },
        React.createElement(Text, null, label)),
  };
});
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Sparkles: () => React.createElement(View) };
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
        {showOrigin ? <CreateDJScreen /> : null}
        <ActivityProbe />
      </ActivityProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockPending = false;
  mockUseRealCreate = false;
  mockLatestActivity = null;
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("renders the Spanish DJ wizard and submits canonical catalog values", async () => {
  mockPending = false;
  await i18n.changeLanguage("es");
  const screen = await render(<CreateDJScreen />);

  expect(screen.getByText("Crear tu DJ")).toBeTruthy();
  expect(screen.getByText("Dar vida a mi DJ")).toBeTruthy();
  expect(screen.getByText("Géneros")).toBeTruthy();

  await fireEvent.changeText(screen.getByPlaceholderText("p. ej., Lumen"), "Lumen");
  await fireEvent.press(screen.getByRole("button", { name: "Ambiental" }));
  await fireEvent.press(screen.getByRole("button", { name: "Concentración" }));
  await fireEvent.press(screen.getByRole("button", { name: "Dar vida a mi DJ" }));

  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ genres: ["Ambient"], moods: ["Focus"] }),
      expect.any(Object),
    ),
  );
});

test("keeps Back available and removes the blocking overlay while creation is pending", async () => {
  mockPending = true;
  const screen = await render(<CreateDJScreen />);

  expect(screen.getByRole("button", { name: "Back" }).props.accessibilityState.disabled).toBeFalsy();
  expect(screen.queryByTestId("birth-overlay")).toBeNull();
});

test.each([
  ["mounted", true],
  ["unmounted", false],
] as const)("announces real creation success once with its origin %s", async (_label, keepOriginMounted) => {
  mockUseRealCreate = true;
  await i18n.changeLanguage("en");
  let finishCreate!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () => new Promise((resolve) => (finishCreate = resolve)) as never,
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

  await fireEvent.changeText(
    screen.getByPlaceholderText("e.g. Lumen"),
    "Lumen",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
  await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
  await fireEvent.press(screen.getByRole("button", { name: "Bring my DJ to life" }));

  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({ kind: "create-dj", status: "running" }),
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
    finishCreate({
      data: { djId: "dj-lumen", avatarReady: true },
      error: null,
    });
  });

  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({
        kind: "create-dj",
        status: "ready",
        djId: "dj-lumen",
      }),
    ]),
  );
  expect(mockToastInfo).toHaveBeenCalledWith("Lumen is ready");
  expect(mockToastInfo).toHaveBeenCalledTimes(1);

  await screen.rerender(
    <IntegrationHarness
      queryClient={queryClient}
      showOrigin={keepOriginMounted}
    />,
  );
  expect(mockToastInfo).toHaveBeenCalledTimes(1);
  await screen.unmount();
  queryClient.getMutationCache().getAll().forEach((mutation) => {
    queryClient.getMutationCache().remove(mutation);
  });
});

test.each([
  ["mounted", true],
  ["unmounted", false],
] as const)("announces real creation failure once with its origin %s", async (_label, keepOriginMounted) => {
  mockUseRealCreate = true;
  await i18n.changeLanguage("en");
  let finishCreate!: (value: unknown) => void;
  jest.mocked(supabase.functions.invoke).mockImplementation(
    () => new Promise((resolve) => (finishCreate = resolve)) as never,
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

  await fireEvent.changeText(
    screen.getByPlaceholderText("e.g. Lumen"),
    "Lumen",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
  await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
  await fireEvent.press(screen.getByRole("button", { name: "Bring my DJ to life" }));
  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({ kind: "create-dj", status: "running" }),
    ]),
  );

  if (!keepOriginMounted) {
    await screen.rerender(
      <IntegrationHarness queryClient={queryClient} showOrigin={false} />,
    );
  }
  await act(async () => {
    finishCreate({
      data: null,
      error: new Error("raw secret provider failure"),
    });
  });

  await waitFor(() =>
    expect(mockLatestActivity?.items).toEqual([
      expect.objectContaining({ kind: "create-dj", status: "failed" }),
    ]),
  );
  expect(mockToastError).toHaveBeenCalledWith(
    "Couldn't create Lumen",
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
