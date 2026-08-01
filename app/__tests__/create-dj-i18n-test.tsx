/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import CreateDJScreen from "@/app/create-dj";
import i18n from "@/src/i18n";

const mockCreate = jest.fn();
let mockPending = false;

jest.mock("@/src/hooks/use-create-dj", () => ({
  useCreateDJ: () => ({ mutate: mockCreate, isPending: mockPending }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useMiniPlayerPadding: () => 0 }));
jest.mock("@/src/hooks/use-toast", () => ({ useToast: () => ({ error: jest.fn() }) }));
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
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Sparkles: () => React.createElement(View) };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

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
