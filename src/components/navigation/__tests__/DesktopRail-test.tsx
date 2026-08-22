/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { DesktopRail } from "@/src/components/navigation/DesktopRail";
import i18n from "@/src/i18n";
import { darkTheme } from "@/src/theme/theme";

let mockPathname = "/(app)/discover";
let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock("expo-router", () => {
  const React = require("react");

  return {
    Link: ({ children, href }: { children: React.ReactElement; href: unknown }) =>
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
    const screen = await render(<DesktopRail ownedDjId="owned-dj" />);

    expect(screen.getByRole("link", { name: "Discover" }).props["aria-current"])
      .toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).props["aria-current"])
      .toBeUndefined();
    expect(screen.queryByLabelText("Community")).toBeNull();
  });

  it.each([
    ["/create-track", "Create track"],
    ["/train-dj/dj-7", "Create track"],
    ["/account-settings", "Profile"],
    ["/preferences", "Profile"],
    ["/vibe-check", "Profile"],
  ])("maps %s to its navigation area", async (pathname, currentLabel) => {
    mockPathname = pathname;
    const screen = await render(<DesktopRail ownedDjId="owned-dj" />);

    expect(screen.getByRole("link", { name: currentLabel }).props["aria-current"])
      .toBe("page");
  });

  it("does not assign unrelated DJ detail routes to a navigation area", async () => {
    mockPathname = "/dj/dj-7";
    const screen = await render(<DesktopRail ownedDjId="owned-dj" />);

    expect(screen.getAllByRole("link").every((link) => link.props["aria-current"] === undefined))
      .toBe(true);
  });

  it("keeps main destinations in one evenly spaced group and anchors only the account action", async () => {
    const screen = await render(<DesktopRail ownedDjId="owned-dj" />);

    const main = screen.getByTestId("desktop-rail-main-links");
    expect(main.children).toHaveLength(4);
    expect(within(main).getAllByRole("link").map((link) => link.props.accessibilityLabel)).toEqual([
      "Home",
      "Discover",
      "Create track",
      "Favorites",
    ]);
    expect(StyleSheet.flatten(main.props.style)).toEqual(expect.objectContaining({
      gap: darkTheme.spacing.stackSm,
    }));
    expect(screen.getByTestId("desktop-rail-account-link").children).toHaveLength(1);
    expect(screen.getByTestId("desktop-rail")).toHaveStyle({
      justifyContent: "space-between",
    });
  });

  it("uses an 88-point rail with 44-point links and sends owners to track creation", async () => {
    mockInsets = { top: 12, right: 0, bottom: 0, left: 20 };
    const screen = await render(<DesktopRail ownedDjId="owned-dj" />);
    const create = screen.getByRole("link", { name: "Create track" });

    expect(screen.getByTestId("desktop-rail")).toHaveStyle({ width: 108 });
    expect(create).toHaveStyle({ minWidth: 44, minHeight: 44 });
    expect(screen.queryByTestId("desktop-rail-tooltip-create")).toBeNull();
    await fireEvent(create, "focus");

    expect(screen.getByTestId("desktop-rail-tooltip-create")).toHaveTextContent(
      "Create track",
    );
    expect(create.props.href).toEqual({
      pathname: "/create-track",
      params: { djId: "owned-dj" },
    });
  });

  it("keeps DJ creation as the primary action until the account owns a DJ", async () => {
    const screen = await render(<DesktopRail ownedDjId={null} />);

    expect(screen.getByRole("link", { name: "Create your DJ" }).props.href)
      .toBe("/create-dj");
  });

  it("keeps creation neutral and disabled until DJ ownership is known", async () => {
    const screen = await render(<DesktopRail ownedDjId={undefined} />);

    const create = screen.getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();
    expect(create.props.accessibilityState).toEqual({ disabled: true });
    expect(screen.queryByRole("link", { name: "Create your DJ" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Create track" })).toBeNull();
  });
});
