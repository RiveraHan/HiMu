import { PlaybackConfirmation } from "../playback-confirmation";

describe("PlaybackConfirmation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("requires a native loading transition before confirming the matching track", async () => {
    const confirmation = new PlaybackConfirmation(1_000);
    const pending = confirmation.begin("new-track", 7);

    confirmation.observe({
      statusSequence: 7,
      currentTrackId: "new-track",
      isLoaded: true,
      playing: true,
    });
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    confirmation.observe({
      statusSequence: 8,
      currentTrackId: "new-track",
      isLoaded: true,
      playing: true,
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    confirmation.observe({
      statusSequence: 9,
      currentTrackId: "new-track",
      isLoaded: false,
      playing: false,
    });
    confirmation.observe({
      statusSequence: 10,
      currentTrackId: "new-track",
      isLoaded: true,
      playing: true,
    });
    await expect(pending).resolves.toBe(true);
  });

  it("does not confirm a subsequent status for another track", async () => {
    const confirmation = new PlaybackConfirmation(20);
    const pending = confirmation.begin("expected", 1);
    confirmation.observe({
      statusSequence: 2,
      currentTrackId: "other",
      isLoaded: true,
      playing: true,
    });
    jest.advanceTimersByTime(20);
    await expect(pending).resolves.toBe(false);
  });

  it("bounds failures and supersedes an older load generation", async () => {
    const confirmation = new PlaybackConfirmation(50);
    const first = confirmation.begin("first", 0);
    const second = confirmation.begin("second", 0);
    await expect(first).resolves.toBe(false);
    jest.advanceTimersByTime(50);
    await expect(second).resolves.toBe(false);
  });
});
