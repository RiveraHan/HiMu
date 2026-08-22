import "../../src/theme";
import "../../src/i18n";

import { useLayoutEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { Pressable, View } from "react-native";

import { LoginHero } from "../../src/components/auth/LoginHero";
import { Text } from "../../src/components/Text";

function geometry(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    centerX: rect.left + rect.width / 2,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function visualStyle(node: HTMLElement) {
  const style = getComputedStyle(node);
  return {
    backgroundColor: style.backgroundColor,
    backdropFilter: style.backdropFilter,
  };
}

function Fixture() {
  useLayoutEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const promise = document.querySelector<HTMLElement>('[data-testid="login-hero-promise"]');
      const signIn = document.querySelector<HTMLElement>('[data-testid="login-hero-sign-in"]');
      const action = document.querySelector<HTMLElement>('[data-testid="compact-login-action"]');
      const footer = document.querySelector<HTMLElement>('[data-testid="compact-login-footer"]');
      if (!promise || !signIn || !action || !footer) {
        throw new Error("Missing compact LoginHero probe");
      }

      document.querySelector("#browser-test-result")!.textContent = JSON.stringify({
        promise: geometry(promise),
        signIn: geometry(signIn),
        action: geometry(action),
        footer: geometry(footer),
        signInStyle: visualStyle(signIn),
      });
    }));
  }, []);

  return (
    <LoginHero>
      <Pressable
        testID="compact-login-action"
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        style={{ height: 64, justifyContent: "center" }}
      >
        <Text>Continue with Google</Text>
      </Pressable>
      <View testID="compact-login-footer" style={{ height: 44, marginTop: "auto" }} />
    </LoginHero>
  );
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing browser fixture root");
createRoot(root).render(<Fixture />);
