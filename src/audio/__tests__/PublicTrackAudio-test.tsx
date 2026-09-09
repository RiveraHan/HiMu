import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

import { PublicTrackAudio } from "../PublicTrackAudio";

const mockPlayer = {
  pause: jest.fn(),
  play: jest.fn(),
};

jest.mock("expo-audio", () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => ({ playing: false, isBuffering: false }),
}));

const track = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Public track",
  artist: "HiMu",
  albumArtUrl: null,
  audioUrl: "https://media.example/public-track.mp3",
  duration: 180,
  genre: null,
  moods: [],
} as const;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => cleanup());

test("shows a recoverable error and retries when public playback rejects asynchronously", async () => {
  let rejectPlayback!: (reason: Error) => void;
  mockPlayer.play
    .mockImplementationOnce(() => new Promise<void>((_, reject) => {
      rejectPlayback = reject;
    }) as unknown as void)
    .mockImplementationOnce(() => undefined);
  const screen = await render(<PublicTrackAudio track={track} />);

  await fireEvent.press(screen.getByLabelText("Play"));
  await act(async () => {
    rejectPlayback(new Error("media could not load"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText("This track couldn't be played.")).toBeTruthy();
  expect(screen.getByLabelText("Try playback again")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Try playback again"));
  await waitFor(() => {
    expect(screen.queryByLabelText("Try playback again")).toBeNull();
  });

  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
});

test("ignores an earlier async rejection after a newer public playback attempt", async () => {
  let rejectFirstAttempt!: (reason: Error) => void;
  mockPlayer.play
    .mockImplementationOnce(() => new Promise<void>((_, reject) => {
      rejectFirstAttempt = reject;
    }) as unknown as void)
    .mockImplementationOnce(() => undefined);
  const screen = await render(<PublicTrackAudio track={track} />);

  await fireEvent.press(screen.getByLabelText("Play"));
  await fireEvent.press(screen.getByLabelText("Play"));
  await act(async () => {
    rejectFirstAttempt(new Error("stale media failure"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText("Try playback again")).toBeNull();
});
