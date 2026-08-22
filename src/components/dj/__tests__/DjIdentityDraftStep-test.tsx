/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import {
  DjIdentityDraftStep,
  type DjIdentityDraftValue,
} from "../DjIdentityDraftStep";
import { useDjIdentityDrafts } from "@/src/hooks/use-creative-draft";

const mockDraft = jest.fn();
let mockDraftError: Error | null = null;

jest.mock("@/src/hooks/use-creative-draft", () => ({
  useDjIdentityDrafts: jest.fn(),
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: "en" }),
}));
jest.mock("@/src/components/GlassInput", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  return { GlassInput: (props: object) => React.createElement(TextInput, props) };
});
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
jest.mock("@/src/components/Button", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress?: () => void }) =>
      React.createElement(Pressable, {
        accessibilityRole: "button",
        accessibilityLabel: label,
        accessibilityState: { disabled },
        disabled,
        onPress,
      }, React.createElement(Text, null, label)),
  };
});

const traits = {
  genres: ["House"],
  moods: ["Dreamy"],
  energy: 6,
  isInstrumental: false,
  vibe: "Rain-lit rooftop",
};

const candidates = [
  { name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." },
  { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
  { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
];

function Harness({ initial }: { initial?: DjIdentityDraftValue }) {
  const [value, setValue] = useState<DjIdentityDraftValue>(
    initial ?? { name: "", identityConcept: "", provenance: "custom", confirmed: false },
  );
  return (
    <DjIdentityDraftStep
      traits={traits}
      value={value}
      onChange={setValue}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDraftError = null;
  mockDraft.mockResolvedValue({
    version: 1,
    kind: "dj-identity",
    draft: { candidates },
  });
  jest.mocked(useDjIdentityDrafts).mockImplementation(
    () => ({ mutateAsync: mockDraft, isPending: false, error: mockDraftError }) as never,
  );
});

test("automatically renders exactly three distinct drafts and exposes selection state", async () => {
  const screen = await render(<Harness />);

  await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(3));
  expect(screen.getByText("Static Bloom")).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: /Velvet Index/ }));
  expect(screen.getByRole("radio", { name: /Velvet Index/ }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByDisplayValue("Velvet Index")).toBeTruthy();
});

test("editing a selected draft requires an explicit confirmation", async () => {
  const screen = await render(<Harness />);
  await waitFor(() => screen.getByText("Static Bloom"));
  await fireEvent.press(screen.getByRole("radio", { name: /Static Bloom/ }));
  await fireEvent.changeText(screen.getByDisplayValue("Static Bloom"), "Static Garden");

  expect(screen.getByText("Edited draft")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Confirm this identity" }));
  expect(screen.getByText("Identity confirmed")).toBeTruthy();
});

test("custom entry and regeneration remain available after a drafting failure", async () => {
  mockDraft.mockRejectedValueOnce(new Error("unavailable"));
  mockDraftError = new Error("unavailable");
  const screen = await render(<Harness />);

  await waitFor(() => expect(screen.getByText("Suggestions are unavailable")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Write my own" }));
  await fireEvent.changeText(screen.getByPlaceholderText("DJ name"), "Night Cartographer");
  await fireEvent.changeText(
    screen.getByPlaceholderText("Describe your DJ's identity"),
    "A custom navigator who maps deep rhythms into patient shared journeys.",
  );
  expect(screen.getByDisplayValue("Night Cartographer")).toBeTruthy();

  mockDraft.mockResolvedValueOnce({ version: 1, kind: "dj-identity", draft: { candidates } });
  await fireEvent.press(screen.getByRole("button", { name: "Try new suggestions" }));
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(2));
});

test("trait changes mark a confirmed identity stale without erasing its text", async () => {
  function TraitHarness() {
    const [value, setValue] = useState<DjIdentityDraftValue>({
      name: "Static Bloom",
      identityConcept: candidates[0].identityConcept,
      provenance: "edited",
      confirmed: true,
    });
    const [energy, setEnergy] = useState(6);
    return (
      <>
        <DjIdentityDraftStep
          traits={{ ...traits, energy }}
          value={value}
          onChange={setValue}
        />
        <Pressable testID="change-traits" onPress={() => setEnergy(7)}>
          <Text>Change traits</Text>
        </Pressable>
      </>
    );
  }
  const screen = await render(<TraitHarness />);
  await waitFor(() => expect(screen.getByTestId("change-traits")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("change-traits"));

  await waitFor(() => expect(screen.getByText("Review after trait changes")).toBeTruthy());
  expect(screen.getByDisplayValue("Static Bloom")).toBeTruthy();
  expect(screen.queryByText("Identity confirmed")).toBeNull();
});

test("ignores identity candidates that resolve after a newer trait request", async () => {
  let resolveFirst!: (value: unknown) => void;
  let resolveSecond!: (value: unknown) => void;
  mockDraft
    .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

  function RaceHarness() {
    const [value, setValue] = useState<DjIdentityDraftValue>({
      name: "",
      identityConcept: "",
      provenance: "custom",
      confirmed: false,
    });
    const [energy, setEnergy] = useState(6);
    return (
      <>
        <DjIdentityDraftStep
          traits={{ ...traits, energy }}
          value={value}
          onChange={setValue}
        />
        <Pressable testID="change-traits" onPress={() => setEnergy(7)}>
          <Text>Change traits</Text>
        </Pressable>
      </>
    );
  }

  const newerCandidates = candidates.map((candidate) => ({
    ...candidate,
    name: `New ${candidate.name}`,
  }));
  const screen = await render(<RaceHarness />);
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByTestId("change-traits"));
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(2));

  await act(async () => {
    resolveSecond({
      version: 1,
      kind: "dj-identity",
      draft: { candidates: newerCandidates },
    });
  });
  await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(3));
  expect(screen.getByText("New Static Bloom")).toBeTruthy();

  await act(async () => {
    resolveFirst({
      version: 1,
      kind: "dj-identity",
      draft: { candidates },
    });
  });
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(screen.getByText("New Static Bloom")).toBeTruthy();
  expect(screen.queryByText("Static Bloom")).toBeNull();
});

