/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import { LanguagePreferencePicker } from "../LanguagePreferencePicker";

const mockSetPreference = jest.fn(async () => undefined);
let mockIsSaving = false;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      const labels: Record<string, string> = {
        "common.actions.cancel": "Cancel",
        "settings.language.en": "English",
        "settings.language.es": "Español",
        "settings.language.label": "Language",
        "settings.language.system": "Use device language",
        "settings.language.systemResolved": "Device language ({{language}})",
        "settings.sections.language": "Language",
      };
      return Object.entries(values ?? {}).reduce(
        (value, [name, replacement]) =>
          value.replace(`{{${name}}}`, replacement),
        labels[key] ?? key,
      );
    },
  }),
}));

jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({
    preference: "system",
    resolvedLanguage: "en",
    setPreference: mockSetPreference,
    isSaving: mockIsSaving,
  }),
}));

jest.mock("@/src/theme/react-native-unistyles", () => ({
  useUnistyles: () => ({
    theme: { colors: { onSurfaceVariant: "#aaa", outline: "#777" } },
  }),
}));

jest.mock("../SettingsInfoRow", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    SettingsInfoRow: ({
      label,
      value,
      onPress,
      disabled,
    }: {
      label: string;
      value: string;
      onPress: () => void;
      disabled: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: label,
          accessibilityRole: "button",
          accessibilityState: { disabled },
          accessibilityValue: { text: value },
          disabled,
          onPress,
        },
        React.createElement(Text, null, label),
      ),
  };
});

describe("LanguagePreferencePicker native boundary", () => {
  beforeEach(() => {
    mockSetPreference.mockClear();
    mockIsSaving = false;
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => jest.restoreAllMocks());

  it("preserves the native alert choices and delegates persistence", async () => {
    const screen = await render(<LanguagePreferencePicker />);
    fireEvent.press(screen.getByRole("button", { name: "Language" }));
    const options = jest.mocked(Alert.alert).mock.calls[0]?.[2];

    options?.find((option) => option.text === "Español")?.onPress?.();

    expect(mockSetPreference).toHaveBeenCalledWith("es");
  });

  it("keeps the native control disabled while the owner saves", async () => {
    mockIsSaving = true;
    const screen = await render(<LanguagePreferencePicker />);
    const picker = screen.getByRole("button", { name: "Language" });

    expect(picker).toHaveProp("accessibilityState", { disabled: true });
    fireEvent.press(picker);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
