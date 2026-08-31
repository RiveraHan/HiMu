/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { BackHandler, Platform } from "react-native";

import CreateDJScreen, { mapCreateDjErrorCategory } from "@/app/create-dj";
import type { EdgeErrorPayload } from "@/src/api/edge-errors";
import type { ProductEventName, ProductEventProperties } from "@/src/experience";
import type { CreateDJInput } from "@/src/hooks/use-create-dj";
import i18n from "@/src/i18n";
import { handleProductEventRequest } from "@/supabase/functions/product-events/handler";

const mockDraft = jest.fn();
const mockConfirm = jest.fn<Promise<boolean>, [object]>();
const mockConsumePendingIntent = jest.fn<Promise<boolean>, ["first_track"]>();
const mockCreateDj = jest.fn();
const mockGetEdgeErrorPayload = jest.fn<Promise<EdgeErrorPayload>, [unknown]>();
const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterSetParams = jest.fn();
const mockTrackProductEvent = jest.fn();
let mockCurrentUserId = "listener";
let mockIsCreatePending = false;
let mockSearchParams: { step?: string | string[]; returnIntent?: string | string[] } = {};
let mockWindow = { width: 390, height: 844, fontScale: 1 };
type HardwareBackHandler = Parameters<typeof BackHandler.addEventListener>[1];
let mockOpenNativeModalRequestClose: (() => void) | null = null;
let mockHardwareBackHandlers: HardwareBackHandler[] = [];
let mockWizardBackHandlerInvocations = 0;

function dispatchMockAndroidHardwareBack(): boolean {
  const modalRequestClose = mockOpenNativeModalRequestClose;
  if (modalRequestClose) {
    modalRequestClose();
    return true;
  }
  for (let index = mockHardwareBackHandlers.length - 1; index >= 0; index -= 1) {
    mockWizardBackHandlerInvocations += 1;
    if (mockHardwareBackHandlers[index]?.()) return true;
  }
  return false;
}

const identityCandidates = [
  { name: "Night Cartographer", identityConcept: "Maps patient rhythms into luminous shared journeys." },
  { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
  { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
];

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 1 }),
}));
jest.mock("@/src/hooks/use-create-dj", () => ({
  useCreateDJ: () => ({ mutate: mockCreateDj, isPending: mockIsCreatePending }),
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => mockCurrentUserId ? { id: mockCurrentUserId } : null,
}));
jest.mock("@/src/api/auth-scope", () => ({
  isCurrentMutationUser: (userId: string) => userId === mockCurrentUserId,
}));
jest.mock("@/src/api/edge-errors", () => ({
  getEdgeErrorPayload: (error: unknown) => mockGetEdgeErrorPayload(error),
}));
jest.mock("@/src/experience", () => ({
  pendingIntentStore: {
    consume: (kind: "first_track") => mockConsumePendingIntent(kind),
  },
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));
jest.mock("@/src/hooks/use-creative-draft", () => ({
  useDjIdentityDrafts: () => ({ mutateAsync: mockDraft, isPending: false, error: null }),
}));
jest.mock("@/src/hooks/use-confirm", () => ({ useConfirm: () => mockConfirm }));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useMiniPlayerPadding: () => 24 }));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: require("@/src/i18n").default.resolvedLanguage }),
}));
jest.mock("@/src/components/GlassInput", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return { GlassInput: (props: object) => React.createElement(TextInput, props) };
});
jest.mock("@/src/components/preferences/ProgressiveCatalogPicker", () => {
  const React = require("react");
  const { Modal, Pressable, Text, View } = require("react-native");
  return {
    ProgressiveCatalogPicker: ({ title, groups, selected, getItemLabel, onChange }: {
      title: string;
      groups: readonly { items: readonly string[] }[];
      selected: readonly string[];
      getItemLabel(value: string): string;
      onChange(values: string[]): void;
    }) => {
      const [visible, setVisible] = React.useState(false);
      const value = groups[0].items[0];
      const label = getItemLabel(value);
      const requestClose = React.useCallback(() => setVisible(false), []);
      React.useEffect(() => {
        if (!visible) return;
        mockOpenNativeModalRequestClose = requestClose;
        return () => {
          if (mockOpenNativeModalRequestClose === requestClose) {
            mockOpenNativeModalRequestClose = null;
          }
        };
      }, [requestClose, visible]);
      return React.createElement(View, null,
        React.createElement(Pressable, {
          accessibilityRole: "button",
          accessibilityLabel: `Edit ${title}`,
          onPress: () => setVisible(true),
        }, React.createElement(Text, null, `Edit ${title}`)),
        React.createElement(Modal, {
          visible,
          testID: "catalog-picker-modal",
          onRequestClose: requestClose,
        },
        React.createElement(Pressable, {
          accessibilityRole: "checkbox",
          accessibilityLabel: label,
          accessibilityState: { checked: selected.includes(value) },
          onPress: () => onChange([value]),
        }, React.createElement(Text, null, label)),
        React.createElement(Pressable, {
          accessibilityRole: "button",
          accessibilityLabel: "Done",
          onPress: () => setVisible(false),
        }, React.createElement(Text, null, "Done"))),
      );
    },
  };
});
jest.mock("@/src/components/Button", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ label, disabled, loading, loadingLabel, onPress, testID }: {
      label: string;
      disabled?: boolean;
      loading?: boolean;
      loadingLabel?: string;
      onPress?: () => void;
      testID?: string;
    }) => {
      const isDisabled = Boolean(disabled || loading);
      const accessibleLabel = loading ? loadingLabel ?? label : label;
      return React.createElement(
      Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel: accessibleLabel,
        accessibilityState: { disabled: isDisabled, busy: Boolean(loading) },
        disabled: isDisabled,
        onPress,
        testID,
      },
      React.createElement(Text, null, accessibleLabel),
      );
    },
  };
});
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: {
      back: (...args: unknown[]) => mockRouterBack(...args),
      canGoBack: () => true,
      push: (...args: unknown[]) => mockRouterPush(...args),
      replace: (...args: unknown[]) => mockRouterReplace(...args),
      setParams: (...args: unknown[]) => mockRouterSetParams(...args),
    },
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
    useLocalSearchParams: () => mockSearchParams,
  };
});
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

