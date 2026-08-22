import "../../src/theme";

import { useLayoutEffect } from "react";
// @ts-expect-error React DOM is an installed runtime dependency without local type declarations.
import { createRoot } from "react-dom/client";
import { Avatar } from "../../src/components/Avatar";

function Fixture() {
  useLayoutEffect(() => {
    const frame = document.querySelector<HTMLElement>('[data-testid="isolated-image-frame"]');
    if (!frame) throw new Error("Missing isolated Avatar/HimuImage host");
    const frameCss = getComputedStyle(frame);
    document.querySelector("#browser-test-result")!.textContent = JSON.stringify({
      frame: {
        width: frameCss.width,
        height: frameCss.height,
        borderRadius: frameCss.borderRadius,
      },
    });
  }, []);

  return (
    <Avatar
      testID="isolated-image-frame"
      fallback="Listener"
      size="lg"
    />
  );
}

const root = document.querySelector("#root");
if (!root) throw new Error("Missing browser fixture root");
createRoot(root).render(<Fixture />);
