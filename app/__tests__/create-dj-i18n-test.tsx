/* eslint-disable @typescript-eslint/no-require-imports */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import CreateDJScreen from "@/app/create-dj";
import { ActivityProvider, useActivity } from "@/src/activity/ActivityProvider";
import { supabase } from "@/src/api/supabase";
import { resolveResponsiveFormStyle } from "@/src/components/forms/form-layout";
import i18n from "@/src/i18n";

const mockCreate = jest.fn();
const mockDraft = jest.fn();
const mockToastInfo = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();
let mockPending = false;
let mockUseRealCreate = false;
let mockLatestActivity: ReturnType<typeof useActivity> | null = null;

const identityCandidates = [
  { name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." },
  { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
  { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
];
const customIdentityConcept =
  "A confirmed original identity shaped by the selected musical traits.";

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
jest.mock("@/src/hooks/use-creative-draft", () => ({
  useDjIdentityDrafts: () => ({ mutateAsync: mockDraft, isPending: false, error: null }),
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
  const { Pressable, Text, View } = require("react-native");
  return { Segmented: ({ options, value, onChange, disabled }: {
    options: { label: string; value: string }[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => React.createElement(View, null, options.map((option) =>
    React.createElement(Pressable, {
      key: option.value,
      accessibilityRole: "button",
      accessibilityLabel: option.label,
      accessibilityState: { selected: option.value === value, disabled },
      disabled,
      onPress: () => onChange(option.value),
    }, React.createElement(Text, null, option.label)))) };
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
  const { ResponsiveFormShell } = jest.requireActual("@/src/components/forms/ResponsiveFormShell");
  return {
    ...traits,
    ResponsiveFormShell,
    DjIdentityDraftStep: ({ value, onChange, disabled }: {
      value: { name: string; identityConcept: string; provenance: "custom" | "edited" | "suggested"; confirmed: boolean };
      onChange: (value: { name: string; identityConcept: string; provenance: "custom" | "edited" | "suggested"; confirmed: boolean }) => void;
      disabled?: boolean;
    }) => {
      const t = require("@/src/i18n").default.t.bind(require("@/src/i18n").default);
      return React.createElement(View, null,
        React.createElement(require("react-native").TextInput, {
          placeholder: t("dj.identity.namePlaceholder"),
          value: value.name,
          editable: !disabled,
          onChangeText: (name: string) => onChange({
            name,
            identityConcept: value.identityConcept || "A confirmed original identity shaped by the selected musical traits.",
            provenance: "edited",
            confirmed: false,
          }),
        }),
        React.createElement(Pressable, {
          accessibilityRole: "button",
          accessibilityLabel: t("dj.identity.confirm"),
          disabled: disabled || value.name.length < 2,
          onPress: () => onChange({ ...value, confirmed: true }),
        }, React.createElement(Text, null, t("dj.identity.confirm"))),
      );
    },
    DjBirthOverlay: () => React.createElement(View, { testID: "birth-overlay" }),
    ScreenHeader: ({ title, subtitle, disabled }: { title: string; subtitle: string; disabled?: boolean }) =>
      React.createElement(View, null,
        React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: "Back", accessibilityState: { disabled }, disabled }),
        React.createElement(Text, null, title),
        React.createElement(Text, null, subtitle),
      ),
    Button: ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled }, disabled, onPress },
        React.createElement(Text, null, label)),
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    ChevronLeft: () => React.createElement(View),
    Sparkles: () => React.createElement(View),
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
        {showOrigin ? <CreateDJScreen /> : null}
        <ActivityProbe />
      </ActivityProvider>
    </QueryClientProvider>
  );
}

async function confirmCustomIdentity(
  screen: Awaited<ReturnType<typeof render>>,
  name = "Lumen",
) {
  await fireEvent.changeText(
    screen.getByPlaceholderText(i18n.t("dj.identity.namePlaceholder")),
    name,
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText(i18n.t("dj.identity.conceptPlaceholder")),
    customIdentityConcept,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: i18n.t("dj.identity.confirm") }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockPending = false;
  mockUseRealCreate = false;
  mockLatestActivity = null;
  mockDraft.mockResolvedValue({
    version: 1,
    kind: "dj-identity",
    draft: { candidates: identityCandidates },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("renders Spanish visibility copy and submits private canonical DJ input by default", async () => {
  mockPending = false;
  await i18n.changeLanguage("es");
  const screen = await render(<CreateDJScreen />);

  expect(screen.getByText("Crear tu DJ")).toBeTruthy();
  expect(screen.getByText("Dar vida a mi DJ")).toBeTruthy();
  expect(screen.getAllByText("Géneros").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("Visibilidad").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("Solo tú puedes ver este DJ.").length).toBeGreaterThanOrEqual(1);

  await fireEvent.press(screen.getByRole("button", { name: "Ambiental" }));
  await fireEvent.press(screen.getByRole("button", { name: "Concentración" }));
  await confirmCustomIdentity(screen);
  await fireEvent.press(screen.getByRole("button", { name: "Dar vida a mi DJ" }));

  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        genres: ["Ambient"],
        moods: ["Focus"],
        identityConcept: customIdentityConcept,
        isPublic: false,
      }),
      expect.any(Object),
    ),
  );
});

test("submits public visibility after selection in English", async () => {
  await i18n.changeLanguage("en");
  const screen = await render(<CreateDJScreen />);

  expect(screen.getAllByText("Visibility").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("Only you can see this DJ.").length).toBeGreaterThanOrEqual(1);
  await fireEvent.press(screen.getByRole("button", { name: "PUBLIC" }));

  expect(screen.getAllByText("Anyone can discover this DJ.").length).toBeGreaterThanOrEqual(1);
  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
  await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
  await confirmCustomIdentity(screen);
  await fireEvent.press(screen.getByRole("button", { name: "Bring my DJ to life" }));

  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: true }),
      expect.any(Object),
    ),
  );
});

