/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useState } from "react";

import { DjIdentityDraftStep, type DjIdentityDraftValue } from "../DjIdentityDraftStep";
import { useDjIdentityDrafts } from "@/src/hooks/use-creative-draft";

const mockDraft = jest.fn();
jest.mock("@/src/hooks/use-creative-draft", () => ({ useDjIdentityDrafts: jest.fn() }));
jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: () => ({ id: "listener" }) }));
jest.mock("@/src/i18n/use-locale", () => ({ useLocale: () => ({ resolvedLanguage: "en" }) }));
jest.mock("@/src/components/GlassInput", () => { const React = require("react"); const { TextInput } = require("react-native"); return { GlassInput: (props: object) => React.createElement(TextInput, props) }; });
jest.mock("@/src/components/preferences/PrefSection", () => { const React = require("react"); const { Text, View } = require("react-native"); return { PrefSection: ({ title, children }: { title: string; children: React.ReactNode }) => React.createElement(View, null, React.createElement(Text, null, title), children) }; });
jest.mock("@/src/components/Button", () => { const React = require("react"); const { Pressable, Text } = require("react-native"); return { Button: ({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) => React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled }, disabled, onPress }, React.createElement(Text, null, label)) }; });

const traits = { genres: ["House"], moods: ["Dreamy"], energy: 6, isInstrumental: false, vibe: "Rain-lit rooftop" };
const candidates = [
  { name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." },
  { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
  { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
];

function Harness() {
  const [value, setValue] = useState<DjIdentityDraftValue>({ name: "", identityConcept: "", provenance: "custom", confirmed: false });
  return <DjIdentityDraftStep traits={traits} value={value} onChange={setValue} />;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDraft.mockResolvedValue({ version: 1, kind: "dj-identity", draft: { candidates } });
  jest.mocked(useDjIdentityDrafts).mockImplementation(() => ({ mutateAsync: mockDraft }) as never);
});

test("keeps the compatibility wrapper candidate-first", async () => {
  const screen = await render(<Harness />);
  await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(3));
  expect(screen.queryByPlaceholderText("DJ name")).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: /Velvet Index/ }));
  expect(screen.getByRole("radio", { name: /Velvet Index/ }).props.accessibilityState.selected).toBe(true);
});

test("reveals manual inputs only after Write my own", async () => {
  const screen = await render(<Harness />);
  await fireEvent.press(screen.getByRole("button", { name: "Write my own" }));
  expect(screen.getByPlaceholderText("DJ name")).toBeTruthy();
});
