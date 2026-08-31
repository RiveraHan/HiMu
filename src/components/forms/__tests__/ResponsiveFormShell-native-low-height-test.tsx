import { render } from "@testing-library/react-native";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { ResponsiveFormShell } from "../ResponsiveFormShell";
import { resolveResponsiveFormStyle } from "../form-layout";

let mockWidth = 1024;
let mockHeight = 599;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 1, fontScale: 1 }),
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

describe("ResponsiveFormShell native low-height contract", () => {
  beforeAll(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  });

  afterAll(() => {
    if (originalPlatform) Object.defineProperty(Platform, "OS", originalPlatform);
  });

  it("renders a 1024x599 Android form in document flow", async () => {
    mockWidth = 1024;
    mockHeight = 599;
    const screen = await render(fixture());
    const styles = resolvedStyles(screen);

    expect(styles.content.flexDirection).toBe("column");
    expect(styles.rail.display).toBe("none");
    expect(styles.review.position).toBe("relative");
    expect(styles.review.top).toBe(0);
  });

  it("retains the wide Android presentation at 1024x600", async () => {
    mockWidth = 1024;
    mockHeight = 600;
    const screen = await render(fixture());
    const styles = resolvedStyles(screen);

    expect(resolveResponsiveFormStyle(styles.content.flexDirection, mockWidth, mockHeight)).toBe("row");
    expect(resolveResponsiveFormStyle(styles.rail.display, mockWidth, mockHeight)).toBe("flex");
    expect(resolveResponsiveFormStyle(styles.review.position, mockWidth, mockHeight)).toBe("sticky");
    expect(resolveResponsiveFormStyle(styles.review.top, mockWidth, mockHeight)).toBe(24);
  });
});
