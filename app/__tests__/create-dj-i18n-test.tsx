/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { BackHandler, Platform } from "react-native";

import CreateDJScreen from "@/app/create-dj";
import i18n from "@/src/i18n";

const mockDraft = jest.fn();
const mockConfirm = jest.fn<Promise<boolean>, [object]>();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterSetParams = jest.fn();
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
  { name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." },
  { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
  { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
];

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 1 }),
}));
jest.mock("@/src/hooks/use-create-dj", () => ({
  useCreateDJ: () => {
    throw new Error("Task 5 must not invoke useCreateDJ");
  },
}));
jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: () => ({ id: "listener" }) }));
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
    Button: ({ label, disabled, loading, onPress, testID }: {
      label: string;
      disabled?: boolean;
      loading?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => React.createElement(
      Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel: label,
        accessibilityState: { disabled: Boolean(disabled), busy: Boolean(loading) },
        disabled,
        onPress,
        testID,
      },
      React.createElement(Text, null, label),
    ),
  };
});
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: {
      back: (...args: unknown[]) => mockRouterBack(...args),
      canGoBack: () => true,
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

async function choose(screen: Awaited<ReturnType<typeof render>>, title: string, item: string) {
  await fireEvent.press(screen.getByRole("button", { name: `Edit ${title}` }));
  await fireEvent.press(screen.getByRole("checkbox", { name: item }));
  await fireEvent.press(screen.getByRole("button", { name: "Done" }));
}

async function reachIdentity(screen: Awaited<ReturnType<typeof render>>) {
  await choose(screen, i18n.t("dj.traits.genres"), i18n.language === "es" ? "Ambiental" : "Ambient");
  await choose(screen, i18n.t("dj.traits.moods"), i18n.language === "es" ? "Concentración" : "Focus");
  await fireEvent.press(screen.getByRole("button", { name: i18n.t("dj.create.continue") }));
  await waitFor(() => expect(screen.getByRole("radio", { name: /Static Bloom/ })).toBeTruthy());
}

async function reachReview(screen: Awaited<ReturnType<typeof render>>) {
  await reachIdentity(screen);
  await fireEvent.press(screen.getByRole("radio", { name: /Static Bloom/ }));
  await fireEvent.press(screen.getByRole("button", { name: i18n.t("dj.identity.continue") }));
  await waitFor(() => expect(screen.getByTestId("create-dj-review")).toBeTruthy());
}

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
  mockSearchParams = {};
  mockWindow = { width: 390, height: 844, fontScale: 1 };
  mockOpenNativeModalRequestClose = null;
  mockHardwareBackHandlers = [];
  mockWizardBackHandlerInvocations = 0;
  mockConfirm.mockResolvedValue(false);
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
  expect(screen.getByText("Static Bloom")).toBeTruthy();
  expect(screen.getByText("A patient selector tracing city lights through warm analog haze.")).toBeTruthy();
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

test("canonicalizes a direct invalid Review URL to Sound and syncs valid web step history", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  mockSearchParams = { step: "review" };
  const direct = await render(<CreateDJScreen />);
  expect(direct.getByText("Step 1 of 3")).toBeTruthy();
  await waitFor(() => expect(mockRouterSetParams).toHaveBeenCalledWith({ step: "sound" }));
  await direct.unmount();

  mockRouterSetParams.mockClear();
  mockSearchParams = { step: "sound" };
  const screen = await render(<CreateDJScreen />);
  await reachReview(screen);
  expect(mockRouterSetParams).toHaveBeenCalledWith({ step: "identity" });
  expect(mockRouterSetParams).toHaveBeenCalledWith({ step: "review" });

  mockSearchParams = { step: "identity" };
  await screen.rerender(<CreateDJScreen />);
  await waitFor(() => expect(screen.getByText("Step 2 of 3")).toBeTruthy());
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
