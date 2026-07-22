import { fireEvent, render } from "@testing-library/react-native";
import { TopDjRow } from "../TopDjRow";
import i18n from "@/src/i18n";

test.each([
  ["en", "Open DJ One profile", "House"],
  ["es", "Abrir el perfil de DJ One", "House"],
] as const)(
  "announces the real profile action in %s without changing DJ data",
  async (language, actionLabel, specialty) => {
    const onPress = jest.fn();
    await i18n.changeLanguage(language);
    const screen = await render(
      <TopDjRow
        rank={1}
        name="DJ One"
        specialty="House"
        avatarUrl={null}
        onPress={onPress}
      />,
    );

    expect(screen.getByText("DJ One")).toBeTruthy();
    expect(screen.getByText(specialty)).toBeTruthy();
    const action = screen.getByRole("button", { name: actionLabel });
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  },
);