const originalPlatform = Object.getOwnPropertyDescriptor(Platform, "OS");

async function expectTrackedEventsAccepted(expectedNames: ProductEventName[]) {
  const calls = mockTrackProductEvent.mock.calls as [
    ProductEventName,
    ProductEventProperties,
  ][];
  expect(calls.map(([name]) => name)).toEqual(expectedNames);
  const record = jest.fn(async () => "accepted" as const);

  for (const [index, [name, properties]] of calls.entries()) {
    const result = await handleProductEventRequest({
      eventId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      installationId: "00000000-0000-4000-8000-000000000101",
      sessionId: "00000000-0000-4000-8000-000000000102",
      name,
      occurredAt: "2026-08-25T12:00:00.000Z",
      properties,
    }, "listener", { record });
    expect(result).toEqual({ status: 202, body: { status: "accepted" } });
  }

  expect(record).toHaveBeenCalledTimes(expectedNames.length);
}

async function choose(screen: Awaited<ReturnType<typeof render>>, title: string, item: string) {
  await fireEvent.press(screen.getByRole("button", { name: `Edit ${title}` }));
  await fireEvent.press(screen.getByRole("checkbox", { name: item }));
  await fireEvent.press(screen.getByRole("button", { name: "Done" }));
}

async function reachIdentity(screen: Awaited<ReturnType<typeof render>>) {
  await choose(screen, i18n.t("dj.traits.genres"), i18n.language === "es" ? "Ambiental" : "Ambient");
  await choose(screen, i18n.t("dj.traits.moods"), i18n.language === "es" ? "Concentración" : "Focus");
  await fireEvent.press(screen.getByRole("button", { name: i18n.t("dj.create.continue") }));
  await waitFor(() => expect(screen.getByRole("radio", { name: /Night Cartographer/ })).toBeTruthy());
}

