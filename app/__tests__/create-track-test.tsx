import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import CreateTrackScreen from "@/app/create-track";
import { resolveResponsiveFormStyle } from "@/src/components/forms/form-layout";
import i18n from "@/src/i18n";

const mockDraft = jest.fn();
const mockRegenerateTitle = jest.fn();
const mockRegenerateDirection = jest.fn();
const mockRegenerateLyrics = jest.fn();
const mockGenerate = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockOnline = true;
let mockActiveMix: null | { status: string } = null;
let mockInstrumental = false;
let mockEnergy = 7;
let mockUserId = "listener";
let mockDjOwnerId = "listener";
let mockSourceTrackId: string | undefined;
let mockSourceDetails: null | { trackId: string; confirmedLyrics: string; djId: string } = null;

const dj = () => ({
  id: "dj-one",
  owner_id: mockDjOwnerId,
  identity_concept: "A hopeful selector for luminous early mornings.",
  genre_specialties: ["Pop"],
  mood_tags: ["Energetic"],
  character: "warm",
  personality_traits: { energy: mockEnergy, isInstrumental: mockInstrumental },
});

jest.mock("expo-router", () => ({
  router: { back: mockBack, canGoBack: () => true, replace: mockReplace },
  useLocalSearchParams: () => ({ djId: "dj-one", sourceTrackId: mockSourceTrackId }),
}));
jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: mockUserId }),
}));
jest.mock("@/src/hooks/use-dj", () => ({
  useDJ: () => ({ data: dj(), isPending: false, isError: false }),
}));
jest.mock("@/src/hooks/use-online-status", () => ({
  useOnlineStatus: () => mockOnline,
}));
jest.mock("@/src/hooks/use-track-private-details", () => ({
  useTrackPrivateDetails: (_trackId: string | undefined, owned: boolean) => ({
    data: owned ? mockSourceDetails : null,
    isFetched: true,
  }),
}));
jest.mock("@/src/hooks/use-tab-bar-padding", () => ({
  useMiniPlayerPadding: () => 0,
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: "en" }),
}));
jest.mock("@/src/activity", () => ({
  useActivity: () => ({ activeMixForDj: () => mockActiveMix }),
}));
jest.mock("@/src/hooks/use-generate-mix", () => ({
  useGenerateMix: () => ({
    generateAsync: mockGenerate,
    isStarting: false,
    error: null,
  }),
}));
jest.mock("@/src/hooks/use-creative-draft", () => ({
  useTrackBriefDraft: () => ({ mutateAsync: mockDraft, isPending: false }),
  useRegenerateTrackField: (kind: string) => ({
    mutateAsync: kind === "track-title"
      ? mockRegenerateTitle
      : kind === "creative-direction"
        ? mockRegenerateDirection
        : mockRegenerateLyrics,
    isPending: false,
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("CreateTrackScreen", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockOnline = true;
    mockActiveMix = null;
    mockInstrumental = false;
    mockEnergy = 7;
    mockUserId = "listener";
    mockDjOwnerId = "listener";
    mockSourceTrackId = undefined;
    mockSourceDetails = null;
    mockDraft.mockReset().mockResolvedValue({
      version: 1,
      kind: "track-brief",
      draft: {
        title: "Afterglow Letters",
        creativeDirection: "Open gently, then bloom into a wide luminous chorus.",
        lyricTheme: "finding courage at sunrise",
        lyrics: "[Verse]\nA spark remains\n[Chorus]\nWe rise again",
      },
    });
    mockRegenerateTitle.mockReset().mockResolvedValue({
      version: 1,
      kind: "track-title",
      draft: { title: "Signals in Glass" },
    });
    mockRegenerateDirection.mockReset();
    mockRegenerateLyrics.mockReset();
    mockGenerate.mockReset().mockResolvedValue({ jobId: "job-one" });
    mockBack.mockReset();
    mockReplace.mockReset();
  });

  it("freezes the reviewed brief and generates only after explicit confirmation", async () => {
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    expect(mockGenerate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    expect(screen.getByText("Afterglow Letters")).toBeTruthy();
    expect(mockGenerate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Confirm and generate" }));
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({
      djId: "dj-one",
      brief: expect.objectContaining({
        version: 1,
        title: "Afterglow Letters",
        lyrics: "[Verse]\nA spark remains\n[Chorus]\nWe rise again",
      }),
      sourceTrackId: null,
    })));
  });

  it("composes one mounted editor and live review into compact and desktop layouts", async () => {
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    const content = screen.getByTestId("responsive-form-content");
    const direction = StyleSheet.flatten(content.props.style).flexDirection;
    const editor = screen.getByTestId("responsive-form-editor");
    const review = screen.getByTestId("sticky-review-panel");
    const footer = screen.getByTestId("responsive-form-footer");

    expect(resolveResponsiveFormStyle(direction, 390)).toBe("column");
    expect(resolveResponsiveFormStyle(direction, 1440)).toBe("row");
    expect(within(editor).getByLabelText("Track title")).toBeTruthy();
    expect(within(review).getByText("Afterglow Letters")).toBeTruthy();
    expect(within(review).getByText("Vocal · Private")).toBeTruthy();
    expect(within(footer).getAllByLabelText("Review generation")).toHaveLength(1);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("regenerates one field without changing the other draft fields", async () => {
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));
    await waitFor(() => expect(screen.getByDisplayValue("Signals in Glass")).toBeTruthy());
    expect(screen.getByDisplayValue("Open gently, then bloom into a wide luminous chorus.")).toBeTruthy();
    expect(mockRegenerateTitle).toHaveBeenCalledWith(expect.objectContaining({
      exclude: ["Afterglow Letters"],
    }));
  });

  it("regenerates direction without changing title or owner-private lyrics", async () => {
    mockRegenerateDirection.mockResolvedValueOnce({
      version: 1,
      kind: "creative-direction",
      draft: {
        creativeDirection: "Gather close harmonies before opening into a clear dawn refrain.",
      },
    });
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    const originalLyrics = "[Verse]\nA spark remains\n[Chorus]\nWe rise again";

    await fireEvent.press(screen.getByRole("button", { name: "Try another direction" }));

    await waitFor(() => expect(screen.getByDisplayValue(
      "Gather close harmonies before opening into a clear dawn refrain.",
    )).toBeTruthy());
    expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy();
    expect(screen.getByDisplayValue(originalLyrics)).toBeTruthy();
    expect(mockRegenerateDirection).toHaveBeenCalledWith(expect.objectContaining({
      exclude: ["Open gently, then bloom into a wide luminous chorus."],
    }));
  });

  it("regenerates lyrics without changing title or creative direction", async () => {
    mockRegenerateLyrics.mockResolvedValueOnce({
      version: 1,
      kind: "lyrics",
      draft: {
        lyricTheme: "choosing the signal that leads home",
        lyrics: "[Verse]\nThe quiet signal knows my name\n[Chorus]\nI follow light and rise again",
      },
    });
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    await fireEvent.press(screen.getByRole("button", { name: "Try other lyrics" }));

    await waitFor(() => expect(screen.getByDisplayValue(
      "[Verse]\nThe quiet signal knows my name\n[Chorus]\nI follow light and rise again",
    )).toBeTruthy());
    expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy();
    expect(screen.getByDisplayValue(
      "Open gently, then bloom into a wide luminous chorus.",
    )).toBeTruthy();
    expect(mockRegenerateLyrics).toHaveBeenCalledWith(expect.objectContaining({
      exclude: ["[Verse]\nA spark remains\n[Chorus]\nWe rise again"],
    }));
  });

  it("preserves discarded suggestions across repeated regeneration", async () => {
    mockRegenerateTitle
      .mockResolvedValueOnce({
        version: 1,
        kind: "track-title",
        draft: { title: "Signals in Glass" },
      })
      .mockResolvedValueOnce({
        version: 1,
        kind: "track-title",
        draft: { title: "Morning Frequency" },
      });
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));
    await waitFor(() => expect(screen.getByDisplayValue("Signals in Glass")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));

    await waitFor(() => expect(screen.getByDisplayValue("Morning Frequency")).toBeTruthy());
    expect(mockRegenerateTitle).toHaveBeenLastCalledWith(expect.objectContaining({
      exclude: ["Afterglow Letters", "Signals in Glass"],
    }));
  });

  it("keeps editing available offline while disabling regeneration and generation", async () => {
    mockOnline = false;
    const screen = await render(<CreateTrackScreen />);

    await waitFor(() => expect(screen.getByLabelText("Track title")).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText("Track title"), "My Offline Title");
    expect(screen.getByDisplayValue("My Offline Title")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try another title" })).toBeDisabled();
    expect(mockDraft).not.toHaveBeenCalled();
  });

  it("hides vocal fields for an instrumental DJ", async () => {
    mockInstrumental = true;
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    expect(screen.queryByLabelText("Lyric theme")).toBeNull();
    expect(screen.queryByLabelText("Lyrics")).toBeNull();
  });

  it("requires explicit final confirmation for an instrumental brief with no lyric payload", async () => {
    mockInstrumental = true;
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    expect(screen.getByText("Instrumental · Private")).toBeTruthy();
    expect(mockGenerate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Confirm and generate" }));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({
      brief: expect.objectContaining({
        mode: "instrumental",
        lyricTheme: null,
        lyrics: null,
      }),
    })));
  });

  it("accepts exactly 1000 lyric characters and rejects an over-boundary draft", async () => {
    const suffix = "\n[Chorus]\nRise";
    const exactLyrics = "[Verse]\n" + "a".repeat(
      1000 - "[Verse]\n".length - suffix.length,
    ) + suffix;
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText("Lyrics"), exactLyrics);
    expect(screen.getByRole("button", { name: "Review generation" })).toBeEnabled();
    await fireEvent.changeText(screen.getByLabelText("Lyrics"), `${exactLyrics}x`);
    expect(screen.getByRole("button", { name: "Review generation" })).toBeDisabled();
  });

  it("does not render an editor or owner-private source lyrics for a non-owner", async () => {
    mockSourceTrackId = "track-source";
    mockSourceDetails = {
      trackId: "track-source",
      confirmedLyrics: "[Verse]\nOwner secret\n[Chorus]\nNever expose this",
      djId: "dj-one",
    };
    mockUserId = "other-listener";
    const screen = await render(<CreateTrackScreen />);

    await waitFor(() => expect(
      screen.getByText("This DJ isn't available for track creation."),
    ).toBeTruthy());
    expect(screen.queryByLabelText("Lyrics")).toBeNull();
    expect(screen.queryByText(/Owner secret/)).toBeNull();
    expect(mockDraft).not.toHaveBeenCalled();
  });

  it("blocks review while this DJ already has an active generation", async () => {
    mockActiveMix = { status: "running" };
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    expect(screen.getByRole("button", { name: "Review generation" })).toBeDisabled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("falls back to fully editable custom fields when drafting fails", async () => {
    mockDraft.mockRejectedValueOnce(new Error("provider unavailable"));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByText("Couldn't prepare a draft")).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText("Track title"), "My Own Horizon");
    await fireEvent.changeText(
      screen.getByLabelText("Creative direction"),
      "Start close and quiet before opening into warm layered harmonies.",
    );
    expect(screen.getByDisplayValue("My Own Horizon")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps the confirmed preview recoverable when generation cannot start", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("network"));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirm and generate" }));

    await waitFor(() => expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeTruthy());
    expect(screen.getByRole("button", { name: "Confirm and generate" })).toBeEnabled();
  });

  it("does not let a late title suggestion overwrite a newer manual edit", async () => {
    let resolveTitle!: (value: unknown) => void;
    mockRegenerateTitle.mockReturnValueOnce(new Promise((resolve) => {
      resolveTitle = resolve;
    }));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));
    await fireEvent.changeText(screen.getByLabelText("Track title"), "My Handwritten Signal");
    await act(async () => resolveTitle({
      version: 1,
      kind: "track-title",
      draft: { title: "Late Machine Suggestion" },
    }));

    expect(screen.getByDisplayValue("My Handwritten Signal")).toBeTruthy();
    expect(screen.queryByDisplayValue("Late Machine Suggestion")).toBeNull();
  });

  it("does not let a retried initial draft overwrite custom fallback edits", async () => {
    mockDraft.mockRejectedValueOnce(new Error("provider unavailable"));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByText("Couldn't prepare a draft")).toBeTruthy());

    let resolveDraft!: (value: unknown) => void;
    mockDraft.mockReturnValueOnce(new Promise((resolve) => {
      resolveDraft = resolve;
    }));
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await fireEvent.changeText(screen.getByLabelText("Track title"), "Keep My Custom Title");
    await act(async () => resolveDraft({
      version: 1,
      kind: "track-brief",
      draft: {
        title: "Late Full Draft",
        creativeDirection: "A late response that should not replace manual ownership.",
        lyricTheme: "late response",
        lyrics: "[Verse]\nLate\n[Chorus]\nResponse",
      },
    }));

    expect(screen.getByDisplayValue("Keep My Custom Title")).toBeTruthy();
    expect(screen.queryByDisplayValue("Late Full Draft")).toBeNull();
  });

  it("marks the preparation stale when authoritative DJ traits change", async () => {
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());

    mockEnergy = 2;
    await screen.rerender(<CreateTrackScreen />);

    await waitFor(() => expect(screen.getByText("DJ traits changed")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Review generation" })).toBeDisabled();
  });

  it("pastes custom lyrics and requires a fresh preview after returning to edit", async () => {
    const customLyrics = "[Verse]\nMy own night turns gold\n[Chorus]\nI choose the morning";
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText("Lyrics"), customLyrics);
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    expect(screen.getByText(customLyrics)).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Back to editing" }));
    await fireEvent.changeText(screen.getByLabelText("Track title"), "Owned Morning Signal");
    expect(screen.queryByTestId("generation-confirmation")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    expect(screen.getByText("Owned Morning Signal")).toBeTruthy();
  });

  it("shows an inline regeneration error and permits retrying only that field", async () => {
    mockRegenerateTitle.mockRejectedValueOnce(new Error("provider"));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));
    await waitFor(() => expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeTruthy());

    await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));
    await waitFor(() => expect(screen.getByDisplayValue("Signals in Glass")).toBeTruthy());
  });

  it("disables final confirmation when connectivity or an active job changes", async () => {
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));

    mockOnline = false;
    await screen.rerender(<CreateTrackScreen />);
    expect(screen.getByRole("button", { name: "Confirm and generate" })).toBeDisabled();
    mockOnline = true;
    mockActiveMix = { status: "running" };
    await screen.rerender(<CreateTrackScreen />);
    expect(screen.getByRole("button", { name: "Confirm and generate" })).toBeDisabled();
  });

  it("exposes the preparation flow and controls in Spanish", async () => {
    await i18n.changeLanguage("es");
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByLabelText("Título de la canción")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Revisar generación" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Probar otra letra" })).toBeTruthy();
  });

  it("discards an initial vocal response when the DJ becomes instrumental in flight", async () => {
    let resolveOld!: (value: unknown) => void;
    mockDraft.mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOld = resolve;
      }))
      .mockResolvedValue({
        version: 1,
        kind: "track-brief",
        draft: {
          title: "Instrumental Horizon",
          creativeDirection: "Let percussion and glowing synths carry the arc without vocals.",
          lyricTheme: null,
          lyrics: null,
        },
      });
    const screen = await render(<CreateTrackScreen />);
    mockInstrumental = true;
    await screen.rerender(<CreateTrackScreen />);
    await act(async () => resolveOld({
      version: 1,
      kind: "track-brief",
      draft: {
        title: "Obsolete Vocal Draft",
        creativeDirection: "This response belongs to the old vocal mode and must be discarded.",
        lyricTheme: "obsolete",
        lyrics: "[Verse]\nOld\n[Chorus]\nVoice",
      },
    }));

    await waitFor(() => expect(screen.getByDisplayValue("Instrumental Horizon")).toBeTruthy());
    expect(screen.queryByDisplayValue("Obsolete Vocal Draft")).toBeNull();
    expect(screen.queryByLabelText("Lyrics")).toBeNull();
  });

  it("discards an obsolete initial fallback when that request fails after a mode change", async () => {
    let rejectOld!: (error: unknown) => void;
    mockDraft.mockReset()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectOld = reject;
      }))
      .mockResolvedValue({
        version: 1,
        kind: "track-brief",
        draft: {
          title: "Current Instrumental Draft",
          creativeDirection: "Use evolving percussion and warm synth layers without any vocal line.",
          lyricTheme: null,
          lyrics: null,
        },
      });
    const screen = await render(<CreateTrackScreen />);
    mockInstrumental = true;
    await screen.rerender(<CreateTrackScreen />);
    await act(async () => rejectOld(new Error("obsolete request failed")));

    await waitFor(() => expect(
      screen.getByDisplayValue("Current Instrumental Draft"),
    ).toBeTruthy());
    expect(screen.queryByText("Couldn't prepare a draft")).toBeNull();
    expect(screen.queryByLabelText("Lyrics")).toBeNull();
  });

  it("discards a granular response after a full trait-driven reseed", async () => {
    let resolveOldTitle!: (value: unknown) => void;
    mockRegenerateTitle.mockReturnValueOnce(new Promise((resolve) => {
      resolveOldTitle = resolve;
    }));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Try another title" }));
    mockEnergy = 2;
    await screen.rerender(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByText("DJ traits changed")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("DJ traits changed")).toBeNull());
    await act(async () => resolveOldTitle({
      version: 1,
      kind: "track-title",
      draft: { title: "Obsolete Granular Title" },
    }));

    expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy();
    expect(screen.queryByDisplayValue("Obsolete Granular Title")).toBeNull();
  });

  it("submits the frozen brief only once across rapid confirmation presses", async () => {
    let resolveGeneration!: (value: unknown) => void;
    mockGenerate.mockReturnValueOnce(new Promise((resolve) => {
      resolveGeneration = resolve;
    }));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    const confirm = screen.getByRole("button", { name: "Confirm and generate" });
    await act(async () => {
      confirm.props.onClick({ nativeEvent: {} });
      confirm.props.onClick({ nativeEvent: {} });
      await Promise.resolve();
    });

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    await act(async () => resolveGeneration({ jobId: "job-one" }));
  });

  it("disables in-app back navigation while a submit is pending", async () => {
    mockGenerate.mockReturnValueOnce(new Promise(() => undefined));
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirm and generate" }));

    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(back).toBeDisabled());
    await fireEvent.press(back);
    expect(mockBack).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it("ignores a successful submit continuation after unmount", async () => {
    let resolveGeneration!: (value: unknown) => void;
    const generation = new Promise((resolve) => {
      resolveGeneration = resolve;
    });
    mockGenerate.mockReturnValueOnce(generation);
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    const confirm = screen.getByRole("button", { name: "Confirm and generate" });
    await act(async () => {
      confirm.props.onClick({ nativeEvent: {} });
      await Promise.resolve();
    });
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1));

    await screen.unmount();
    await act(async () => {
      resolveGeneration({ jobId: "job-one" });
      await generation;
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("ignores a failed generation after the route source changes", async () => {
    let rejectGeneration!: (error: unknown) => void;
    const generation = new Promise((_resolve, reject) => {
      rejectGeneration = reject;
    });
    mockGenerate.mockReturnValueOnce(generation);
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Afterglow Letters")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    const confirm = screen.getByRole("button", { name: "Confirm and generate" });
    let submission!: Promise<void>;
    await act(async () => {
      submission = confirm.props.onClick({ nativeEvent: {} });
      await Promise.resolve();
    });
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1));

    mockSourceTrackId = "track-source-b";
    mockSourceDetails = {
      trackId: "track-source-b",
      confirmedLyrics: "[Verse]\nSource B current\n[Chorus]\nStay on B",
      djId: "dj-one",
    };
    await screen.rerender(<CreateTrackScreen />);
    await waitFor(() => expect(
      screen.getByDisplayValue(mockSourceDetails!.confirmedLyrics),
    ).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));

    await act(async () => {
      rejectGeneration(new Error("obsolete generation failed"));
      await submission;
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByText("Something went wrong. Please try again.")).toBeNull();
    expect(screen.getByText(/Source B current/)).toBeTruthy();
  });

  it("seeds a new version from owner-private lyrics and keeps the source ID out of text params", async () => {
    mockSourceTrackId = "track-source";
    mockSourceDetails = {
      trackId: "track-source",
      confirmedLyrics: "[Verse]\nOriginal private line\n[Chorus]\nPreserve my voice",
      djId: "dj-one",
    };
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(
      screen.getByDisplayValue(mockSourceDetails!.confirmedLyrics),
    ).toBeTruthy());

    expect(mockDraft).toHaveBeenCalledWith(expect.objectContaining({
      djId: "dj-one",
      current: expect.objectContaining({ lyrics: mockSourceDetails.confirmedLyrics }),
    }));
    await fireEvent.press(screen.getByRole("button", { name: "Review generation" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirm and generate" }));
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({
      sourceTrackId: "track-source",
      brief: expect.objectContaining({ lyrics: mockSourceDetails!.confirmedLyrics }),
    })));
  });

  it("replaces private seed state when the route source record changes", async () => {
    mockSourceTrackId = "track-source-a";
    mockSourceDetails = {
      trackId: "track-source-a",
      confirmedLyrics: "[Verse]\nSource A private\n[Chorus]\nKeep A separate",
      djId: "dj-one",
    };
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(
      screen.getByDisplayValue(mockSourceDetails!.confirmedLyrics),
    ).toBeTruthy());

    const oldLyrics = mockSourceDetails.confirmedLyrics;
    mockSourceTrackId = "track-source-b";
    mockSourceDetails = {
      trackId: "track-source-b",
      confirmedLyrics: "[Verse]\nSource B private\n[Chorus]\nKeep B separate",
      djId: "dj-one",
    };
    await screen.rerender(<CreateTrackScreen />);

    await waitFor(() => expect(
      screen.getByDisplayValue(mockSourceDetails!.confirmedLyrics),
    ).toBeTruthy());
    expect(screen.queryByDisplayValue(oldLyrics)).toBeNull();
  });

  it("starts the new source preparation without waiting for the old source request", async () => {
    let resolveOld!: (value: unknown) => void;
    mockDraft.mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOld = resolve;
      }))
      .mockResolvedValue({
        version: 1,
        kind: "track-brief",
        draft: {
          title: "Source B Draft",
          creativeDirection: "Build a fresh version around the newly selected private lyric source.",
          lyricTheme: "new source",
          lyrics: "provider text must not replace private seed",
        },
      });
    mockSourceTrackId = "track-source-a";
    mockSourceDetails = {
      trackId: "track-source-a",
      confirmedLyrics: "[Verse]\nSource A pending\n[Chorus]\nNever leak",
      djId: "dj-one",
    };
    const screen = await render(<CreateTrackScreen />);
    await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(1));

    const oldLyrics = mockSourceDetails.confirmedLyrics;
    mockSourceTrackId = "track-source-b";
    mockSourceDetails = {
      trackId: "track-source-b",
      confirmedLyrics: "[Verse]\nSource B current\n[Chorus]\nOnly B",
      djId: "dj-one",
    };
    await screen.rerender(<CreateTrackScreen />);
    expect(screen.queryByDisplayValue(oldLyrics)).toBeNull();
    await waitFor(() => expect(mockDraft).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(
      screen.getByDisplayValue(mockSourceDetails!.confirmedLyrics),
    ).toBeTruthy());

    await act(async () => resolveOld({
      version: 1,
      kind: "track-brief",
      draft: {
        title: "Obsolete Source A Draft",
        creativeDirection: "This old request must be ignored after the route source changes.",
        lyricTheme: "old source",
        lyrics: oldLyrics,
      },
    }));
    expect(screen.getByDisplayValue(mockSourceDetails.confirmedLyrics)).toBeTruthy();
    expect(screen.queryByDisplayValue(oldLyrics)).toBeNull();
  });
});
