/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { Alert, StyleSheet as RNStyleSheet } from "react-native";
import AccountSettingsScreen from "@/app/account-settings";

type MockProfileQuery = {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: jest.Mock;
};

const initialProfileQuery = (): MockProfileQuery => ({
  data: undefined,
  isPending: true,
  isError: false,
  fetchStatus: "fetching",
  refetch: jest.fn(),
});

const settledProfileQuery = (data: unknown): MockProfileQuery => ({
  data,
  isPending: false,
  isError: false,
  fetchStatus: "idle",
  refetch: jest.fn(),
});

const failedProfileQuery = (data: unknown = undefined): MockProfileQuery => ({
  data,
  isPending: false,
  isError: true,
  fetchStatus: "idle",
  refetch: jest.fn(),
});

const freeProfile = { subscriptionTier: "free" };
const premiumProfile = { subscriptionTier: "premium" };
const mockSetPreference = jest.fn();
let mockIsSaving = false;
let mockOnline = true;
let mockProfileQuery = initialProfileQuery();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "common.actions.cancel": "Cancel",
        "common.actions.retry": "Retry",
        "common.errors.offline": "You're offline",
        "profile.profileUnavailable": "Profile unavailable",
        "settings.currentDevice": "Current device",
        "settings.email": "Email",
        "settings.free": "Free",
        "settings.header.subtitle": "Manage your account",
        "settings.header.title": "Account settings",
        "settings.language.en": "English",
        "settings.language.es": "Español",
        "settings.language.label": "Language",
        "settings.language.system": "Use device language",
        "settings.language.systemResolved": "Device language ({{language}})",
        "settings.premium": "Premium",
        "settings.sections.account": "Account",
        "settings.sections.audio": "Audio Quality",
        "settings.sections.devices": "Devices",
        "settings.sections.language": "Language",
        "settings.sections.notifications": "Notifications",
        "settings.signOut": "Sign out",
        "settings.subscription": "Subscription",
        "settings.thisDevice": "This device",
      };
      const translation = translations[key] ?? key;

      return values
        ? Object.entries(values).reduce(
            (result, [name, value]) => result.replace(`{{${name}}}`, value),
            translation,
          )
        : translation;
    },
  }),
}));

jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text: NativeText, View } = require("react-native");

  return {
    ScreenHeader: ({ title, subtitle }: { title: string; subtitle: string }) =>
      React.createElement(View, null, [
        React.createElement(NativeText, { key: "title" }, title),
        React.createElement(NativeText, { key: "subtitle" }, subtitle),
      ]),
    ScreenScrollView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SettingsInfoRow: ({
      label,
      value,
      onPress,
      disabled = false,
    }: {
      label: string;
      value?: string;
      onPress?: () => void;
      disabled?: boolean;
    }) => {
      const content = React.createElement(
        React.Fragment,
        null,
        React.createElement(NativeText, null, label),
        value ? React.createElement(NativeText, null, value) : null,
      );

      return onPress
        ? React.createElement(
            Pressable,
            {
              accessibilityLabel: label,
              accessibilityRole: "button",
              accessibilityState: { disabled },
              accessibilityValue: value ? { text: value } : undefined,
              disabled,
              onPress,
            },
            content,
          )
        : React.createElement(View, null, content);
    },
    SettingsSection: ({
      children,
      title,
    }: {
      children: React.ReactNode;
      title: string;
    }) =>
      React.createElement(View, null, [
        React.createElement(NativeText, { key: "title" }, title),
        children,
      ]),
    SettingsToggleRow: ({ label }: { label: string }) =>
      React.createElement(NativeText, null, label),
    StateNotice: ({
      actionLabel,
      kind,
      onAction,
      title,
    }: {
      actionLabel?: string;
      kind: string;
      onAction?: () => void;
      title: string;
    }) =>
      React.createElement(
        View,
        { testID: `notice-${kind}` },
        React.createElement(NativeText, null, title),
        actionLabel && onAction
          ? React.createElement(
              Pressable,
              {
                accessibilityLabel: actionLabel,
                accessibilityRole: "button",
                onPress: onAction,
              },
              React.createElement(NativeText, null, actionLabel),
            )
          : null,
      ),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(NativeText, null, children),
  };
});

jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({
    preference: "system",
    resolvedLanguage: "en",
    setPreference: mockSetPreference,
    isSaving: mockIsSaving,
  }),
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ email: "listener@himu.app" }),
}));
jest.mock("@/src/hooks/use-profile", () => ({
  useProfile: () => mockProfileQuery,
}));
jest.mock("@/src/hooks/use-settings", () => ({
  useSettings: () => ({ data: undefined }),
  useUpdateSettings: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/src/hooks/use-online-status", () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ flushListeningStats: jest.fn() }),
}));
jest.mock("@/src/hooks/use-confirm", () => ({ useConfirm: () => jest.fn() }));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("@/src/api/auth", () => ({ authApi: { signOut: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("expo-device", () => ({
  deviceName: "Test phone",
  osName: null,
  osVersion: null,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("react-native-unistyles", () => {
  const theme = {
    borderRadius: { full: 999 },
    colors: {
      background: "#000",
      error: "#f00",
      onSurfaceVariant: "#111",
      outline: "#222",
      primaryContainer: "#444",
    },
    spacing: { stackMd: 8, stackLg: 16, stackSm: 4, pageMargin: 20 },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (styles: unknown) =>
        typeof styles === "function"
          ? styles(theme)
          : styles,
      hairlineWidth: 1,
    },
  };
});

describe("AccountSettingsScreen", () => {
  beforeEach(() => {
    mockSetPreference.mockReset();
    mockIsSaving = false;
    mockOnline = true;
    mockProfileQuery = initialProfileQuery();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps only account, language, device, and sign-out settings", async () => {
    const screen = await render(<AccountSettingsScreen />);

    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getAllByText("Language")).toHaveLength(2);
    expect(screen.getByText("Devices")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.queryByText("Audio Quality")).toBeNull();
    expect(screen.queryByText("Notifications")).toBeNull();
  });

  it("renders an informational placeholder without inventing a Free tier", async () => {
    const screen = await render(<AccountSettingsScreen />);

    expect(screen.getByText("Subscription")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("Free")).toBeNull();
    expect(screen.queryByRole("button", { name: "Subscription" })).toBeNull();
  });

  it("replaces a first profile failure with a retry notice", async () => {
    mockProfileQuery = failedProfileQuery();
    const screen = await render(<AccountSettingsScreen />);

    expect(screen.getByText("Profile unavailable")).toBeTruthy();
    expect(screen.queryByText("Free")).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockProfileQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows offline retry before the first-load placeholder", async () => {
    mockOnline = false;
    mockProfileQuery = { ...initialProfileQuery(), fetchStatus: "paused" };
    const screen = await render(<AccountSettingsScreen />);

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.getByTestId("notice-offline")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("Free")).toBeNull();
  });

  it("keeps a cached premium tier with a compact retry notice", async () => {
    mockProfileQuery = failedProfileQuery(premiumProfile);
    const screen = await render(<AccountSettingsScreen />);

    expect(screen.getByText("Subscription")).toBeTruthy();
    expect(screen.getByText("Premium")).toBeTruthy();
    expect(screen.getByText("Profile unavailable")).toBeTruthy();
    expect(screen.queryByText("Free")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockProfileQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps a cached free tier with an offline retry notice", async () => {
    mockOnline = false;
    mockProfileQuery = settledProfileQuery(freeProfile);
    const screen = await render(<AccountSettingsScreen />);

    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Profile unavailable")).toBeTruthy();
    expect(screen.getByTestId("notice-offline")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Subscription" })).toBeNull();
  });

  it("exposes the language value on the interactive row", async () => {
    const screen = await render(<AccountSettingsScreen />);
    const language = screen.getByRole("button", { name: "Language" });

    expect(language).toHaveProp("accessibilityValue", {
      text: "Device language (English)",
    });
    fireEvent.press(language);
    expect(Alert.alert).toHaveBeenCalledWith("Language", undefined, [
      expect.objectContaining({ text: "Use device language" }),
      expect.objectContaining({ text: "English" }),
      expect.objectContaining({ text: "Español" }),
      expect.objectContaining({ text: "Cancel", style: "cancel" }),
    ]);
  });

  it("keeps the saving language row a disabled semantic button", async () => {
    mockIsSaving = true;
    const screen = await render(<AccountSettingsScreen />);
    const language = screen.getByRole("button", { name: "Language" });

    expect(language).toHaveProp("accessibilityState", { disabled: true });
    expect(language).toHaveProp("accessibilityValue", {
      text: "Device language (English)",
    });
    fireEvent.press(language);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("gives sign out a 44-point minimum target", async () => {
    const screen = await render(<AccountSettingsScreen />);
    const signOut = screen.getByRole("button", { name: "Sign out" });

    expect(RNStyleSheet.flatten(signOut.props.style)).toEqual(
      expect.objectContaining({ minHeight: 44 }),
    );
  });
});