async function reachReview(screen: Awaited<ReturnType<typeof render>>) {
  await reachIdentity(screen);
  await fireEvent.press(screen.getByRole("radio", { name: /Night Cartographer/ }));
  await fireEvent.press(screen.getByRole("button", { name: i18n.t("dj.identity.continue") }));
  await waitFor(() => expect(screen.getByTestId("create-dj-review")).toBeTruthy());
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
  mockSearchParams = {};
  mockCurrentUserId = "listener";
  mockIsCreatePending = false;
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  mockOpenNativeModalRequestClose = null;
  mockHardwareBackHandlers = [];
  mockWizardBackHandlerInvocations = 0;
  mockConfirm.mockResolvedValue(false);
  mockConsumePendingIntent.mockResolvedValue(true);
  mockGetEdgeErrorPayload.mockResolvedValue({ code: null, dailyLimit: null, limit: null });
  mockDraft.mockResolvedValue({ version: 1, kind: "dj-identity", draft: { candidates: identityCandidates } });
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
});

afterAll(() => {
  if (originalPlatform) Object.defineProperty(Platform, "OS", originalPlatform);
});

test("mounts only Sound first, announces progress, and disables invalid Continue", async () => {
  const screen = await render(<CreateDJScreen />);
  expect(screen.getByText("Create your DJ")).toBeTruthy();
  expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  expect(screen.getByText("Genres")).toBeTruthy();
  expect(screen.queryByText("Choose your DJ's identity")).toBeNull();
  expect(screen.queryByTestId("create-dj-review")).toBeNull();
  expect(screen.getByRole("button", { name: "Continue" }).props.accessibilityState.disabled).toBe(true);
  expect(mockDraft).not.toHaveBeenCalled();
});

test("navigates Sound to Identity to Review and Back in deterministic step order", async () => {
  const screen = await render(<CreateDJScreen />);
  await reachReview(screen);
  expect(screen.queryByRole("button", { name: "Edit Genres" })).toBeNull();
  expect(screen.getByText("Night Cartographer")).toBeTruthy();
  expect(screen.getByText("Maps patient rhythms into luminous shared journeys.")).toBeTruthy();
  expect(screen.getByText("Balanced")).toBeTruthy();
  expect(screen.getByText("Instrumental")).toBeTruthy();
  expect(screen.getByText("Only you can see this DJ.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Bring my DJ to life" })).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("Choose your DJ's identity")).toBeTruthy();
  expect(screen.queryByTestId("create-dj-review")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("Genres")).toBeTruthy();
  expect(screen.queryByText("Choose your DJ's identity")).toBeNull();
  expect(mockRouterBack).not.toHaveBeenCalled();
});

test("uses Review edit mappings without mounting another editor", async () => {
  const screen = await render(<CreateDJScreen />);
  await reachReview(screen);
  await fireEvent.press(screen.getByRole("button", { name: "Edit sound" }));
  expect(screen.getByText("Genres")).toBeTruthy();
  expect(screen.queryByTestId("create-dj-review")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Identity" }));
  expect(screen.getByText("Choose your DJ's identity")).toBeTruthy();
});

test("lets an open native picker close before hardware Back changes wizard state", async () => {
  const addBackHandler = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    mockHardwareBackHandlers.push(handler);
    return {
      remove: () => {
        mockHardwareBackHandlers = mockHardwareBackHandlers.filter((candidate) => candidate !== handler);
      },
    };
  });
  const screen = await render(<CreateDJScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Edit Genres" }));

  expect(screen.getByRole("checkbox", { name: "Ambient" })).toBeTruthy();
  expect(addBackHandler).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));
  let pickerHandled = false;
  await act(async () => {
    pickerHandled = dispatchMockAndroidHardwareBack();
    await Promise.resolve();
  });
  addBackHandler.mockRestore();
  expect(pickerHandled).toBe(true);
  expect(screen.queryByRole("checkbox", { name: "Ambient" })).toBeNull();
  expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  expect(mockWizardBackHandlerInvocations).toBe(0);
  expect(mockRouterBack).not.toHaveBeenCalled();
  expect(mockConfirm).not.toHaveBeenCalled();
});

