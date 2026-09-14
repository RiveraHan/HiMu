import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Button } from "@/src/components/Button";
import { ScreenHeader } from "@/src/components/ScreenHeader";

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock("expo-router", () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => mockCanGoBack,
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = true;
});

test("uses router history when the shared Back action can go back", async () => {
  const screen = await render(<ScreenHeader title="Details" />);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));

  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

test("replaces a safe fallback when a deep link has no history", async () => {
  mockCanGoBack = false;
  const screen = await render(
    <ScreenHeader variant="close" title="Details" fallbackHref="/dj/dj-one" />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));

  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith("/dj/dj-one");
});

test("keeps a custom left action authoritative", async () => {
  mockCanGoBack = false;
  const onLeftPress = jest.fn();
  const screen = await render(
    <ScreenHeader title="Details" onLeftPress={onLeftPress} fallbackHref="/favorites" />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));

  expect(onLeftPress).toHaveBeenCalledTimes(1);
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("keeps navigation, wrapped copy, and actions in reachable source order", async () => {
  const screen = await render(
    <ScreenHeader
      kicker="Now playing"
      title="A deliberately long title that must wrap at enlarged text"
      subtitle="A subtitle that remains readable without competing with the action."
      actions={<Button label="Save changes" onPress={jest.fn()} />}
    />,
  );

  expect(screen.getByTestId("screen-header").children).toEqual([
    screen.getByTestId("screen-header-leading"),
    screen.getByTestId("screen-header-copy"),
    screen.getByTestId("screen-header-actions"),
  ]);
  expect(screen.getAllByRole("button").map((button) => button.props.accessibilityLabel))
    .toEqual(["Back", "Save changes"]);
  expect(StyleSheet.flatten(screen.getByTestId("screen-header-copy").props.style))
    .toEqual(expect.objectContaining({ minWidth: 0, maxWidth: "100%" }));
  expect(StyleSheet.flatten(screen.getByTestId("screen-header-actions").props.style))
    .toEqual(expect.objectContaining({ flexWrap: "wrap", maxWidth: "100%" }));
});
