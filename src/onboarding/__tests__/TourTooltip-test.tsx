import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, StyleSheet as RNStyleSheet } from "react-native";

import i18n from "@/src/i18n";
import { TourCompletionSheet } from "../TourCompletionSheet";
import { TourTooltip } from "../TourTooltip";
import type { SpotlightStep } from "../types";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const STEP: SpotlightStep = {
  id: "home.djs",
  targetId: "home.djs",
  title: "DIFFERENT MINDS, DIFFERENT SOUNDS",
  description: "Each AI DJ has a distinct sound and personality.",
  placement: "top",
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
  jest.clearAllMocks();
});

it("exposes tooltip progress and 44-point named controls", async () => {
  const view = await render(
    <TourTooltip
      step={STEP}
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

it("localizes tooltip controls, completion copy, and announcements in Spanish", async () => {
  await i18n.changeLanguage("es");
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
  const tooltip = await render(
    <TourTooltip
      step={STEP}
      currentIndex={1}
      total={3}
      onNext={jest.fn()}
      onPrevious={jest.fn()}
      onSkip={jest.fn()}
    />,
  );

  expect(tooltip.getByText("Paso 2 de 3")).toBeTruthy();
  expect(tooltip.getByText("Atrás")).toBeTruthy();
  expect(tooltip.getByText("Omitir")).toBeTruthy();
  expect(tooltip.getByText("Siguiente")).toBeTruthy();
  expect(tooltip.getByLabelText("Progreso del tour, paso 2 de 3")).toBeTruthy();

  const completion = await render(
    <TourCompletionSheet canPlay={false} onComplete={jest.fn(async () => undefined)} />,
  );
  expect(completion.getByText("TOUR COMPLETADO")).toBeTruthy();
  expect(completion.getByText("YA ESTÁS LISTO")).toBeTruthy();
  expect(announce).toHaveBeenCalledWith("Ya estás listo. Tour guiado completado.");
});
