/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import MusicPreferencesScreen from "@/app/preferences";
import i18n from "@/src/i18n";

const mockUpdate = jest.fn();

jest.mock("@/src/hooks/use-music-preferences", () => ({
  useMusicPreferences: () => ({
    data: {
      genres: [],
      excludedMoods: [],
      vibeMapping: { organicElectronic: 0.5, melancholicEuphoric: 0.5 },
      aiFrequency: "optimal",
      discoveryDepth: false,
    },
  }),
  useUpdateMusicPreferences: () => ({ mutate: mockUpdate }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({
    resolvedLanguage: require("@/src/i18n").default.resolvedLanguage,
  }),
}));
jest.mock("@/src/components", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    ScreenScrollView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    ScreenHeader: ({ kicker, title, subtitle }: Record<string, string>) =>
      React.createElement(View, null, [kicker, title, subtitle].map((text) =>
        React.createElement(Text, { key: text }, text),
      )),
    PrefSection: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) =>
      React.createElement(View, null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        children,
      ),
    GroupedChipPicker: ({ groups, getGroupLabel, getItemLabel, onToggle }: {
      groups: readonly { label: string; items: readonly string[] }[];
      getGroupLabel: (value: string) => string;
      getItemLabel: (value: string) => string;
      onToggle: (value: string) => void;
    }) => {
      const group = groups[0];
      const item = group.items[0];
      return React.createElement(View, null,
        React.createElement(Text, null, getGroupLabel(group.label)),
        React.createElement(
          Pressable,
          { accessibilityRole: "button", accessibilityLabel: getItemLabel(item), onPress: () => onToggle(item) },
          React.createElement(Text, null, getItemLabel(item)),
        ),
      );
    },
    VibeSlider: ({ leftLabel, rightLabel }: { leftLabel: string; rightLabel: string }) =>
      React.createElement(Text, null, `${leftLabel} / ${rightLabel}`),
  };
});
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Icon = () => React.createElement(View);
  return { AudioLines: Icon, Ban: Icon, SlidersHorizontal: Icon };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

test("renders Spanish preferences while mutations keep canonical values", async () => {
  await i18n.changeLanguage("es");
  const screen = await render(<MusicPreferencesScreen />);

  expect(screen.getByText("Preferencias musicales")).toBeTruthy();
  expect(screen.getByText("Afinidad de géneros")).toBeTruthy();
  expect(screen.getByText("Relajado y ambiental")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "Ambiental" }));
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ genres: ["Ambient"] }),
  );
});