test("keeps dirty Sound on Stay, discards on confirmation, and exits clean Sound directly", async () => {
  const clean = await render(<CreateDJScreen />);
  await fireEvent.press(clean.getByRole("button", { name: "Back" }));
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(mockRouterBack).toHaveBeenCalledTimes(1);
  await clean.unmount();

  mockRouterBack.mockClear();
  const dirty = await render(<CreateDJScreen />);
  await choose(dirty, "Genres", "Ambient");
  await fireEvent.press(dirty.getByRole("button", { name: "Back" }));
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
    confirmLabel: "Discard",
    cancelLabel: "Stay",
    destructive: true,
  }));
  expect(mockRouterBack).not.toHaveBeenCalled();

  mockConfirm.mockResolvedValueOnce(true);
  await fireEvent.press(dirty.getByRole("button", { name: "Back" }));
  await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
});

test("replaces invalid web steps and pushes valid user-directed step history", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  mockSearchParams = { step: "review" };
  const direct = await render(<CreateDJScreen />);
  expect(direct.getByText("Step 1 of 3")).toBeTruthy();
  await waitFor(() => expect(mockRouterSetParams).toHaveBeenCalledWith({ step: "sound" }));
  await direct.unmount();

  mockRouterSetParams.mockClear();
  mockRouterPush.mockClear();
  mockSearchParams = { step: "sound" };
  const screen = await render(<CreateDJScreen />);
  await reachReview(screen);
  expect(mockRouterPush).toHaveBeenNthCalledWith(1, {
    pathname: "/create-dj",
    params: { step: "identity" },
  });
  expect(mockRouterPush).toHaveBeenNthCalledWith(2, {
    pathname: "/create-dj",
    params: { step: "review" },
  });
  expect(mockRouterSetParams).not.toHaveBeenCalled();

  mockSearchParams = { step: "identity" };
  await screen.rerender(<CreateDJScreen />);
  await waitFor(() => expect(screen.getByText("Step 2 of 3")).toBeTruthy());
  expect(mockCreateDj).not.toHaveBeenCalled();

  mockSearchParams = { step: "review" };
  await screen.rerender(<CreateDJScreen />);
  await waitFor(() => expect(screen.getByText("Step 3 of 3")).toBeTruthy());
  expect(mockCreateDj).not.toHaveBeenCalled();
});

test("localizes progress, review labels, edit actions, visibility consequence, and CTA in Spanish", async () => {
  await i18n.changeLanguage("es");
  const screen = await render(<CreateDJScreen />);
  expect(screen.getByText("Paso 1 de 3")).toBeTruthy();
  await reachReview(screen);
  expect(screen.getByText("Revisa tu DJ")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Editar sonido" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Editar identidad" })).toBeTruthy();
  expect(screen.getByText("Solo tú puedes ver este DJ.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Dar vida a mi DJ" })).toBeTruthy();
});

test("adopts first-track once and submits only the final Review action exactly once", async () => {
  mockSearchParams = { returnIntent: "first_track" };
  const screen = await render(<CreateDJScreen />);
  await waitFor(() => expect(mockConsumePendingIntent).toHaveBeenCalledTimes(1));
  expect(mockConsumePendingIntent).toHaveBeenCalledWith("first_track");

  await choose(screen, "Genres", "Ambient");
  expect(mockCreateDj).not.toHaveBeenCalled();
  await choose(screen, "Moods", "Focus");
  expect(mockCreateDj).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(screen.getByRole("radio", { name: /Night Cartographer/ })).toBeTruthy());
  expect(mockCreateDj).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("radio", { name: /Night Cartographer/ }));
  expect(mockCreateDj).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByTestId("create-dj-review")).toBeTruthy();
  expect(mockCreateDj).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(mockCreateDj).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByTestId("create-dj-review")).toBeTruthy();

  mockSearchParams = { step: "identity", returnIntent: "invalid" };
  await screen.rerender(<CreateDJScreen />);
  await waitFor(() => expect(screen.getByText("Step 2 of 3")).toBeTruthy());
  expect(mockCreateDj).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));

  mockWindow = { width: 1440, height: 900, fontScale: 1 };
  await screen.rerender(<CreateDJScreen />);
  expect(screen.getByText("Step 3 of 3")).toBeTruthy();
  expect(mockCreateDj).not.toHaveBeenCalled();
  expect(mockConsumePendingIntent).toHaveBeenCalledTimes(1);

  const expectedCreateDjInput: CreateDJInput = {
    name: "Night Cartographer",
    identityConcept: "Maps patient rhythms into luminous shared journeys.",
    genres: ["Ambient"],
    moods: ["Focus"],
    energy: 6,
    isInstrumental: true,
    vibe: undefined,
    isPublic: false,
  };
  const submit = screen.getByRole("button", { name: "Bring my DJ to life" });
  await fireEvent.press(submit);
  await fireEvent.press(submit);
  expect(mockCreateDj).toHaveBeenCalledTimes(1);
  expect(mockCreateDj).toHaveBeenCalledWith(
    expectedCreateDjInput,
    expect.objectContaining({
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
    }),
  );
  expect(mockTrackProductEvent).toHaveBeenCalledWith("dj_creation_started", {
    flowVersion: 1,
    platform: "android",
    locale: "en",
  });

  const callbacks = mockCreateDj.mock.calls[0][1] as {
    onSuccess(result: { djId: string; avatarReady: boolean }): void;
  };
  await act(async () => callbacks.onSuccess({ djId: "dj-new", avatarReady: true }));
  expect(mockRouterReplace).toHaveBeenCalledWith({
    pathname: "/create-track",
    params: { djId: "dj-new" },
  });
  await expectTrackedEventsAccepted(["dj_creation_started", "dj_created"]);
});

