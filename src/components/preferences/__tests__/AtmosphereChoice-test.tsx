import { render } from "@testing-library/react-native";

import { AtmosphereChoice } from "../AtmosphereChoice";

test("uses checked accessibility state for the selected native atmosphere radio", async () => {
  const screen = await render(
    <AtmosphereChoice
      accessibilityLabel="Usual atmosphere"
      onChange={jest.fn()}
      options={[
        { value: "calm", label: "Calm", description: "Low energy" },
        { value: "balanced", label: "Balanced", description: "Moderate" },
        { value: "intense", label: "Intense", description: "High energy" },
      ]}
      value="balanced"
    />,
  );

  expect(screen.getByRole("radio", { name: "Calm" }).props.accessibilityState).toMatchObject({
    checked: false,
    disabled: false,
  });
  expect(screen.getByRole("radio", { name: "Balanced" }).props.accessibilityState).toMatchObject({
    checked: true,
    disabled: false,
  });
});
