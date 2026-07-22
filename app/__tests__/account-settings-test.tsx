/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import AccountSettingsScreen from "@/app/account-settings";

const mockSetPreference = jest.fn();
let mockIsSaving = false;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "settings.sections.language": "Language",
        "settings.language.label": "Language",
        "settings.language.system": "Use device language",
        "settings.language.systemResolved": "Device language ({{language}})",
        "settings.language.en": "English",
        "settings.language.es": "Español",
        "common.actions.cancel": "Cancel",
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
    }: {
      label: string;
      value: string;
      onPress?: () => void;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: label,
          accessibilityRole: "button",
          disabled: !onPress,
          onPress,
        },
        React.createElement(NativeText, null, label),
        React.createElement(NativeText, null, value),
      ),
    SettingsSection: ({ children, title }: { children: React.ReactNode; title: string }) =>
      React.createElement(View, null, [
        React.createElement(NativeText, { key: "title" }, title),
        children,
      ]),
    SettingsToggleRow: () => React.createElement(View),
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
jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: () => null }));
jest.mock("@/src/hooks/use-profile", () => ({ useProfile: () => ({ data: null }) }));
jest.mock("@/src/hooks/use-settings", () => ({
  useSettings: () => ({ data: undefined }),
  useUpdateSettings: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ flushListeningStats: jest.fn() }),
}));
jest.mock("@/src/hooks/use-confirm", () => ({ useConfirm: () => jest.fn() }));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useMiniPlayerPadding: () => 0 }));
jest.mock("@/src/api/auth", () => ({ authApi: { signOut: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("expo-device", () => ({ osName: null, osVersion: null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("react-native-unistyles", () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        error: "#f00",
        onSurfaceVariant: "#111",
        outline: "#222",
        primary: "#333",
        primaryContainer: "#444",
      },
      spacing: { stackMd: 8, stackLg: 16, stackSm: 4, pageMargin: 20 },
    },
  }),
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));

describe("AccountSettingsScreen", () => {
  beforeEach(() => {
    mockSetPreference.mockReset();
    mockIsSaving = false;
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows the resolved device language and maps every language option", async () => {
    const screen = await render(<AccountSettingsScreen />);

    expect(screen.getByLabelText("Language")).toBeTruthy();
    expect(screen.getByText("Device language (English)")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Language"));

    expect(Alert.alert).toHaveBeenCalledWith("Language", undefined, [
      expect.objectContaining({ text: "Use device language" }),
      expect.objectContaining({ text: "English" }),
      expect.objectContaining({ text: "Español" }),
      expect.objectContaining({ text: "Cancel", style: "cancel" }),
    ]);

    const actions = jest.mocked(Alert.alert).mock.calls[0][2]!;
    actions[0].onPress?.();
    actions[1].onPress?.();
    actions[2].onPress?.();

    expect(mockSetPreference).toHaveBeenNthCalledWith(1, "system");
    expect(mockSetPreference).toHaveBeenNthCalledWith(2, "en");
    expect(mockSetPreference).toHaveBeenNthCalledWith(3, "es");
  });

  it("does not open the language picker while saving a preference", async () => {
    mockIsSaving = true;
    const screen = await render(<AccountSettingsScreen />);

    await fireEvent.press(screen.getByLabelText("Language"));

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
