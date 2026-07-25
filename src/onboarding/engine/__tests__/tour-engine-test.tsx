import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler, Pressable, Text, View } from "react-native";
import type { TestInstance } from "test-renderer";

import i18n from "@/src/i18n";
import type { SpotlightStep } from "../../types";
import { SpotlightTourEngine } from "../SpotlightTourEngine";
import { TourTarget } from "../TourTarget";

type MeasureCallback = (x: number, y: number, width: number, height: number) => void;

const mockMeasureCallbacks = new Map<string, MeasureCallback[]>();
const mockWithTiming = jest.fn((value: number, _config: unknown) => value);
const mockWithRepeat = jest.fn((animation: number) => animation);
const mockSetAccessibilityFocus = jest.fn((_node: number) => undefined);
const mockFindNodeHandle = jest.fn((_component: unknown) => 42);
let mockReducedMotion = false;
let hostHasBeenMeasured = false;
const mockWindowDimensions = { width: 400, height: 800 };
const mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const HOME_TOUR_STEPS = [
  {
    id: "home.daily-drop",
    targetId: "home.hero",
    title: "START HERE",
    description: "Your Daily Drop is a fresh track selected for this moment.",
    placement: "bottom",
  },
  {
    id: "home.djs",
    targetId: "home.djs",
    title: "DIFFERENT MINDS, DIFFERENT SOUNDS",
    description: "Each AI DJ has a distinct sound and personality.",
    placement: "top",
  },
  {
    id: "home.discover",
    targetId: "tabs.discover",
    title: "GO BEYOND YOUR FEED",
    description: "Search and explore more music whenever you want.",
    placement: "top",
  },
] as const satisfies readonly SpotlightStep[];

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const ReactModule = jest.requireActual("react");
  const MockView = ReactModule.forwardRef(
    ({ testID, ...props }: { testID?: string }, ref: React.Ref<unknown>) => {
      ReactModule.useImperativeHandle(ref, () => ({
        measureInWindow: (callback: MeasureCallback) => {
          if (!testID) return;
          const callbacks = mockMeasureCallbacks.get(testID) ?? [];
          callbacks.push(callback);
          mockMeasureCallbacks.set(testID, callbacks);
        },
      }));
      return ReactModule.createElement(actual.View, { ...props, testID });
    },
  );

  const overrides = {
    AccessibilityInfo: {
      ...actual.AccessibilityInfo,
      setAccessibilityFocus: (node: number) => mockSetAccessibilityFocus(node),
    },
    findNodeHandle: (component: unknown) => mockFindNodeHandle(component),
    useWindowDimensions: () => mockWindowDimensions,
    View: MockView,
  };
  const descriptors = Object.getOwnPropertyDescriptors(actual);
  for (const property of Object.keys(overrides)) delete descriptors[property];
  return Object.defineProperties(overrides, descriptors);
});

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return new Proxy(actual, {
    get: (target, property) => {
      if (property === "useReducedMotion") return () => mockReducedMotion;
      if (property === "withTiming") {
        return (value: number, config: unknown) => mockWithTiming(value, config);
      }
      if (property === "withRepeat") {
        return (animation: number) => mockWithRepeat(animation);
      }
      return target[property];
    },
  });
});

type HarnessProps = {
  active?: boolean;
  borderRadius?: number;
  currentIndex?: number;
  includeAllTargets?: boolean;
  ready?: boolean;
  steps?: readonly SpotlightStep[];
};

