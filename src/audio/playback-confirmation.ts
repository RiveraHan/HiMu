type PlaybackObservation = {
  statusSequence: number;
  currentTrackId: string | null;
  isLoaded: boolean;
  playing: boolean;
};

type PendingConfirmation = {
  generation: number;
  expectedTrackId: string;
  afterStatusSequence: number;
  sawLoadingTransition: boolean;
  resolve: (confirmed: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class PlaybackConfirmation {
  private generation = 0;
  private pending: PendingConfirmation | null = null;

  constructor(private readonly timeoutMs: number) {}

  begin(expectedTrackId: string, afterStatusSequence: number): Promise<boolean> {
    this.settle(false);
    const generation = ++this.generation;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending?.generation === generation) this.settle(false);
      }, this.timeoutMs);
      this.pending = {
        generation,
        expectedTrackId,
        afterStatusSequence,
        sawLoadingTransition: false,
        resolve,
        timer,
      };
    });
  }

  observe(observation: PlaybackObservation): void {
    const pending = this.pending;
    if (
      pending === null ||
      observation.statusSequence <= pending.afterStatusSequence ||
      observation.currentTrackId !== pending.expectedTrackId
    ) return;
    if (!observation.isLoaded) {
      pending.sawLoadingTransition = true;
      return;
    }
    if (!pending.sawLoadingTransition || !observation.playing) return;
    this.settle(true);
  }

  dispose(): void {
    this.settle(false);
  }

  private settle(confirmed: boolean): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve(confirmed);
  }
}
