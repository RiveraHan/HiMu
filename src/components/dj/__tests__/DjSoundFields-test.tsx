/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { Platform } from "react-native";

import { DjSoundFields } from "../DjSoundFields";
import { DjIntensityChoice } from "../DjIntensityChoice";
import { DjTraitsForm } from "../DjTraitsForm";
import { Segmented } from "@/src/components/preferences/Segmented";
import {
  applyExplicitIntensity,
  energyToIntensity,
  type DjSoundDraft,
} from "../create-dj-wizard-state";

jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: "en" }),
}));
jest.mock("@/src/components/preferences/PrefSection", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return {
    PrefSection: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) =>
      React.createElement(View, null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
        children,
      ),
  };
});
jest.mock("@/src/components/preferences/ProgressiveCatalogPicker", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    ProgressiveCatalogPicker: ({ title, selected, max, onChange }: {
      title: string;
      selected: string[];
      max: number;
      onChange(values: string[]): void;
    }) => React.createElement(View, null,
      React.createElement(Text, { testID: `${title}-selection` }, selected.join(", ")),
      React.createElement(Pressable, {
        accessibilityRole: "button",
        accessibilityLabel: `Add ${title}`,
        onPress: () => onChange([...selected, title]),
      }, React.createElement(Text, null, `Add ${title}`)),
      React.createElement(Text, { testID: `${title}-max` }, String(max)),
    ),
  };
});
jest.mock("@/src/components/GlassInput", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return { GlassInput: (props: object) => React.createElement(TextInput, props) };
});

function Harness() {
  const [sound, setSound] = useState<DjSoundDraft>({
    genres: ["Ambient"],
    moods: ["Focus"],
    intensity: "balanced",
    mode: "instrumental",
    vibe: "",
  });
  return <DjSoundFields {...sound} onChange={(patch) => setSound((current) => ({ ...current, ...patch }))} />;
}