test.each([
  ["single array value", ["first_track"]],
  ["duplicate values", ["first_track", "first_track"]],
  ["valid then invalid values", ["first_track", "invalid"]],
  ["invalid then valid values", ["invalid", "first_track"]],
] as const)("treats repeated returnIntent route params with %s as no intent", async (_case, returnIntent) => {
  mockSearchParams = { returnIntent: [...returnIntent] };
  const screen = await render(<CreateDJScreen />);

  await act(async () => Promise.resolve());
  expect(mockConsumePendingIntent).not.toHaveBeenCalled();

  await reachReview(screen);
  await fireEvent.press(screen.getByRole("button", { name: "Bring my DJ to life" }));
  const success = mockCreateDj.mock.calls[0][1].onSuccess as (
    result: { djId: string; avatarReady: boolean },
  ) => void;
  await act(async () => success({ djId: "dj-with-malformed-intent", avatarReady: true }));

  expect(mockRouterReplace).toHaveBeenCalledWith("/dj/dj-with-malformed-intent");
  expect(mockRouterReplace).not.toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/create-track" }),
  );
});

test("ordinary success opens the DJ while a previous user's late success cannot navigate", async () => {
  const ordinary = await render(<CreateDJScreen />);
  await reachReview(ordinary);
  await fireEvent.press(ordinary.getByRole("button", { name: "Bring my DJ to life" }));
  const ordinarySuccess = mockCreateDj.mock.calls[0][1].onSuccess as (
    result: { djId: string; avatarReady: boolean },
  ) => void;
  await act(async () => ordinarySuccess({ djId: "dj-ordinary", avatarReady: false }));
  expect(mockRouterReplace).toHaveBeenCalledWith("/dj/dj-ordinary");
  await ordinary.unmount();

  jest.clearAllMocks();
  mockDraft.mockResolvedValue({ version: 1, kind: "dj-identity", draft: { candidates: identityCandidates } });
  const stale = await render(<CreateDJScreen />);
  await reachReview(stale);
  await fireEvent.press(stale.getByRole("button", { name: "Bring my DJ to life" }));
  const staleSuccess = mockCreateDj.mock.calls[0][1].onSuccess as (
    result: { djId: string; avatarReady: boolean },
  ) => void;
  mockCurrentUserId = "another-listener";
  await act(async () => staleSuccess({ djId: "dj-stale", avatarReady: true }));
  expect(mockRouterReplace).not.toHaveBeenCalled();
  expect(mockTrackProductEvent).not.toHaveBeenCalledWith(
    "dj_created",
    expect.anything(),
  );
});

