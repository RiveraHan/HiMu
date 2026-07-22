import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as RNStyleSheet } from "react-native";

import { WelcomeTour } from "../WelcomeTour";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const onContinue = jest.fn();
const onSkip = jest.fn();
const mockWithTiming = jest.fn((value: number) => value);
let mockReducedMotion = false;

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return new Proxy(actual, {
    get: (target, property) => {
      if (property === "useReducedMotion") return () => mockReducedMotion;
      if (property === "withTiming") return (value: number) => mockWithTiming(value);
      return target[property];
    },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion = false;
});

it("renders the approved two-page welcome with modal accessibility", async () => {
  const view = await render(
    <WelcomeTour page={0} onBack={jest.fn()} onContinue={onContinue} onSkip={onSkip} />,
  );

  expect(view.getByText("YOUR MUSIC, IN THE RIGHT MOMENT")).toBeTruthy();
  expect(view.getByText("Page 1 of 2")).toBeTruthy();
  expect(view.getByTestId("welcome-surface").props.accessibilityViewIsModal).toBe(true);
  expect(view.getByTestId("welcome-content").props.focusable).toBe(true);
  expect(view.getByTestId("welcome-scroll")).toBeTruthy();
  expect(RNStyleSheet.flatten(view.getByTestId("welcome-panel").props.style)).toEqual(
    expect.objectContaining({ maxWidth: 340, maxHeight: "100%", borderRadius: 24, padding: 20 }),
  );
  expect(view.getByLabelText("Skip introduction")).toBeTruthy();
  expect(view.getByLabelText("Continue introduction")).toBeTruthy();

  await fireEvent.press(view.getByLabelText("Continue introduction"));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it("retains Skip alongside Back and Show me around on the second page", async () => {
  const onBack = jest.fn();
  const view = await render(
    <WelcomeTour page={1} onBack={onBack} onContinue={onContinue} onSkip={onSkip} />,
  );

  expect(view.getByText("MEET YOUR AI DJS")).toBeTruthy();
  expect(view.getByText("Page 2 of 2")).toBeTruthy();
  await fireEvent.press(view.getByLabelText("Back to introduction page 1"));
  await fireEvent.press(view.getByLabelText("Skip introduction"));
  await fireEvent.press(view.getByLabelText("Show me around HiMu"));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it("does not schedule animated timing when reduced motion is enabled", async () => {
  mockReducedMotion = true;
  await render(
    <WelcomeTour page={0} onBack={jest.fn()} onContinue={onContinue} onSkip={onSkip} />,
  );
  expect(mockWithTiming).not.toHaveBeenCalled();
});
