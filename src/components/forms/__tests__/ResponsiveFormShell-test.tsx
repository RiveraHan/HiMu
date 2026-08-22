import { render } from "@testing-library/react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { FormStepRail } from "../FormStepRail";
import { ResponsiveFormShell } from "../ResponsiveFormShell";
import { StickyReviewPanel } from "../StickyReviewPanel";
import { breakpoints } from "@/src/theme/breakpoints";

const steps = [
  { id: "traits", label: "Traits" },
  { id: "identity", label: "Identity" },
  { id: "review", label: "Review" },
];

function FormShellFixture() {
  return (
    <ResponsiveFormShell
      title="Create your DJ"
      description="Shape their sound before you publish."
      steps={steps}
      activeStep="identity"
      form={
        <Pressable accessibilityRole="button" accessibilityLabel="Edit identity">
          <Text>Edit identity</Text>
        </Pressable>
      }
      review={
        <Pressable accessibilityRole="button" accessibilityLabel="Review DJ">
          <Text>Review DJ</Text>
        </Pressable>
      }
      footer={
        <Pressable accessibilityRole="button" accessibilityLabel="Create DJ">
          <Text>Create DJ</Text>
        </Pressable>
      }
    />
  );
}

function atWidth<T>(
  values: Partial<Record<keyof typeof breakpoints, T>>,
  width: number,
  fallback: T,
) {
  return (Object.entries(breakpoints) as [keyof typeof breakpoints, number][])
    .filter(([, breakpoint]) => breakpoint <= width)
    .reduce<T>((current, [breakpoint]) => values[breakpoint] ?? current, fallback);
}

describe("ResponsiveFormShell", () => {
  it("keeps the compact form, review, and footer in source order", async () => {
    const screen = await render(<FormShellFixture />);
    const layout = screen.getByTestId("responsive-form-content");

    expect(layout.children).toEqual([
      screen.getByTestId("form-step-rail"),
      screen.getByTestId("responsive-form-editor"),
      screen.getByTestId("sticky-review-panel"),
    ]);
    expect(screen.getByTestId("responsive-form-shell").children.at(-1)).toBe(
      screen.getByTestId("responsive-form-footer"),
    );
    expect(screen.getByTestId("responsive-form-editor").children).toEqual([
      screen.getByRole("button", { name: "Edit identity" }),
    ]);
    expect(screen.getByTestId("sticky-review-panel").children).toEqual([
      screen.getByRole("button", { name: "Review DJ" }),
    ]);
    expect(screen.getByTestId("responsive-form-footer").children).toEqual([
      screen.getByRole("button", { name: "Create DJ" }),
    ]);
    expect(screen.getAllByRole("button").map((button) => button.props.accessibilityLabel))
      .toEqual(["Back", "Edit identity", "Review DJ", "Create DJ"]);
  });

  it("uses one responsive desktop rail, editor, and review tree", async () => {
    const screen = await render(<FormShellFixture />);
    const contentStyle = StyleSheet.flatten(
      screen.getByTestId("responsive-form-content").props.style,
    );

    expect(contentStyle).toEqual(
      expect.objectContaining({
        flexDirection: { xs: "column", xl: "row" },
        alignItems: { xs: "stretch", xl: "flex-start" },
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("form-step-rail").props.style)).toEqual(
      expect.objectContaining({
        display: { xs: "none", xl: "flex" },
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("responsive-form-editor").props.style)).toEqual(
      expect.objectContaining({ flex: { xs: 0, xl: 1 }, minWidth: 0 }),
    );
  });

  it("marks the active step without turning layout navigation into a controller", async () => {
    const screen = await render(
      <FormStepRail steps={steps} activeStep="identity" />,
    );

    expect(screen.getByTestId("form-step-rail").children).toHaveLength(3);
    expect(screen.getByText("Identity").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText("Traits").props.accessibilityState).toEqual({ selected: false });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("makes the review panel sticky only at the desktop breakpoint", async () => {
    const screen = await render(
      <StickyReviewPanel>
        <Text>Review</Text>
      </StickyReviewPanel>,
    );

    expect(StyleSheet.flatten(screen.getByTestId("sticky-review-panel").props.style)).toEqual(
      expect.objectContaining({
        position: { xs: "relative", xl: "sticky" },
        top: { xs: 0, xl: 24 },
      }),
    );
  });

  it.each([
    [390, "column", "none", "relative"],
    [768, "column", "none", "relative"],
    [1024, "row", "flex", "sticky"],
    [1440, "row", "flex", "sticky"],
  ] as const)(
    "maps %ipx to the expected form regions without removing the footer",
    async (width, direction, railDisplay, reviewPosition) => {
      const screen = await render(<FormShellFixture />);
      const contentStyle = StyleSheet.flatten(
        screen.getByTestId("responsive-form-content").props.style,
      );
      const railStyle = StyleSheet.flatten(
        screen.getByTestId("form-step-rail").props.style,
      );
      const reviewStyle = StyleSheet.flatten(
        screen.getByTestId("sticky-review-panel").props.style,
      );
      const footerStyle = StyleSheet.flatten(
        screen.getByTestId("responsive-form-footer").props.style,
      );

      expect(atWidth(contentStyle.flexDirection, width, "column")).toBe(direction);
      expect(atWidth(railStyle.display, width, "none")).toBe(railDisplay);
      expect(atWidth(reviewStyle.position, width, "relative")).toBe(reviewPosition);
      expect(footerStyle).not.toEqual(
        expect.objectContaining({ position: "fixed" }),
      );
      expect(footerStyle).toEqual(
        expect.objectContaining({ width: "100%", minWidth: 0 }),
      );
    },
  );

  it("keeps effective 200 percent zoom linear so the final action stays reachable", async () => {
    const screen = await render(<FormShellFixture />);
    const contentStyle = StyleSheet.flatten(
      screen.getByTestId("responsive-form-content").props.style,
    );

    expect(atWidth(contentStyle.flexDirection, 720, "column")).toBe("column");
    expect(StyleSheet.flatten(screen.getByTestId("responsive-form-footer").props.style))
      .not.toEqual(expect.objectContaining({ position: "fixed" }));
  });
});
