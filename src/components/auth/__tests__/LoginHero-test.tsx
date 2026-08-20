import { render } from "@testing-library/react-native";
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

    expect(screen.getByTestId("login-hero-compact")).toBeTruthy();
    expect(screen.queryByTestId("login-hero-desktop")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Continue with Google" })).toHaveLength(1);
  });

  it("uses a 5/4 desktop composition with one visible benefit list and sign-in action", async () => {
    mockWindowWidth = 1440;
    const screen = await render(
      <LoginHero>
        <SignInContent />
      </LoginHero>,
    );

    const desktop = screen.getByTestId("login-hero-desktop");
    expect(StyleSheet.flatten(desktop.props.style)).toEqual(
      expect.objectContaining({ flexDirection: "row" }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("login-hero-promise").props.style)).toEqual(
      expect.objectContaining({ flex: 5 }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("login-hero-sign-in").props.style)).toEqual(
      expect.objectContaining({ flex: 4 }),
    );
    expect(screen.getByText("Make every listen yours.")).toBeTruthy();
    expect(screen.getByText("Discover music shaped around your taste.")).toBeTruthy();
    expect(screen.getByTestId("login-benefit").props.accessibilityRole).toBe("text");
    expect(screen.getByText("Sign in to save your listening and pick up where you left off.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Continue with Google" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Terms" })).toBeTruthy();
  });
});
