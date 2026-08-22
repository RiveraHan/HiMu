import "../../src/theme";

import { useLayoutEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";

import { ScreenCanvas } from "../../src/components/ScreenCanvas";
import { StyleSheet } from "../../src/theme/react-native-unistyles";

const styles = StyleSheet.create({
  frame: (height: number) => ({
    height,
    minHeight: height,
    padding: 16,
    gap: 12,
  }),
});

function Fixture() {
  const dynamicFrame = styles.frame(64);

  useLayoutEffect(() => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="isolated-canvas-probe"]');
    if (!canvas) throw new Error("Missing isolated ScreenCanvas host");
    const css = getComputedStyle(canvas);
    document.querySelector("#browser-test-result")!.textContent = JSON.stringify({
      height: css.height,
      minHeight: css.minHeight,
      padding: css.padding,
      gap: css.gap,
    });
  }, []);

  return <ScreenCanvas testID="isolated-canvas-probe" style={dynamicFrame} />;
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing browser fixture root");
createRoot(root).render(<Fixture />);
