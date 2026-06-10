import { create } from "zustand";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  album_art_url: string | null;
  duration: number | null;
};

type State = {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  index: number; // Position queue
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  shuffle: boolean;
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
  repeatMode: "off",

  setNowPlaying: (currentTrack, queue, index) =>
    set({ currentTrack, queue, index, positionSec: 0 }),
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
      repeatMode: "off",
    }),
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
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
