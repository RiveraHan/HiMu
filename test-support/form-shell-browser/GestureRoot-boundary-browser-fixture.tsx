import "../../src/theme";

import { useLayoutEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { UnistylesGestureHandlerRootView } from "../../src/components/UnistylesGestureHandlerRootView";
import { StyleSheet } from "../../src/theme/react-native-unistyles";

function Fixture() {
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="isolated-gesture-root"]');
    if (!root) throw new Error("Missing isolated GestureHandlerRootView host");
    const css = getComputedStyle(root);
    document.querySelector("#browser-test-result")!.textContent = JSON.stringify({
      height: css.height,
      minHeight: css.minHeight,
      padding: css.padding,
      gap: css.gap,
    });
  }, []);

  return <UnistylesGestureHandlerRootView testID="isolated-gesture-root" style={styles.frame} />;
}

const styles = StyleSheet.create({
  frame: {
    height: 63,
    minHeight: 63,
    padding: 13,
    gap: 9,
  },
});

const root = document.querySelector("#root");
if (!root) throw new Error("Missing browser fixture root");
createRoot(root).render(<Fixture />);