function Harness({
  active = true,
  borderRadius = 24,
  currentIndex = 0,
  includeAllTargets = true,
  ready = true,
  steps = HOME_TOUR_STEPS,
}: HarnessProps) {
  return (
    <SpotlightTourEngine
      active={active}
      ready={ready}
      steps={steps}
      currentIndex={currentIndex}
      onNext={mockOnNext}
      onPrevious={mockOnPrevious}
      onSkip={mockOnSkip}
      onFinishSpotlights={mockOnFinishSpotlights}
      renderTooltip={({
        step,
        currentIndex: tooltipIndex,
        total,
        onNext,
        onPrevious,
        onSkip,
      }) => (
        <View testID="tooltip-content">
          <Text>{step.title}</Text>
          <Text>{`${tooltipIndex + 1}/${total}`}</Text>
          <Pressable accessibilityLabel="Previous tour step" onPress={onPrevious} />
          <Pressable accessibilityLabel="Next tour step" onPress={onNext} />
          <Pressable accessibilityLabel="Skip tour" onPress={onSkip} />
        </View>
      )}
    >
      <View testID="background-content">
        {steps.map((step, index) =>
          includeAllTargets || index < steps.length - 1 ? (
            <TourTarget
              borderRadius={borderRadius}
              id={step.targetId}
              key={step.id}
              testID={`tour-target-${index}`}
            >
              <View testID={index === 0 ? "target-child" : undefined} />
            </TourTarget>
          ) : null,
        )}
      </View>
    </SpotlightTourEngine>
  );
}

const mockOnNext = jest.fn();
const mockOnPrevious = jest.fn();
const mockOnSkip = jest.fn();
const mockOnFinishSpotlights = jest.fn();

async function signalLayout(getByTestId: (id: string) => TestInstance, index: number) {
  await fireEvent(getByTestId(`tour-target-${index}`), "layout", {
    nativeEvent: { layout: { x: 1, y: 1, width: 10, height: 10 } },
  });
}

async function measureHost(
  getByTestId: (id: string, options?: { includeHiddenElements?: boolean }) => TestInstance,
  rect = {
    x: 0,
    y: 0,
    width: mockWindowDimensions.width,
    height: mockWindowDimensions.height,
  },
) {
  await fireEvent(getByTestId("tour-host", { includeHiddenElements: true }), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: rect.width, height: rect.height } },
  });
  const callback = mockMeasureCallbacks.get("tour-host")?.at(-1);
  if (!callback) throw new Error("Tour host did not request measureInWindow");
  await act(() => callback(rect.x, rect.y, rect.width, rect.height));
  hostHasBeenMeasured = true;
}

async function measureTarget(
  getByTestId: (id: string) => TestInstance,
  index: number,
  rect = { x: 24, y: 80 + index * 120, width: 240, height: 80 },
) {
  if (!hostHasBeenMeasured) await measureHost(getByTestId);
  await signalLayout(getByTestId, index);
  const callbacks = mockMeasureCallbacks.get(`tour-target-${index}`);
  const callback = callbacks?.at(-1);
  if (!callback) throw new Error(`Target ${index} did not request measureInWindow`);
  await act(() => callback(rect.x, rect.y, rect.width, rect.height));
}

async function measureAllTargets(
  getByTestId: (id: string) => TestInstance,
  steps: readonly SpotlightStep[] = HOME_TOUR_STEPS,
) {
  await measureHost(getByTestId);
  for (let index = 0; index < steps.length; index += 1) {
    await measureTarget(getByTestId, index);
  }
}

async function measureTooltip(
  getByTestId: (id: string, options?: { includeHiddenElements?: boolean }) => TestInstance,
  height = 120,
) {
  await fireEvent(getByTestId("tour-tooltip-container", { includeHiddenElements: true }), "layout", {
    nativeEvent: { layout: { x: 16, y: 0, width: 368, height } },
  });
}

async function activateTour(
  getByTestId: (id: string, options?: { includeHiddenElements?: boolean }) => TestInstance,
) {
  await measureAllTargets(getByTestId);
  await measureTooltip(getByTestId);
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  jest.clearAllMocks();
  mockMeasureCallbacks.clear();
  mockReducedMotion = false;
  hostHasBeenMeasured = false;
  mockWindowDimensions.width = 400;
  mockWindowDimensions.height = 800;
  mockSafeAreaInsets.top = 0;
  mockSafeAreaInsets.right = 0;
  mockSafeAreaInsets.bottom = 0;
  mockSafeAreaInsets.left = 0;
  jest.useRealTimers();
});

