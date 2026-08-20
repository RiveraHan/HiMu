import { render } from "@testing-library/react-native";
import { View } from "react-native";

import { ResponsiveAppShell } from "@/src/components/ResponsiveAppShell";
import { DESKTOP_RAIL_WIDTH } from "@/src/components/bottom-chrome-metrics";

let mockWindowWidth = 1023;

jest.mock("expo-router", () => ({
  usePathname: () => "/(app)",
  useRouter: () => ({ navigate: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 844, scale: 1, fontScale: 1 }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("ResponsiveAppShell", () => {
  beforeEach(() => {
    mockWindowWidth = 1023;
  });

  it("keeps the compact and medium canvas free of a desktop rail", async () => {
    const screen = await render(
      <ResponsiveAppShell><View testID="route-content" /></ResponsiveAppShell>,
    );

    expect(screen.queryByTestId("desktop-rail")).toBeNull();
    expect(screen.getByTestId("responsive-app-content")).not.toHaveStyle({
      paddingLeft: DESKTOP_RAIL_WIDTH,
    });
  });

  it("insets desktop route content beside the rail at 1024 points", async () => {
    mockWindowWidth = 1024;
    const screen = await render(
      <ResponsiveAppShell><View testID="route-content" /></ResponsiveAppShell>,
    );

    expect(screen.getByTestId("desktop-rail")).toBeTruthy();
    expect(screen.getByTestId("responsive-app-content")).toHaveStyle({
      paddingLeft: DESKTOP_RAIL_WIDTH,
    });
    expect(screen.getByTestId("route-content")).toBeTruthy();
  });

  it("keeps desktop navigation suppressed when the surrounding route is hidden", async () => {
    mockWindowWidth = 1024;
    const screen = await render(
      <ResponsiveAppShell showRail={false}><View testID="route-content" /></ResponsiveAppShell>,
    );

    expect(screen.queryByTestId("desktop-rail")).toBeNull();
    expect(screen.getByTestId("responsive-app-content")).not.toHaveStyle({
      paddingLeft: DESKTOP_RAIL_WIDTH,
    });
  });
});
