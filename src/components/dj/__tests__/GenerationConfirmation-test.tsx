import { fireEvent, render } from "@testing-library/react-native";

import { GenerationConfirmation } from "../GenerationConfirmation";
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
