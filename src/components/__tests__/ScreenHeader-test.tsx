import { fireEvent, render } from "@testing-library/react-native";
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
