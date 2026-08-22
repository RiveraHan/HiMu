import { act, render } from "@testing-library/react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { LoginHero } from "@/src/components/auth/LoginHero";
import i18n from "@/src/i18n";

let mockWindowWidth = 390;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    width: mockWindowWidth,
    height: 844,
    scale: 1,
    fontScale: 1,
  }),
}));

function SignInContent() {
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google">
        <Text>Continue with Google</Text>
      </Pressable>
      <Pressable accessibilityRole="link" accessibilityLabel="Terms">
        <Text>Terms</Text>
      </Pressable>
    </>
  );
}

describe("LoginHero", () => {
  beforeEach(async () => {
    mockWindowWidth = 390;
    await i18n.changeLanguage("en");
  });

  it("keeps the compact brand-first sign-in flow", async () => {
    const screen = await render(
      <LoginHero>
        <SignInContent />
      </LoginHero>,
    );

    expect(screen.getByTestId("login-hero-desktop")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Continue with Google" })).toHaveLength(1);
  });

  it("uses a balanced centered desktop composition with one benefit list and sign-in action", async () => {
    mockWindowWidth = 1440;
    const screen = await render(
      <LoginHero>
        <SignInContent />
      </LoginHero>,
    );

    const hero = screen.getByTestId("login-hero-desktop");
    expect(StyleSheet.flatten(hero.props.style)).toEqual(
      expect.objectContaining({
        flexDirection: { xs: "column", xl: "row" },
        alignItems: { xs: "stretch", xl: "center" },
        justifyContent: { xs: "flex-start", xl: "center" },
        maxWidth: { xs: 520, xl: 1040 },
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("login-hero-promise").props.style)).toEqual(
      expect.objectContaining({
        flexBasis: { xs: "auto", xl: 0 },
        flexGrow: { xs: 0, xl: 1 },
        flexShrink: { xs: 0, xl: 1 },
        maxWidth: { xs: undefined, xl: 440 },
        minHeight: { xs: undefined, xl: 360 },
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("login-hero-sign-in").props.style)).toEqual(
      expect.objectContaining({
        flexBasis: { xs: "auto", xl: 0 },
        flexGrow: { xs: 0, xl: 1 },
        flexShrink: { xs: 0, xl: 1 },
        maxWidth: { xs: undefined, xl: 440 },
        minHeight: { xs: undefined, xl: 360 },
      }),
    );
    expect(screen.getByText("Make every listen yours.")).toBeTruthy();
    expect(screen.getByText("Discover music shaped around your taste.")).toBeTruthy();
    expect(screen.getByTestId("login-benefit").props.role).toBe("listitem");
    expect(screen.getByText("Make every listen yours.").parent).not.toBe(
      screen.getByTestId("login-benefit-list"),
    );
    expect(StyleSheet.flatten(screen.getByTestId("login-benefit").props.style)).toEqual(
      expect.objectContaining({ textAlign: "center" }),
    );
    expect(screen.getByText("Sign in to save your listening and pick up where you left off.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Continue with Google" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Terms" })).toBeTruthy();
  });

  it("keeps static and desktop first renders structurally identical while breakpoints control layout", async () => {
    const structuralMarkers = async (width: number) => {
      mockWindowWidth = width;
      const screen = await render(
        <LoginHero>
          <SignInContent />
        </LoginHero>,
      );
      const markers = [
        "login-hero-desktop",
        "login-hero-promise",
        "login-benefit-list",
        "login-benefit",
        "login-hero-sign-in",
      ].map((testID) => screen.getByTestId(testID).type);
      await act(async () => {
        screen.unmount();
      });
      return markers;
    };

    const staticMarkers = await structuralMarkers(0);
    const desktopMarkers = await structuralMarkers(1440);

    expect(staticMarkers).toEqual(desktopMarkers);
  });
});