it("requires fresh positive window measurements after ready becomes true", async () => {
  const { getByTestId, getByText, queryByTestId, queryByText, rerender } =
    await render(<Harness />);
  await activateTour(getByTestId);
  expect(getByText(HOME_TOUR_STEPS[0].title)).toBeTruthy();

  mockWithTiming.mockClear();
  await rerender(<Harness ready={false} />);
  expect(queryByText(HOME_TOUR_STEPS[0].title)).toBeNull();
  expect(queryByTestId("tour-overlay", { includeHiddenElements: true })).toBeNull();
  expect(queryByTestId("tour-cutout", { includeHiddenElements: true })).toBeNull();
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "importantForAccessibility",
    "auto",
  );
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    false,
  );
  expect(mockWithTiming).not.toHaveBeenCalled();
  const countsWhileReady = HOME_TOUR_STEPS.map(
    (_, index) => mockMeasureCallbacks.get(`tour-target-${index}`)?.length ?? 0,
  );
  await signalLayout(getByTestId, 0);
  await signalLayout(getByTestId, 1);
  await signalLayout(getByTestId, 2);
  expect(
    HOME_TOUR_STEPS.map(
      (_, index) => mockMeasureCallbacks.get(`tour-target-${index}`)?.length ?? 0,
    ),
  ).toEqual(countsWhileReady);

  await rerender(<Harness ready />);
  expect(queryByText(HOME_TOUR_STEPS[0].title)).toBeNull();
  await measureHost(getByTestId);
  for (let index = 0; index < HOME_TOUR_STEPS.length; index += 1) {
    const callbacks = mockMeasureCallbacks.get(`tour-target-${index}`);
    expect(callbacks?.length ?? 0).toBeGreaterThan(countsWhileReady[index]);
    const callback = callbacks?.at(-1);
    if (!callback) throw new Error(`Target ${index} did not remeasure after ready`);
    await act(() => callback(24, 80 + index * 120, 240, 80));
  }
  expect(queryByText(HOME_TOUR_STEPS[0].title)).toBeNull();
  await measureTooltip(getByTestId);
  expect(getByText(HOME_TOUR_STEPS[0].title)).toBeTruthy();
});

it("retires immediately when active and ready become false together", async () => {
  const { getByTestId, queryByTestId, rerender } = await render(<Harness />);
  await activateTour(getByTestId);

  mockWithTiming.mockClear();
  await rerender(<Harness active={false} ready={false} />);

  expect(queryByTestId("tour-overlay", { includeHiddenElements: true })).toBeNull();
  expect(queryByTestId("tour-cutout", { includeHiddenElements: true })).toBeNull();
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "importantForAccessibility",
    "auto",
  );
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    false,
  );
  expect(mockWithTiming).not.toHaveBeenCalled();
});

it("starts a new measurement epoch when the viewport changes", async () => {
  mockReducedMotion = true;
  const { getByTestId, getByText, queryByText, rerender } = await render(<Harness />);
  await activateTour(getByTestId);
  expect(getByText(HOME_TOUR_STEPS[0].title)).toBeTruthy();

  const staleCallbacks = HOME_TOUR_STEPS.map((_, index) => {
    const callback = mockMeasureCallbacks.get(`tour-target-${index}`)?.at(-1);
    if (!callback) throw new Error(`Target ${index} has no pre-resize measurement callback`);
    return callback;
  });
  const callbackCounts = HOME_TOUR_STEPS.map(
    (_, index) => mockMeasureCallbacks.get(`tour-target-${index}`)?.length ?? 0,
  );

  mockWindowDimensions.width = 800;
  mockWindowDimensions.height = 400;
  await rerender(<Harness />);

  expect(queryByText(HOME_TOUR_STEPS[0].title)).toBeNull();
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    false,
  );

  for (let index = 0; index < staleCallbacks.length; index += 1) {
    await act(() => staleCallbacks[index](24, 40 + index * 80, 240, 60));
  }
  expect(queryByText(HOME_TOUR_STEPS[0].title)).toBeNull();

  for (let index = 0; index < HOME_TOUR_STEPS.length; index += 1) {
    const callbacks = mockMeasureCallbacks.get(`tour-target-${index}`);
    expect(callbacks?.length ?? 0).toBeGreaterThan(callbackCounts[index]);
    const callback = callbacks?.at(-1);
    if (!callback) throw new Error(`Target ${index} did not remeasure after resize`);
    await act(() => callback(24, 40 + index * 80, 240, 60));
  }

  expect(queryByText(HOME_TOUR_STEPS[0].title)).toBeNull();
  await measureHost(getByTestId);
  expect(getByTestId("tour-overlay", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    true,
  );
  expect(getByTestId("tour-overlay", { includeHiddenElements: true })).toHaveProp(
    "pointerEvents",
    "none",
  );
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    false,
  );
  await measureTooltip(getByTestId, 90);
  expect(getByText(HOME_TOUR_STEPS[0].title)).toBeTruthy();
});