describe("DjSoundFields", () => {
  it("maps historical energy to the nearest intensity band without rewriting it", () => {
    expect(energyToIntensity(1)).toBe("calm");
    expect(energyToIntensity(4)).toBe("calm");
    expect(energyToIntensity(5)).toBe("balanced");
    expect(energyToIntensity(7)).toBe("balanced");
    expect(energyToIntensity(8)).toBe("intense");
    expect(energyToIntensity(10)).toBe("intense");
    expect(applyExplicitIntensity(7, "balanced")).toBe(7);
    expect(applyExplicitIntensity(7, "calm")).toBe(3);
    expect(applyExplicitIntensity(3, "intense")).toBe(9);
  });

  it("uses capped canonical catalog fields, a sound radiogroup, and a 140-character vibe", async () => {
    const screen = await render(<Harness />);

    expect(screen.getByTestId("Genres-max")).toHaveTextContent("3");
    expect(screen.getByTestId("Moods-max")).toHaveTextContent("3");
    expect(screen.getByTestId("segmented-radiogroup").props.accessibilityRole).toBe("radiogroup");
    expect(screen.getByTestId("segmented-radiogroup").props.accessibilityLabel).toBe("Sound");
    expect(screen.getByRole("radio", { name: "VOCAL" }).props.accessibilityState.selected).toBe(false);
    expect(screen.getByPlaceholderText("e.g. late-night rooftop textures").props.maxLength).toBe(140);

    await fireEvent.press(screen.getByRole("radio", { name: "VOCAL" }));
    expect(screen.getByRole("radio", { name: "VOCAL" }).props.accessibilityState.selected).toBe(true);
  });

  it("preserves Train's numeric energy for a vibe edit and writes the exact band value after an explicit choice", async () => {
    const onChange = jest.fn();
    const screen = await render(
      <DjTraitsForm
        values={{ name: "Lumen", genres: ["Ambient"], moods: ["Focus"], energy: 7, mode: "instrumental", vibe: "" }}
        onChange={onChange}
      />,
    );

    await fireEvent.changeText(screen.getByPlaceholderText("e.g. late-night rooftop textures"), "Warm vinyl haze");
    expect(onChange).toHaveBeenLastCalledWith({ vibe: "Warm vinyl haze" });

    await fireEvent.press(screen.getByRole("radio", { name: "CALM" }));
    expect(onChange).toHaveBeenLastCalledWith({ energy: 3 });
  });

  it("uses arrow keys and one tabbable radio for intensity and segmented choices on web", async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(Platform, "OS");
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    try {
      const screen = await render(<Harness />);
      const calm = screen.getByRole("radio", { name: "CALM" });
      const balanced = screen.getByRole("radio", { name: "BALANCED" });
      const intense = screen.getByRole("radio", { name: "INTENSE" });
      expect([calm.props.tabIndex, balanced.props.tabIndex, intense.props.tabIndex]).toEqual([-1, 0, -1]);

      await fireEvent(balanced, "keyDown", { key: "ArrowRight", preventDefault: jest.fn() });
      expect(screen.getByRole("radio", { name: "INTENSE" }).props.accessibilityState.selected).toBe(true);
      expect(screen.getByRole("radio", { name: "INTENSE" }).props.tabIndex).toBe(0);
      await fireEvent(screen.getByRole("radio", { name: "INTENSE" }), "keyDown", { key: "ArrowUp", preventDefault: jest.fn() });
      expect(screen.getByRole("radio", { name: "BALANCED" }).props.accessibilityState.selected).toBe(true);

      const instrumental = screen.getByRole("radio", { name: "INSTRUMENTAL" });
      const vocal = screen.getByRole("radio", { name: "VOCAL" });
      expect([instrumental.props.tabIndex, vocal.props.tabIndex]).toEqual([0, -1]);
      await fireEvent(instrumental, "keyDown", { key: "ArrowDown", preventDefault: jest.fn() });
      expect(screen.getByRole("radio", { name: "VOCAL" }).props.accessibilityState.selected).toBe(true);
      expect(screen.getByRole("radio", { name: "VOCAL" }).props.tabIndex).toBe(0);
      await fireEvent(screen.getByRole("radio", { name: "VOCAL" }), "keyDown", { key: "ArrowLeft", preventDefault: jest.fn() });
      expect(screen.getByRole("radio", { name: "INSTRUMENTAL" }).props.accessibilityState.selected).toBe(true);
    } finally {
      if (originalPlatform) Object.defineProperty(Platform, "OS", originalPlatform);
    }
  });

  it("removes disabled intensity and segmented choices from the web tab order", async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(Platform, "OS");
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    const onIntensityChange = jest.fn();
    const onModeChange = jest.fn();

    try {
      const screen = await render(
        <>
          <DjIntensityChoice
            accessibilityLabel="Disabled intensity"
            disabled
            onChange={onIntensityChange}
            options={[
              { value: "calm", label: "CALM", description: "Low" },
              { value: "balanced", label: "BALANCED", description: "Medium" },
            ]}
            value="calm"
          />
          <Segmented
            accessibilityLabel="Disabled mode"
            disabled
            onChange={onModeChange}
            options={[
              { value: "instrumental", label: "INSTRUMENTAL" },
              { value: "vocal", label: "VOCAL" },
            ]}
            value="instrumental"
          />
        </>,
      );

      for (const radio of screen.getAllByRole("radio")) {
        expect(radio.props.tabIndex).toBe(-1);
        expect(radio.props.accessibilityState.disabled).toBe(true);
      }
      await fireEvent(screen.getByRole("radio", { name: "CALM" }), "keyDown", {
        key: "ArrowRight",
        preventDefault: jest.fn(),
      });
      expect(onIntensityChange).not.toHaveBeenCalled();
      expect(onModeChange).not.toHaveBeenCalled();
    } finally {
      if (originalPlatform) Object.defineProperty(Platform, "OS", originalPlatform);
    }
  });
});
