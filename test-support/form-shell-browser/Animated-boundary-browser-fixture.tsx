import "../../src/theme";

import { useLayoutEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { View } from "react-native";

import { EqualizerBars } from "../../src/components/EqualizerBars";

function Fixture() {
  useLayoutEffect(() => {
    const probe = document.querySelector<HTMLElement>('[data-testid="isolated-animated-probe"]');
    const bar = probe && Array.from(probe.querySelectorAll<HTMLElement>("*")).find(
      (node) => node.childElementCount === 0,
    );
    if (!bar) throw new Error("Missing isolated animated bar host");
    const css = getComputedStyle(bar);
    document.querySelector("#browser-test-result")!.textContent = JSON.stringify({
      width: css.width,
      height: css.height,
      borderRadius: css.borderRadius,
    });
  }, []);

  return (
    <View testID="isolated-animated-probe" style={{ width: 320 }}>
      <EqualizerBars bars={1} height={14} />
    </View>
  );
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing browser fixture root");
createRoot(root).render(<Fixture />);
