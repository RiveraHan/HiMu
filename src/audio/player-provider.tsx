import { useAuthStore } from "@/src/stores/auth-store";
import { usePlayerStore, type PlayerTrack } from "@/src/stores/player-store";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";

type PlayerControls = {
  load: (track: PlayerTrack, queue?: PlayerTrack[], index?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
};

export const PlayerContext = createContext<PlayerControls | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(undefined);

  const status = useAudioPlayerStatus(player);

  const store = usePlayerStore;
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
    });
  }, []);

  // Stop playback and clear the player when the user logs out
  useEffect(() => {
    if (session) return;
    if (store.getState().currentTrack) {
      player.pause();
      store.getState().reset();
    }
  }, [session, player, store]);

  const load: PlayerControls["load"] = useCallback(
    (track, queue, index) => {
      const q = queue ?? [track];
      const i = index ?? q.findIndex((t) => t.id === track.id);

      store.getState().setNowPlaying(track, q, Math.max(i, 0));
      player.replace({ uri: track.audio_url });
      player.play();
    },
    [player, store],
  );

  const toggle = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const next = useCallback(() => {
    const { queue, index, repeatMode, shuffle, shuffleOrder } =
      store.getState();

    const order = shuffle ? shuffleOrder : queue.map((_, i) => i);

    const post = order.indexOf(index);

    let nextPost = post + 1;

    if (nextPost >= order.length) {
      if (repeatMode === "all") nextPost = 0;
      else return player.pause(); // off/one for end of queue
    }

    const nextIndex = order[nextPost];
    load(queue[nextIndex], queue, nextIndex); // match queue conserve shuffleOrder
  }, [player, store, load]);

  const prev = useCallback(() => {
    const { queue, index, positionSec, shuffle, shuffleOrder, repeatMode } =
      store.getState();

    if (positionSec > 3) return player.seekTo(0); // seek to start if past 3s

    const order = shuffle ? shuffleOrder : queue.map((_, i) => i);

    const post = order.indexOf(index);

    let prePost = post - 1;

    if (prePost < 0) {
      if (repeatMode === "all") prePost = order.length - 1;
      else return player.seekTo(0);
    }

    const prevIndex = order[prePost];
    load(queue[prevIndex], queue, prevIndex);
  }, [player, store, load]);

  const seek = useCallback((sec: number) => player.seekTo(sec), [player]);

  // Sync status -> store
  useEffect(() => {
    store.getState().setIsPlaying(status.playing);
    store.getState().setProgress(status.currentTime, status.duration);

    if (status.didJustFinish) {
      if (store.getState().repeatMode === "one") {
        player.seekTo(0);
        player.play();
      } else {
        next();
      }
    }
  }, [
    status.playing,
    status.currentTime,
    status.duration,
    status.didJustFinish,
    next,
    store,
    player,
  ]);

  const value = useMemo<PlayerControls>(
    () => ({
      load,
      toggle,
      next,
      prev,
      seek,
    }),
    [load, toggle, next, prev, seek],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
