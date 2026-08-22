import { fireEvent, render } from "@testing-library/react-native";

import { GenerationBriefEditor } from "../GenerationBriefEditor";
import { createBriefDraft } from "@/src/utils/generation-brief-state";

const state = createBriefDraft({
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
});

test("edits vocal fields and regenerates only the requested field", async () => {
  const onEdit = jest.fn();
  const onRegenerate = jest.fn();
  const screen = await render(
    <GenerationBriefEditor
      state={state}
      disabled={false}
      isOnline
      pendingField={null}
      errors={{}}
      onEdit={onEdit}
      onRegenerate={onRegenerate}
    />,
  );

  await fireEvent.changeText(screen.getByLabelText("Track title"), "Signals in Glass");
  expect(onEdit).toHaveBeenCalledWith("title", "Signals in Glass");
  await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));
  expect(onRegenerate).toHaveBeenCalledWith("title");

  expect(screen.getByLabelText("Lyric theme")).toBeTruthy();
  expect(screen.getByLabelText("Lyrics")).toBeTruthy();
});

test("instrumental mode hides lyric controls and offline mode disables regeneration", async () => {
  const instrumental = createBriefDraft({
    ...state.draft,
    mode: "instrumental",
    lyricTheme: null,
    lyrics: null,
  });
  const screen = await render(
    <GenerationBriefEditor
      state={instrumental}
      disabled={false}
      isOnline={false}
      pendingField={null}
      errors={{}}
      onEdit={jest.fn()}
      onRegenerate={jest.fn()}
    />,
  );

  expect(screen.queryByLabelText("Lyric theme")).toBeNull();
  expect(screen.queryByLabelText("Lyrics")).toBeNull();
  expect(screen.getByRole("button", { name: "Try another title" })).toBeDisabled();
});

test("keeps the vocal lyric editor bounded to 1000 characters", async () => {
  const onEdit = jest.fn();
  const screen = await render(
    <GenerationBriefEditor
      state={state}
      disabled={false}
      isOnline
      pendingField={null}
      errors={{}}
      onEdit={onEdit}
      onRegenerate={jest.fn()}
    />,
  );
  const lyrics = screen.getByLabelText("Lyrics");
  const boundaryValue = "x".repeat(1000);

  expect(lyrics.props.maxLength).toBe(1000);
  await fireEvent.changeText(lyrics, boundaryValue);
  expect(onEdit).toHaveBeenCalledWith("lyrics", boundaryValue);
});