test("keeps the latest candidates when same-trait requests resolve out of order", async () => {
  let resolveFirst!: (value: unknown) => void;
  let resolveSecond!: (value: unknown) => void;
  mockDraft
    .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
  const latestCandidates = candidates.map((candidate) => ({
    ...candidate,
    name: `Latest ${candidate.name}`,
  }));
  const screen = await render(<Harness />);
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByRole("button", { name: "Try new suggestions" }));
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(2));

  await act(async () => {
    resolveSecond({
      version: 1,
      kind: "dj-identity",
      draft: { candidates: latestCandidates },
    });
  });
  await waitFor(() => expect(screen.getByText("Latest Static Bloom")).toBeTruthy());

  await act(async () => {
    resolveFirst({
      version: 1,
      kind: "dj-identity",
      draft: { candidates },
    });
  });
  expect(screen.getByText("Latest Static Bloom")).toBeTruthy();
  expect(screen.queryByText("Static Bloom")).toBeNull();
});

test("keeps the newest A candidates across an A to B to A request cycle", async () => {
  const resolvers: ((value: unknown) => void)[] = [];
  mockDraft.mockImplementation(
    () => new Promise((resolve) => resolvers.push(resolve)),
  );

  function CycleHarness() {
    const [value, setValue] = useState<DjIdentityDraftValue>({
      name: "",
      identityConcept: "",
      provenance: "custom",
      confirmed: false,
    });
    const [energy, setEnergy] = useState(6);
    return (
      <>
        <DjIdentityDraftStep
          traits={{ ...traits, energy }}
          value={value}
          onChange={setValue}
        />
        <Pressable testID="traits-b" onPress={() => setEnergy(7)}>
          <Text>Traits B</Text>
        </Pressable>
        <Pressable testID="traits-a" onPress={() => setEnergy(6)}>
          <Text>Traits A</Text>
        </Pressable>
      </>
    );
  }

  const currentCandidates = candidates.map((candidate) => ({
    ...candidate,
    name: `Current ${candidate.name}`,
  }));
  const screen = await render(<CycleHarness />);
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByTestId("traits-b"));
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(2));
  await fireEvent.press(screen.getByTestId("traits-a"));
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(3));

  await act(async () => {
    resolvers[2]({
      version: 1,
      kind: "dj-identity",
      draft: { candidates: currentCandidates },
    });
  });
  await waitFor(() => expect(screen.getByText("Current Static Bloom")).toBeTruthy());
  await act(async () => {
    resolvers[1]({ version: 1, kind: "dj-identity", draft: { candidates } });
    resolvers[0]({ version: 1, kind: "dj-identity", draft: { candidates } });
  });

  expect(screen.getByText("Current Static Bloom")).toBeTruthy();
  expect(screen.queryByText("Static Bloom")).toBeNull();
});

test("does not commit a late candidate response after traits become invalid", async () => {
  let resolveDraft!: (value: unknown) => void;
  mockDraft.mockImplementationOnce(
    () => new Promise((resolve) => (resolveDraft = resolve)),
  );

  function InvalidHarness() {
    const [value, setValue] = useState<DjIdentityDraftValue>({
      name: "",
      identityConcept: "",
      provenance: "custom",
      confirmed: false,
    });
    const [moods, setMoods] = useState(traits.moods);
    return (
      <>
        <DjIdentityDraftStep
          traits={{ ...traits, moods }}
          value={value}
          onChange={setValue}
        />
        <Pressable testID="invalidate-traits" onPress={() => setMoods([])}>
          <Text>Invalidate traits</Text>
        </Pressable>
      </>
    );
  }

  const screen = await render(<InvalidHarness />);
  await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByTestId("invalidate-traits"));
  await act(async () => {
    resolveDraft({ version: 1, kind: "dj-identity", draft: { candidates } });
  });

  expect(screen.queryAllByRole("radio")).toHaveLength(0);
});