test("does not create a DJ until the user explicitly confirms the identity", async () => {
  await i18n.changeLanguage("en");
  const screen = await render(<CreateDJScreen />);

  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
  await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
  await fireEvent.changeText(screen.getByPlaceholderText("DJ name"), "Lumen");
  await fireEvent.changeText(
    screen.getByPlaceholderText("Describe your DJ's identity"),
    customIdentityConcept,
  );

  expect(screen.getByRole("button", { name: "Bring my DJ to life" }).props.accessibilityState.disabled).toBe(true);
  expect(mockCreate).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "Confirm this identity" }));
  expect(screen.getByRole("button", { name: "Bring my DJ to life" }).props.accessibilityState.disabled).toBe(false);
});

test.each([390, 1440])(
  "composes the real DJ workflow at %ipx with one stable rail/editor/review tree and one final action",
  async (width) => {
    await i18n.changeLanguage("en");
    const screen = await render(<CreateDJScreen />);

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
    expect(screen.getAllByRole("button", { name: "Bring my DJ to life" })).toHaveLength(1);

    await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
    await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(3));
    await fireEvent.press(screen.getByRole("radio", { name: /Static Bloom/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirm this identity" }));
    await fireEvent.press(screen.getByRole("button", { name: "PUBLIC" }));

    expect(screen.getByTestId("responsive-form-editor")).toBeTruthy();
    expect(screen.getByTestId("create-dj-review")).toBeTruthy();
    expect(screen.getAllByText("Static Bloom").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("create-dj-visibility-summary")).toHaveTextContent(
      /Anyone can discover this DJ\./,
    );

    fireEvent(screen.getByDisplayValue("Static Bloom"), "blur");
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockCreate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Bring my DJ to life" }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Static Bloom",
        genres: ["Ambient"],
        moods: ["Focus"],
        isPublic: true,
      }),
      expect.any(Object),
    );
  },
);

test("keeps stale candidate text and custom identity edits in the composed workflow without implicit creation", async () => {
  await i18n.changeLanguage("en");
  const screen = await render(<CreateDJScreen />);

  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
  await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
  await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(3));
  await fireEvent.press(screen.getByRole("radio", { name: /Velvet Index/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Confirm this identity" }));
  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));

  expect(screen.getByText("Review after trait changes")).toBeTruthy();
  expect(screen.getByDisplayValue("Velvet Index")).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "Write my own" }));
  await fireEvent.changeText(screen.getByPlaceholderText("DJ name"), "Night Cartographer");
  await fireEvent.changeText(
    screen.getByPlaceholderText("Describe your DJ's identity"),
    "A custom navigator mapping patient rhythms into luminous shared journeys.",
  );

  expect(screen.getByDisplayValue("Night Cartographer")).toBeTruthy();
  expect(screen.getByTestId("create-dj-review")).toHaveTextContent(/Night Cartographer/);
  expect(mockCreate).not.toHaveBeenCalled();
});

test("keeps Back available and removes the blocking overlay while creation is pending", async () => {
  mockPending = true;
  const screen = await render(<CreateDJScreen />);

  expect(screen.getByRole("button", { name: "Back" }).props.accessibilityState.disabled).toBeFalsy();
  expect(screen.queryByTestId("birth-overlay")).toBeNull();
  expect(screen.getByRole("button", { name: "PRIVATE" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "PUBLIC" }).props.accessibilityState.disabled).toBe(true);
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

  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
  await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
  await confirmCustomIdentity(screen);
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

  await fireEvent.press(screen.getByRole("button", { name: "Ambient" }));
  await fireEvent.press(screen.getByRole("button", { name: "Focus" }));
  await confirmCustomIdentity(screen);
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
