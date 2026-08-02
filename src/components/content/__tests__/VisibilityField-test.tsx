import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import {
  DEFAULT_VISIBILITY,
  VisibilityField,
} from "../VisibilityField";

describe("VisibilityField", () => {
  it("starts with Private selected and explains its visibility", async () => {
    const screen = await render(
      <VisibilityField value={DEFAULT_VISIBILITY} onChange={jest.fn()} />,
    );

    expect(screen.getByText("Visibility")).toBeTruthy();
    expect(screen.getByText("Only you can see this DJ.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "PRIVATE" }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: true }));
    expect(
      screen.getByRole("button", { name: "PUBLIC" }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: false }));
  });

  it("selects Public through the supplied callback", async () => {
    const onChange = jest.fn();
    const screen = await render(
      <VisibilityField value="private" onChange={onChange} />,
    );

    await fireEvent.press(screen.getByRole("button", { name: "PUBLIC" }));

    expect(onChange).toHaveBeenCalledWith("public");
  });

  it("keeps both 44-point targets disabled when the form is pending", async () => {
    const onChange = jest.fn();
    const screen = await render(
      <VisibilityField value="public" onChange={onChange} disabled />,
    );

    for (const label of ["PRIVATE", "PUBLIC"]) {
      const target = screen.getByRole("button", { name: label });
      expect(target.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true }),
      );
      expect(StyleSheet.flatten(target.props.style)).toEqual(
        expect.objectContaining({ minHeight: 44 }),
      );
      await fireEvent.press(target);
    }

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Anyone can discover this DJ.")).toBeTruthy();
  });
});
