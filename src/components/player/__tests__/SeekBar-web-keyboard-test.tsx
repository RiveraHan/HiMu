/** @jest-environment jsdom */
import { act } from "react";
// The app ships react-dom through Expo; this test uses its runtime without adding package churn.
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { createRoot } from "react-dom/client";

import { SeekBarWebKeyboardControl } from "../SeekBarKeyboardControl.web";

describe("SeekBar web keyboard control", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    ["ArrowRight", 40],
    ["ArrowUp", 40],
    ["ArrowLeft", 20],
    ["ArrowDown", 20],
    ["PageUp", 90],
    ["PageDown", 0],
    ["Home", 0],
    ["End", 100],
  ] as const)("handles %s from the focused DOM slider", (key, expected) => {
    const onSeek = jest.fn();
    act(() => {
      root.render(
        <SeekBarWebKeyboardControl
          label="Seek playback"
          valueText="0:30 of 1:40"
          positionSec={30}
          durationSec={100}
          onSeek={onSeek}
        />,
      );
    });

    const slider = container.querySelector<HTMLElement>("[role='slider']");
    expect(slider).not.toBeNull();
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });

    act(() => {
      slider!.focus();
      slider!.dispatchEvent(event);
    });

    expect(onSeek).toHaveBeenCalledWith(expected);
    expect(event.defaultPrevented).toBe(true);
  });

  it("exposes focus and numeric ARIA values on the actual DOM node", () => {
    act(() => {
      root.render(
        <SeekBarWebKeyboardControl
          label="Seek playback"
          valueText="0:30 of 1:40"
          positionSec={130}
          durationSec={100}
          onSeek={jest.fn()}
        />,
      );
    });

    const slider = container.querySelector<HTMLElement>("[role='slider']");
    expect(slider).toMatchObject({ tabIndex: 0 });
    expect(slider?.getAttribute("aria-label")).toBe("Seek playback");
    expect(slider?.getAttribute("aria-valuemin")).toBe("0");
    expect(slider?.getAttribute("aria-valuemax")).toBe("100");
    expect(slider?.getAttribute("aria-valuenow")).toBe("100");
    expect(slider?.getAttribute("aria-valuetext")).toBe("0:30 of 1:40");
  });
});
