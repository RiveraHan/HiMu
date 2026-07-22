import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet as RNStyleSheet } from "react-native";

import { HOME_TOUR_STEPS } from "../constants";
import { TourCompletionSheet } from "../TourCompletionSheet";
import { TourTooltip } from "../TourTooltip";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

it("exposes tooltip progress and 44-point named controls", async () => {
  const view = await render(
    <TourTooltip
      step={HOME_TOUR_STEPS[1]}
      currentIndex={1}
      total={3}
      onNext={jest.fn()}
      onPrevious={jest.fn()}
      onSkip={jest.fn()}
    />,
  );

  expect(view.getByText("Step 2 of 3")).toBeTruthy();
  expect(view.getByTestId("tour-tooltip").props.accessibilityViewIsModal).toBe(true);
  for (const label of ["Back to tour step 1", "Next to tour step 3", "Skip tour"]) {
    const control = view.getByLabelText(label);
    expect(RNStyleSheet.flatten(control.props.style)).toEqual(expect.objectContaining({ minHeight: 44 }));
  }
});

it("completion blocks double taps and completes when playback throws", async () => {
  let resolveCompletion!: () => void;
  const complete = jest.fn(() => new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  }));
  const view = await render(
    <TourCompletionSheet canPlay onComplete={complete} />,
  );

  const action = view.getByLabelText("Play today’s drop");
  await fireEvent.press(action);
  await fireEvent.press(action);
  expect(complete).toHaveBeenCalledTimes(1);
  resolveCompletion();
  await waitFor(() => expect(action.props.accessibilityState.busy).toBe(false));
});

it("uses Finish when Home has no playable candidate", async () => {
  const view = await render(
    <TourCompletionSheet canPlay={false} onComplete={jest.fn(async () => undefined)} />,
  );
  expect(view.getByLabelText("Finish")).toBeTruthy();
  expect(view.getByTestId("completion-scroll")).toBeTruthy();
  expect(RNStyleSheet.flatten(view.getByTestId("completion-panel").props.style)).toEqual(
    expect.objectContaining({ maxWidth: 340, maxHeight: "100%", borderRadius: 24, padding: 20 }),
  );
});
