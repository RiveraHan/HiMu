import { fireEvent, render } from "@testing-library/react-native";

import {
  GenerationBriefSummary,
  GenerationConfirmation,
} from "../GenerationConfirmation";
import type { ConfirmedGenerationBriefV1 } from "@/src/types/creative-generation";

const brief: ConfirmedGenerationBriefV1 = {
  version: 1,
  title: "Afterglow Letters",
  creativeDirection: "Open gently, then bloom into a wide luminous chorus.",
  mode: "vocal",
  lyricTheme: "finding courage at sunrise",
  lyrics: "[Verse]\nA spark remains\n[Chorus]\nWe rise again",
  visibility: "private",
  traitSnapshot: {
    genres: ["Pop"],
    moods: ["Energetic"],
    energy: 7,
    vibe: "warm",
    identityConcept: "A hopeful sunrise selector.",
  },
};

test("shows the exact immutable preview and generates only after a deliberate press", async () => {
  const onGenerate = jest.fn();
  const screen = await render(
    <GenerationConfirmation
      brief={brief}
      disabled={false}
      isSubmitting={false}
      onBack={jest.fn()}
      onGenerate={onGenerate}
    />,
  );

  expect(screen.getByText(brief.title)).toBeTruthy();
  expect(screen.getByText(brief.creativeDirection)).toBeTruthy();
  expect(screen.getByText(brief.lyrics!)).toBeTruthy();
  expect(onGenerate).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "Confirm and generate" }));
  expect(onGenerate).toHaveBeenCalledTimes(1);
});

test("renders a live vocal review without exposing a final action", async () => {
  const screen = await render(<GenerationBriefSummary brief={brief} />);

  expect(screen.getByTestId("generation-brief-summary")).toBeTruthy();
  expect(screen.getByText("Afterglow Letters")).toBeTruthy();
  expect(screen.getByText("finding courage at sunrise")).toBeTruthy();
  expect(screen.getByText(brief.lyrics!)).toBeTruthy();
  expect(screen.getByText("Vocal · Private")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Confirm and generate" })).toBeNull();
});

test("omits owner-private lyric content from an instrumental review", async () => {
  const instrumental: ConfirmedGenerationBriefV1 = {
    ...brief,
    mode: "instrumental",
    lyricTheme: null,
    lyrics: null,
  };
  const screen = await render(<GenerationBriefSummary brief={instrumental} />);

  expect(screen.getByText("Instrumental · Private")).toBeTruthy();
  expect(screen.queryByText("finding courage at sunrise")).toBeNull();
  expect(screen.queryByText(brief.lyrics!)).toBeNull();
});
