import { create } from "zustand";
import { buildShuffleOrder } from "@/src/utils/build-shuffle-order";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  album_art_url: string | null;
  duration: number | null;
  genre?: string | null;
};

type State = {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  index: number; // Position queue
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  shuffle: boolean;
  shuffleOrder: number[]; // Permutation of queue indices when shuffle is enabled
  repeatMode: "off" | "all" | "one";

  setNowPlaying: (
    track: PlayerTrack,
    queue: PlayerTrack[],
    index: number,
  ) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setProgress: (positionSec: number, durationSec: number) => void;
  setIndex: (index: number) => void;
  reset: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

export const usePlayerStore = create<State>((set) => ({
  currentTrack: null,
  queue: [],
  index: -1,
  isPlaying: false,
  positionSec: 0,
  durationSec: 0,
  shuffle: false,
  shuffleOrder: [],
  repeatMode: "off",

  setNowPlaying: (currentTrack, queue, index) =>
    set((state) => ({
      currentTrack,
      queue,
      index,
      positionSec: 0,
      shuffleOrder:
        queue === state.queue
          ? state.shuffleOrder // conserve shuffle order when queue remains the same
          : state.shuffle // rebuild shuffle order when queue changes
            ? buildShuffleOrder(queue.length, index)
            : [],
    })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setProgress: (positionSec, durationSec) => set({ positionSec, durationSec }),
  setIndex: (index) => set({ index }),
  reset: () =>
    set({
      currentTrack: null,
      queue: [],
      index: -1,
      isPlaying: false,
      positionSec: 0,
      durationSec: 0,
      shuffle: false,
      shuffleOrder: [],
      repeatMode: "off",
    }),
  toggleShuffle: () =>
    set((state) => {
      const shuffle = !state.shuffle;
      return {
        shuffle,
        shuffleOrder: shuffle
          ? buildShuffleOrder(state.queue.length, state.index)
          : [],
      };
    }),
  cycleRepeat: () =>
    set((state) => ({
      repeatMode:
        state.repeatMode === "off"
          ? "all"
          : state.repeatMode === "all"
            ? "one"
            : "off",
    })),
}));