it.each([
  { name: "an invalid current index", currentIndex: HOME_TOUR_STEPS.length, steps: HOME_TOUR_STEPS },
  { name: "an empty step list", currentIndex: 0, steps: [] as readonly SpotlightStep[] },
])("restores the background immediately for $name", async ({ currentIndex, steps }) => {
  const { getByTestId, queryByTestId, rerender } = await render(<Harness />);
  await activateTour(getByTestId);
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    true,
  );

  mockWithTiming.mockClear();
  await rerender(<Harness currentIndex={currentIndex} steps={steps} />);

  expect(queryByTestId("tour-overlay", { includeHiddenElements: true })).toBeNull();
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "importantForAccessibility",
    "auto",
  );
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    false,
  );
  expect(mockWithTiming).not.toHaveBeenCalled();
});

it("premeasures one inaccessible tooltip instance before exposing or animating it", async () => {
  const { getAllByTestId, getByLabelText, getByTestId } = await render(<Harness />);
  await measureAllTargets(getByTestId);

  expect(getAllByTestId("tooltip-content", { includeHiddenElements: true })).toHaveLength(1);
  expect(getByTestId("tour-overlay", { includeHiddenElements: true })).toHaveProp(
    "pointerEvents",
    "none",
  );
  expect(getByTestId("tour-overlay", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    true,
  );
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    false,
  );

  await measureTooltip(getByTestId, 100);
  expect(getAllByTestId("tooltip-content", { includeHiddenElements: true })).toHaveLength(1);
  expect(getByTestId("tour-overlay")).toHaveProp("pointerEvents", "auto");
  expect(mockWithTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 200 }));
  expect(getByLabelText(
    "START HERE. Your Daily Drop is a fresh track selected for this moment. Step 1 of 3",
  )).toBeTruthy();
});

it("does not start timing before the current tooltip has a measured height", async () => {
  const { getByTestId } = await render(<Harness />);
  await measureAllTargets(getByTestId);

  expect(mockWithTiming).not.toHaveBeenCalled();
});

it("announces title, description, and progress in the initial focus label", async () => {
  const { getByLabelText, getByTestId } = await render(<Harness />);
  await activateTour(getByTestId);

  expect(getByLabelText(
    "START HERE. Your Daily Drop is a fresh track selected for this moment. Step 1 of 3",
  )).toBeTruthy();
});

it("rerenders the focus announcement in Spanish", async () => {
  const view = await render(<Harness />);
  await activateTour(view.getByTestId);

  await act(() => i18n.changeLanguage("es"));

  expect(view.getByLabelText(
    "START HERE. Your Daily Drop is a fresh track selected for this moment. Paso 1 de 3",
  )).toBeTruthy();
});

it("reports next, previous, skip, and finish without leaking host events", async () => {
  const { getByLabelText, getByTestId, getByText, queryByText, rerender } =
    await render(<Harness />);
  await activateTour(getByTestId);

  await fireEvent.press(getByLabelText("Next tour step"));
  await fireEvent.press(getByLabelText("Previous tour step"));
  await fireEvent.press(getByLabelText("Skip tour"));

  expect(mockOnNext).toHaveBeenCalledWith();
  expect(mockOnPrevious).toHaveBeenCalledWith();
  expect(mockOnSkip).toHaveBeenCalledWith();

  const lastIndex = HOME_TOUR_STEPS.length - 1;
  await rerender(<Harness currentIndex={lastIndex} />);
  expect(queryByText(HOME_TOUR_STEPS[lastIndex].title)).toBeNull();
  await measureAllTargets(getByTestId);
  await measureTooltip(getByTestId);
  expect(getByText(HOME_TOUR_STEPS[lastIndex].title)).toBeTruthy();
  await fireEvent.press(getByLabelText("Next tour step"));
  expect(mockOnFinishSpotlights).toHaveBeenCalledWith();
  expect(mockOnNext).toHaveBeenCalledTimes(1);
});

