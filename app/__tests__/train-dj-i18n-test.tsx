/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import TrainDJScreen from "@/app/train-dj/[id]";
import i18n from "@/src/i18n";

const mockUpdate = jest.fn();
let mockPending = false;

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
jest.mock("@/src/hooks/use-update-dj", () => ({
  useUpdateDJ: () => ({ mutate: mockUpdate, isPending: mockPending }),
}));
jest.mock("@/src/hooks/use-phase-rotation", () => ({ usePhaseRotation: (phases: string[]) => phases[0] }));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({ useMiniPlayerPadding: () => 0 }));
jest.mock("@/src/hooks/use-toast", () => ({ useToast: () => ({ error: jest.fn(), warning: jest.fn() }) }));
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
  router: { back: jest.fn() },
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
