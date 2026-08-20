import { fireEvent, render } from "@testing-library/react-native";

import { DesktopRail } from "@/src/components/navigation/DesktopRail";
import i18n from "@/src/i18n";

let mockPathname = "/(app)/discover";
const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("DesktopRail", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockPathname = "/(app)/discover";
    mockNavigate.mockClear();
  });

  it("announces the active route and keeps Community out of desktop navigation", async () => {
    const screen = await render(<DesktopRail />);

    expect(screen.getByRole("tab", { name: "Discover" }).props)
      .toEqual(expect.objectContaining({ accessibilityState: { selected: true } }));
    expect(screen.getByRole("tab", { name: "Home" }).props)
      .toEqual(expect.objectContaining({ accessibilityState: { selected: false } }));
    expect(screen.queryByLabelText("Community")).toBeNull();
  });

  it("uses labelled 44-point route targets and only navigates when Create DJ is pressed", async () => {
    const screen = await render(<DesktopRail />);
    const create = screen.getByRole("tab", { name: "Create your DJ" });

    expect(create).toHaveStyle({ minWidth: 44, minHeight: 44 });
    await fireEvent.press(create);

    expect(mockNavigate).toHaveBeenCalledWith("/create-dj");
  });
});
