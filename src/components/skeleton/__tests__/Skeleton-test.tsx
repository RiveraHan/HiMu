import { act, render } from "@testing-library/react-native";
import { Skeleton } from "@/src/components/skeleton/Skeleton";

const mockUseReducedMotion = jest.fn<boolean, []>();
const mockWithRepeat = jest.fn((animation) => animation);
const mockWithTiming = jest.fn((value) => value);
const mockCancelAnimation = jest.fn();

jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    __esModule: true,
    ...actual,
    cancelAnimation: (...args: unknown[]) => mockCancelAnimation(...args),
    useReducedMotion: () => mockUseReducedMotion(),
    withRepeat: (...args: unknown[]) => mockWithRepeat(args[0]),
    withTiming: (...args: unknown[]) => mockWithTiming(args[0]),
  };
});

describe("Skeleton", () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(true);
    mockWithRepeat.mockClear();
    mockWithTiming.mockClear();
    mockCancelAnimation.mockClear();
  });

  it("is hidden from assistive technology and preserves geometry", async () => {
    const { getByTestId } = await render(
      <Skeleton testID="skeleton" width={120} height={24} radius={12} />,
    );
    const node = getByTestId("skeleton", { includeHiddenElements: true });

    expect(node.props.accessible).toBe(false);
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(node).toHaveStyle({ width: 120, height: 24, borderRadius: 12 });
  });

  it("does not repeat the pulse with reduced motion", async () => {
    await render(<Skeleton height={20} />);
    expect(mockWithRepeat).not.toHaveBeenCalled();
  });

  it("starts the pulse with normal motion and cancels it on unmount", async () => {
    mockUseReducedMotion.mockReturnValue(false);

    const screen = await render(<Skeleton height={20} />);

    expect(mockWithTiming).toHaveBeenCalledWith(0.72);
    expect(mockWithRepeat).toHaveBeenCalledTimes(1);

    await act(() => screen.unmount());

    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
  });
});
