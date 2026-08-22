import { render } from "@testing-library/react-native";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { ResponsiveFormShell } from "../ResponsiveFormShell";

let mockWidth = 390;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 1, fontScale: 1 }),
}));

const originalPlatform = Object.getOwnPropertyDescriptor(Platform, "OS");

function fixture() {
  return (
    <ResponsiveFormShell
      title="Create your DJ"
      steps={[
        { id: "traits", label: "Traits" },
        { id: "review", label: "Review" },
      ]}
      activeStep="traits"
      form={<Text>Editor</Text>}
      review={<Text>Review</Text>}
      footer={
        <Pressable accessibilityRole="button" accessibilityLabel="Create DJ">
          <Text>Create DJ</Text>
        </Pressable>
      }
    />
  );
}

function resolvedStyles(screen: Awaited<ReturnType<typeof render>>) {
  return {
    content: StyleSheet.flatten(
      screen.getByTestId("responsive-form-content", { includeHiddenElements: true }).props.style,
    ),
    rail: StyleSheet.flatten(
      screen.getByTestId("form-step-rail", { includeHiddenElements: true }).props.style,
    ),
    review: StyleSheet.flatten(
      screen.getByTestId("sticky-review-panel", { includeHiddenElements: true }).props.style,
    ),
  };
}

describe("ResponsiveFormShell live web viewport contract", () => {
  beforeAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  });

  afterAll(() => {
    if (originalPlatform) Object.defineProperty(Platform, "OS", originalPlatform);
  });

  it("resolves compact and desktop presentation from the live width without replacing the tree", async () => {
    mockWidth = 390;
    const screen = await render(fixture());
    const compact = resolvedStyles(screen);

    expect(compact.content.flexDirection).toBe("column");
    expect(compact.rail.display).toBe("none");
    expect(compact.review.position).toBe("relative");

    mockWidth = 1440;
    await screen.rerender(fixture());
    const desktop = resolvedStyles(screen);

    expect(desktop.content.flexDirection).toBe("row");
    expect(desktop.rail.display).toBe("flex");
    expect(desktop.review.position).toBe("sticky");
    expect(screen.getAllByRole("button", { includeHiddenElements: true })).toHaveLength(2);
  });
});