it("dismisses the non-modal overlay through the Android hardware back action", async () => {
  const remove = jest.fn();
  const addBackHandler = jest
    .spyOn(BackHandler, "addEventListener")
    .mockReturnValue({ remove });
  const { getByTestId, unmount } = await render(<Harness />);
  await activateTour(getByTestId);

  const hardwareBack = addBackHandler.mock.calls.at(-1)?.[1];
  expect(hardwareBack?.()).toBe(true);
  expect(mockOnSkip).toHaveBeenCalledWith();

  await act(() => unmount());
  expect(remove).toHaveBeenCalledWith();
});

it("hides the background reversibly and moves initial focus inside the tooltip", async () => {
  const { getByTestId, rerender } = await render(<Harness />);
  await activateTour(getByTestId);

  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "importantForAccessibility",
    "no-hide-descendants",
  );
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    true,
  );
  expect(mockSetAccessibilityFocus).toHaveBeenCalledWith(42);

  mockReducedMotion = true;
  await rerender(<Harness active={false} />);
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "importantForAccessibility",
    "auto",
  );
  expect(getByTestId("tour-background", { includeHiddenElements: true })).toHaveProp(
    "accessibilityElementsHidden",
    false,
  );
});

it("uses a high-contrast scrim and a rounded cutout with edge-correct padding", async () => {
  const { getByTestId } = await render(
    <Harness steps={[HOME_TOUR_STEPS[0]]} borderRadius={24} />,
  );
  await measureTarget(getByTestId, 0, { x: 4, y: 3, width: 50, height: 40 });
  await measureTooltip(getByTestId);

  expect(getByTestId("tour-scrim")).toHaveProp("fill", {
    payload: 0xb8000000,
    type: 0,
  });
  expect(getByTestId("tour-cutout")).toHaveProp("x", 0);
  expect(getByTestId("tour-cutout")).toHaveProp("y", 0);
  expect(getByTestId("tour-cutout")).toHaveProp("width", 62);
  expect(getByTestId("tour-cutout")).toHaveProp("height", 51);
  expect(getByTestId("tour-cutout")).toHaveProp("rx", 24);
});

it("draws a visible halo and advances when the highlighted element is pressed", async () => {
  const steps = [HOME_TOUR_STEPS[0], HOME_TOUR_STEPS[1]] as const;
  const { getByLabelText, getByTestId } = await render(
    <Harness steps={steps} />,
  );
  await measureAllTargets(getByTestId, steps);
  await measureTooltip(getByTestId);

  expect(getByTestId("tour-spotlight-halo")).toHaveStyle({
    borderWidth: 2,
    borderColor: "#bdc2ff",
  });
  const action = getByLabelText("START HERE. Next to tour step 2");
  expect(action).toHaveProp("accessibilityRole", "button");
  await fireEvent.press(action);

  expect(mockOnNext).toHaveBeenCalledWith();
});

it("pulses the spotlight halo while the tour surface is active", async () => {
  const { getByTestId } = await render(<Harness />);
  await activateTour(getByTestId);

  expect(mockWithTiming).toHaveBeenCalledWith(
    0.45,
    expect.objectContaining({ duration: 900 }),
  );
  expect(mockWithRepeat).toHaveBeenCalledWith(0.45);
});

it("converts target window coordinates into the tour host coordinate space", async () => {
  const { getByTestId } = await render(
    <Harness steps={[HOME_TOUR_STEPS[0]]} borderRadius={24} />,
  );

  await measureHost(getByTestId, { x: 12, y: 24, width: 376, height: 752 });
  await measureTarget(getByTestId, 0, { x: 36, y: 104, width: 240, height: 80 });
  await measureTooltip(getByTestId);

  expect(getByTestId("tour-cutout")).toHaveProp("x", 16);
  expect(getByTestId("tour-cutout")).toHaveProp("y", 72);
});

