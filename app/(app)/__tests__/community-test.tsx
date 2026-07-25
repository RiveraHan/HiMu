import { render } from "@testing-library/react-native";
import CommunityScreen from "@/app/(app)/community";
import i18n from "@/src/i18n";

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

describe("CommunityScreen", () => {
  it("renders the Community placeholder in Spanish", async () => {
    await i18n.changeLanguage("es");

    const screen = await render(<CommunityScreen />);

    expect(screen.getByText("Comunidad (próximamente)")).toBeTruthy();
  });
});