test("pending submission locks Review, marks the final action busy, and leaves Back available", async () => {
  const screen = await render(<CreateDJScreen />);
  await reachReview(screen);
  await fireEvent.press(screen.getByRole("button", { name: "Bring my DJ to life" }));
  expect(screen.getByTestId("create-dj-submit").props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true, busy: true }),
  );
  expect(screen.queryByRole("button", { name: "Edit sound" })).toBeNull();
  const back = screen.getByRole("button", { name: "Back" });
  expect(back.props.accessibilityState?.disabled).not.toBe(true);
  await fireEvent.press(back);
  expect(mockRouterBack).toHaveBeenCalledTimes(1);
  expect(mockCreateDj).toHaveBeenCalledTimes(1);

  mockIsCreatePending = true;
  await screen.rerender(<CreateDJScreen />);
  const submit = screen.getByTestId("create-dj-submit");
  expect(submit.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
  expect(screen.queryByRole("button", { name: "Edit sound" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit identity" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "PRIVATE" })).toBeNull();
});

test("maps only bounded create errors and keeps localized Review state without raw provider text", async () => {
  expect([
    mapCreateDjErrorCategory({ code: "dj_quota_reached", dailyLimit: null, limit: 1 }),
    mapCreateDjErrorCategory({ code: "invalid_input", dailyLimit: null, limit: null }),
    mapCreateDjErrorCategory({ code: "provider_error", dailyLimit: null, limit: null }),
    mapCreateDjErrorCategory({ code: "provider secret", dailyLimit: null, limit: null }),
  ]).toEqual(["quota", "validation", "provider", "unknown"]);

  await i18n.changeLanguage("es");
  mockGetEdgeErrorPayload.mockResolvedValue({
    code: "provider_error",
    dailyLimit: null,
    limit: null,
  });
  const screen = await render(<CreateDJScreen />);
  await reachReview(screen);
  await fireEvent.press(screen.getByRole("button", { name: "Dar vida a mi DJ" }));
  const callbacks = mockCreateDj.mock.calls[0][1] as {
    onError(error: unknown): Promise<void>;
  };
  await act(async () => callbacks.onError(new Error("raw provider secret and stack")));

  expect(screen.getByText("Revisa tu DJ")).toBeTruthy();
  expect(screen.getByText("Night Cartographer")).toBeTruthy();
  expect(screen.getByText("El servicio de creación no está disponible. Inténtalo de nuevo.")).toBeTruthy();
  expect(screen.queryByText(/raw provider secret/i)).toBeNull();
  const renderedTree = JSON.stringify(screen.toJSON());
  const validationPosition = renderedTree.indexOf(
    `\"testID\":\"create-dj-validation\"`,
  );
  const actionPosition = renderedTree.indexOf(
    `\"testID\":\"create-dj-submit\"`,
  );
  expect(validationPosition).toBeGreaterThanOrEqual(0);
  expect(actionPosition).toBeGreaterThan(validationPosition);
  expect(mockRouterReplace).not.toHaveBeenCalled();
  expect(mockTrackProductEvent).toHaveBeenCalledWith(
    "dj_creation_failed",
    expect.objectContaining({ errorCategory: "provider" }),
  );
  await expectTrackedEventsAccepted(["dj_creation_started", "dj_creation_failed"]);
});

test("ignores a previous user's error when the account changes during Edge error parsing", async () => {
  let resolvePayload!: (payload: EdgeErrorPayload) => void;
  mockGetEdgeErrorPayload.mockReturnValue(new Promise((resolve) => {
    resolvePayload = resolve;
  }));
  const screen = await render(<CreateDJScreen />);
  await reachReview(screen);
  await fireEvent.press(screen.getByRole("button", { name: "Bring my DJ to life" }));
  const callbacks = mockCreateDj.mock.calls[0][1] as {
    onError(error: unknown): Promise<void>;
  };
  const errorPromise = callbacks.onError(new Error("old user's provider secret"));
  await act(async () => Promise.resolve());

  mockCurrentUserId = "another-listener";
  await screen.rerender(<CreateDJScreen />);
  resolvePayload({ code: "provider_error", dailyLimit: null, limit: null });
  await act(async () => errorPromise);

  expect(screen.getByText("Review your DJ")).toBeTruthy();
  expect(screen.getByText("Night Cartographer")).toBeTruthy();
  expect(screen.queryByText("The creation service is unavailable. Please try again.")).toBeNull();
  expect(screen.queryByText(/old user's provider secret/i)).toBeNull();
  expect(screen.getByTestId("create-dj-submit").props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true, busy: true }),
  );
  expect(mockTrackProductEvent).not.toHaveBeenCalledWith(
    "dj_creation_failed",
    expect.anything(),
  );
});