it("keeps a large tooltip scrollable inside safe-area placement bounds", async () => {
  mockWindowDimensions.height = 480;
  mockSafeAreaInsets.top = 44;
  mockSafeAreaInsets.bottom = 34;
  const { getByTestId } = await render(<Harness />);
  await measureAllTargets(getByTestId);
  await measureTooltip(getByTestId, 600);

  const containerStyle = getByTestId("tour-tooltip-container").props.style;
  expect(containerStyle).toEqual(expect.arrayContaining([
    expect.objectContaining({ top: 60, maxHeight: 370 }),
  ]));
  expect(getByTestId("tour-tooltip-scroll")).toBeTruthy();
});

it("keeps tooltip horizontal bounds inside left and right safe areas", async () => {
  mockSafeAreaInsets.left = 32;
  mockSafeAreaInsets.right = 24;
  const { getByTestId } = await render(<Harness />);
  await measureAllTargets(getByTestId);

  expect(
    getByTestId("tour-tooltip-container", { includeHiddenElements: true }),
  ).toHaveStyle({ left: 48, right: 40 });
});

it("animates fade and scale for 200ms on entry and exit", async () => {
  const { getByTestId, queryByTestId, rerender } = await render(<Harness />);
  await activateTour(getByTestId);
  expect(mockWithTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 200 }));
  expect(
    mockWithTiming.mock.calls.filter(([, config]) =>
      (config as { duration?: number }).duration === 200
    ),
  ).toHaveLength(2);
  expect(getByTestId("tour-tooltip-animated")).not.toHaveStyle({ opacity: 1 });

  jest.useFakeTimers();
  await rerender(<Harness active={false} />);
  expect(mockWithTiming).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 200 }));
  expect(mockWithTiming).toHaveBeenCalledWith(0.96, expect.objectContaining({ duration: 200 }));
  expect(queryByTestId("tour-overlay")).toBeTruthy();
  await act(() => jest.advanceTimersByTime(200));
  expect(queryByTestId("tour-overlay")).toBeNull();
});

it("bypasses all timing immediately under reduced motion", async () => {
  mockReducedMotion = true;
  const { getByTestId, queryByTestId, rerender } = await render(<Harness />);
  await activateTour(getByTestId);
  expect(mockWithTiming).not.toHaveBeenCalled();
  expect(getByTestId("tour-tooltip-animated")).not.toHaveStyle({ opacity: 1 });

  await rerender(<Harness active={false} />);
  expect(mockWithTiming).not.toHaveBeenCalled();
  expect(queryByTestId("tour-overlay")).toBeNull();
});

it.each([
  {
    name: "flips below near the top",
    placement: "top" as const,
    target: { x: 40, y: 20, width: 200, height: 40 },
    expectedTop: 76,
  },
  {
    name: "flips above near the bottom",
    placement: "bottom" as const,
    target: { x: 40, y: 700, width: 200, height: 60 },
    expectedTop: 584,
  },
])("$name using the measured tooltip rectangle", async ({ placement, target, expectedTop }) => {
  const steps = [{ ...HOME_TOUR_STEPS[0], placement }] satisfies readonly SpotlightStep[];
  const { getByTestId } = await render(<Harness steps={steps} />);
  await measureTarget(getByTestId, 0, target);
  await measureTooltip(getByTestId, 100);

  expect(getByTestId("tour-tooltip-container")).toHaveStyle({ top: expectedTop });
});

it("shifts the complete tooltip rectangle inside the viewport when neither side fits", async () => {
  const { getByTestId } = await render(<Harness steps={[HOME_TOUR_STEPS[0]]} />);
  await measureTarget(getByTestId, 0, { x: 40, y: 370, width: 200, height: 60 });
  await measureTooltip(getByTestId, 740);

  expect(getByTestId("tour-tooltip-container")).toHaveStyle({ top: 44 });
});

it("keeps inactive targets as ordinary layout views", async () => {
  const { getByTestId, queryByText } = await render(<Harness active={false} />);
  expect(getByTestId("target-child", { includeHiddenElements: true })).toBeTruthy();
  expect(queryByText(HOME_TOUR_STEPS[0].title)).toBeNull();
});
