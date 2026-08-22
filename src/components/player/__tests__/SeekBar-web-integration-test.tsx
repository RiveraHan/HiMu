/** @jest-environment jsdom */
import { act } from "react";
// Expo ships react-dom at runtime; the optional type package is not installed.
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { createRoot } from "react-dom/client";

jest.mock("react-native", () => jest.requireActual("react-native-web"));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(),
}));

jest.mock("react-native-gesture-handler", () => {
  const pan: Record<"onBegin" | "onUpdate" | "onEnd", jest.Mock> = {
    onBegin: jest.fn(() => pan),
    onUpdate: jest.fn(() => pan),
    onEnd: jest.fn(() => pan),
  };

  return {
    Gesture: { Pan: () => pan },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native-web");
  return {
    __esModule: true,
    default: { View },
    Easing: { ease: "ease", out: (value: unknown) => value },
    useAnimatedStyle: (factory: () => object) => factory(),
    useDerivedValue: (factory: () => number) => ({ value: factory() }),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ value }),
    withTiming: (value: unknown) => value,
  };
});

jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));
jest.mock("../SeekBarKeyboardControl", () =>
  jest.requireActual("../SeekBarKeyboardControl.web"),
);

// eslint-disable-next-line import/first
import { SeekBar } from "../SeekBar";

function channelToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string) {
  const channels = color.match(/\d+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${color}`);
  const [red, green, blue] = channels.map(channelToLinear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe("SeekBar integrated React Native Web output", () => {
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

  function renderSeekBar(onSeek = jest.fn()) {
    act(() => {
      root.render(<SeekBar positionSec={30} durationSec={100} onSeek={onSeek} />);
    });
    return onSeek;
  }

  it("renders exactly one focusable semantic slider with complete numeric ARIA", () => {
    renderSeekBar();

    const sliders = Array.from(container.querySelectorAll<HTMLElement>("[role='slider']"));
    const focusableSliders = sliders.filter((slider) => slider.tabIndex >= 0);

    expect(sliders).toHaveLength(1);
    expect(focusableSliders).toHaveLength(1);
    expect(sliders[0]).toMatchObject({ tabIndex: 0 });
    expect(sliders[0].getAttribute("aria-label")).toBe("Playback position");
    expect(sliders[0].getAttribute("aria-orientation")).toBe("horizontal");
    expect(sliders[0].getAttribute("aria-valuemin")).toBe("0");
    expect(sliders[0].getAttribute("aria-valuemax")).toBe("100");
    expect(sliders[0].getAttribute("aria-valuenow")).toBe("30");
    expect(sliders[0].getAttribute("aria-valuetext")).toBe("0:30 of 1:40");
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
  ] as const)("preserves %s behavior on the single DOM slider", (key, expected) => {
    const onSeek = renderSeekBar();
    const slider = container.querySelector<HTMLElement>("[role='slider']");
    if (!slider) throw new Error("Missing integrated slider");
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });

    act(() => {
      slider.focus();
      slider.dispatchEvent(event);
    });

    expect(onSeek).toHaveBeenCalledWith(expected);
    expect(event.defaultPrevented).toBe(true);
  });

  it("uses a focus indicator with at least 3:1 contrast on light and dark surfaces", () => {
    renderSeekBar();
    const sliders = container.querySelectorAll<HTMLElement>("[role='slider']");

    act(() => sliders[sliders.length - 1].focus());

    const outlineColor = getComputedStyle(sliders[sliders.length - 1]).outlineColor;
    expect(contrastRatio(outlineColor, "rgb(255, 255, 255)")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(outlineColor, "rgb(13, 13, 18)")).toBeGreaterThanOrEqual(3);
  });
});
