import type { MusicPreferences } from "@/src/types/music-preferences";
import type { QueryClient } from "@tanstack/react-query";

export type PreferencePatch = (
  current: MusicPreferences,
) => MusicPreferences;

type PendingPatch = {
  id: number;
  apply: PreferencePatch;
};

type PreferenceCommitQueueOptions = {
  baseline: MusicPreferences;
  writeOptimistic: (next: MusicPreferences) => void;
  persist: (snapshot: MusicPreferences) => Promise<void>;
  cancel: () => Promise<unknown> | void;
  invalidate: () => Promise<unknown> | void;
  onFailure: (error: unknown) => void;
};

const runtimeQueues = new WeakMap<
  QueryClient,
  Map<string | null, PreferenceCommitQueue>
>();

export function getOrCreatePreferenceCommitQueue(
  queryClient: QueryClient,
  userId: string | null,
  options: PreferenceCommitQueueOptions,
): PreferenceCommitQueue {
  let queues = runtimeQueues.get(queryClient);
  if (!queues) {
    queues = new Map();
    runtimeQueues.set(queryClient, queues);
  }

  const existing = queues.get(userId);
  if (existing) {
    existing.refreshOptions(options);
    return existing;
  }

  const queue = new PreferenceCommitQueue(options);
  queues.set(userId, queue);
  return queue;
}

export function disposePreferenceCommitQueues(queryClient: QueryClient): void {
  const queues = runtimeQueues.get(queryClient);
  if (!queues) return;

  runtimeQueues.delete(queryClient);
  for (const queue of queues.values()) queue.dispose();
}

function replay(
  baseline: MusicPreferences,
  pending: readonly PendingPatch[],
): MusicPreferences {
  return pending.reduce(
    (current, patch) => patch.apply(current),
    baseline,
  );
}
export class PreferenceCommitQueue {
  private confirmedBaseline: MusicPreferences;
  private readonly pending: PendingPatch[] = [];
  private options: PreferenceCommitQueueOptions;
  private nextId = 0;
  private generation = 0;
  private drainPromise: Promise<void> | null = null;

  constructor(options: PreferenceCommitQueueOptions) {
    this.options = options;
    this.confirmedBaseline = options.baseline;
  }

  refreshOptions(options: PreferenceCommitQueueOptions): void {
    this.options = options;
  }

  syncBaseline(next: MusicPreferences): void {
    if (this.pending.length === 0 && this.drainPromise === null) {
      this.confirmedBaseline = next;
    }
  }

  commit(apply: PreferencePatch): void {
    const wasIdle = this.pending.length === 0;
    const shouldStartDrain = this.drainPromise === null;
    if (wasIdle) void this.options.cancel();

    this.pending.push({ id: ++this.nextId, apply });
    this.options.writeOptimistic(
      replay(this.confirmedBaseline, this.pending),
    );

    if (shouldStartDrain) {
      const generation = this.generation;
      const draining = this.drain(generation);
      this.drainPromise = draining;
      void draining.finally(() => {
        if (this.drainPromise === draining) this.drainPromise = null;
      });
    }
  }

  whenIdle(): Promise<void> {
    return this.drainPromise ?? Promise.resolve();
  }

  dispose(): void {
    this.generation += 1;
    this.pending.splice(0);
  }

  private async drain(generation: number): Promise<void> {
    while (this.generation === generation) {
      while (this.pending.length > 0 && this.generation === generation) {
        const head = this.pending[0];
        const snapshot = head.apply(this.confirmedBaseline);

        try {
          await this.options.persist(snapshot);
        } catch (error) {
          if (this.generation !== generation) return;
          if (this.pending[0]?.id === head.id) this.pending.shift();
          this.options.writeOptimistic(
            replay(this.confirmedBaseline, this.pending),
          );
          this.options.onFailure(error);
          continue;
        }

        if (this.generation !== generation) return;
        if (this.pending[0]?.id !== head.id) continue;
        this.confirmedBaseline = snapshot;
        this.pending.shift();
        this.options.writeOptimistic(
          replay(this.confirmedBaseline, this.pending),
        );
      }

      if (this.generation !== generation) return;
      await this.options.invalidate();
      if (this.generation !== generation || this.pending.length === 0) return;
    }
  }
}
