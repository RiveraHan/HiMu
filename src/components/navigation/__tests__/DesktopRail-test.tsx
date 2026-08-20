/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";

import { DesktopRail } from "@/src/components/navigation/DesktopRail";
import i18n from "@/src/i18n";

let mockPathname = "/(app)/discover";
let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock("expo-router", () => {
  const React = require("react");

  return {
    Link: ({ children, href }: { children: React.ReactElement; href: string }) =>
      React.cloneElement(children, { testID: `desktop-rail-link-${href}`, href }),
    usePathname: () => mockPathname,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
}));

describe("DesktopRail", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockPathname = "/(app)/discover";
    mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  });

  it("marks the current navigation link and keeps Community out of desktop navigation", async () => {
    const screen = await render(<DesktopRail />);

    expect(screen.getByRole("link", { name: "Discover" }).props["aria-current"])
      .toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).props["aria-current"])
      .toBeUndefined();
    expect(screen.queryByLabelText("Community")).toBeNull();
  });

  it.each([
    ["/create-track", "Create your DJ"],
    ["/train-dj/dj-7", "Create your DJ"],
    ["/account-settings", "Profile"],
    ["/preferences", "Profile"],
    ["/vibe-check", "Profile"],
  ])("maps %s to its navigation area", async (pathname, currentLabel) => {
    mockPathname = pathname;
    const screen = await render(<DesktopRail />);

    expect(screen.getByRole("link", { name: currentLabel }).props["aria-current"])
      .toBe("page");
  });

  it("does not assign unrelated DJ detail routes to a navigation area", async () => {
    mockPathname = "/dj/dj-7";
    const screen = await render(<DesktopRail />);

    expect(screen.getAllByRole("link").every((link) => link.props["aria-current"] === undefined))
      .toBe(true);
  });

  it("uses an 88-point rail with 44-point links, safe-area geometry, and keyboard-visible labels", async () => {
    mockInsets = { top: 12, right: 0, bottom: 0, left: 20 };
    const screen = await render(<DesktopRail />);
    const create = screen.getByRole("link", { name: "Create your DJ" });

    expect(screen.getByTestId("desktop-rail")).toHaveStyle({ width: 108 });
    expect(create).toHaveStyle({ minWidth: 44, minHeight: 44 });
    expect(screen.queryByTestId("desktop-rail-tooltip-/create-dj")).toBeNull();
    await fireEvent(create, "focus");

    expect(screen.getByTestId("desktop-rail-tooltip-/create-dj")).toHaveTextContent(
      "Create your DJ",
    );
    expect(screen.getByTestId("desktop-rail-link-/create-dj").props.href).toBe("/create-dj");
  });
});
