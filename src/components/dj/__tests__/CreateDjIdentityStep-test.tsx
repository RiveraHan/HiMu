/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { CreateDjIdentityStep } from "../CreateDjIdentityStep";
import type { DjIdentityController } from "@/src/hooks/use-dj-identity-controller";

jest.mock("@/src/components/preferences/PrefSection", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return { PrefSection: ({ title, titleRef, children }: { title: string; titleRef?: React.Ref<React.ElementRef<typeof View>>; children: React.ReactNode }) => React.createElement(View, { ref: titleRef }, React.createElement(Text, null, title), children) };
});
jest.mock("@/src/components/Button", () => {
  const React = require("react"); const { Pressable, Text } = require("react-native");
  return { Button: ({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) => React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled }, disabled, onPress }, React.createElement(Text, null, label)) };
});
jest.mock("@/src/components/GlassInput", () => {
  const React = require("react"); const { TextInput } = require("react-native");
  return { GlassInput: (props: object) => React.createElement(TextInput, props) };
});

const controller: DjIdentityController = {
  candidates: [{ name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." }],
  selectedName: null, status: "ready", request: jest.fn(), select: jest.fn(), edit: jest.fn(), startCustom: jest.fn(), confirm: jest.fn(),
};

test("shows candidates before optional editing and only continues after a valid selection", async () => {
  const onContinue = jest.fn();
  const screen = await render(<CreateDjIdentityStep controller={controller} value={{ name: "", identityConcept: "", provenance: "custom", confirmed: false }} onContinue={onContinue} />);
  expect(screen.getByRole("radio", { name: /Static Bloom/ })).toBeTruthy();
  expect(screen.queryByPlaceholderText("DJ name")).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: /Static Bloom/ }));
  expect(controller.select).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Continue" }).props.accessibilityState.disabled).toBe(true);
  const selected = { ...controller, selectedName: "Static Bloom" };
  const chosen = await render(<CreateDjIdentityStep controller={selected} value={{ name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze.", provenance: "suggested", confirmed: false }} onContinue={onContinue} />);
  await fireEvent.press(chosen.getByRole("button", { name: "Continue" }));
  expect(selected.confirm).toHaveBeenCalled();
  expect(onContinue).toHaveBeenCalled();
});

test("offers retry and manual entry after a generation error", async () => {
  const screen = await render(<CreateDjIdentityStep controller={{ ...controller, candidates: [], status: "error" }} value={{ name: "", identityConcept: "", provenance: "custom", confirmed: false }} />);
  expect(screen.getByText("Suggestions are unavailable")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Try new suggestions" }));
  await fireEvent.press(screen.getByRole("button", { name: "Write my own" }));
  expect(controller.request).toHaveBeenCalled();
  expect(controller.startCustom).toHaveBeenCalled();
});

test("preserves existing custom text when editing after a remount", async () => {
  const screen = await render(<CreateDjIdentityStep controller={controller} value={{ name: "Night Cartographer", identityConcept: "A custom navigator who maps deep rhythms into patient shared journeys.", provenance: "custom", confirmed: false }} onContinue={jest.fn()} />);
  expect(screen.getByDisplayValue("Night Cartographer")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Write my own" }));
  expect(screen.getByDisplayValue("Night Cartographer")).toBeTruthy();
});

test("hides stale candidates while loading", async () => {
  const screen = await render(<CreateDjIdentityStep controller={{ ...controller, status: "loading" }} value={{ name: "", identityConcept: "", provenance: "custom", confirmed: false }} onContinue={jest.fn()} />);
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.getByText("Creating three ideas…")).toBeTruthy();
});

test("does not focus an inactive mount and focuses on later Identity entry", async () => {
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus");
  const node = jest.spyOn(require("react-native"), "findNodeHandle").mockReturnValue(1);
  const screen = await render(<CreateDjIdentityStep active={false} controller={controller} value={{ name: "", identityConcept: "", provenance: "custom", confirmed: false }} onContinue={jest.fn()} />);
  expect(focus).not.toHaveBeenCalled();
  screen.rerender(<CreateDjIdentityStep active controller={controller} value={{ name: "", identityConcept: "", provenance: "custom", confirmed: false }} onContinue={jest.fn()} />);
  await waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
  focus.mockRestore();
  node.mockRestore();
});
