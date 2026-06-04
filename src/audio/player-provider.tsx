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

  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
    });
  }, []);

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
    const { queue, index } = store.getState();
    const ni = index + 1;

    if (ni < queue.length) load(queue[ni], queue, ni);
    else player.pause();
  }, [player, store, load]);

  const prev = useCallback(() => {
    const { queue, index, positionSec } = store.getState();

    if (positionSec > 3) {
      player.seekTo(0);
      return;
    }

    const pi = index - 1;

    if (pi >= 0) load(queue[pi], queue, pi);
    else player.seekTo(0);
  }, [player, store, load]);

  const seek = useCallback((sec: number) => player.seekTo(sec), [player]);

  // Sync status -> store
  useEffect(() => {
    store.getState().setIsPlaying(status.playing);
    store.getState().setProgress(status.currentTime, status.duration);

    if (status.didJustFinish) next();
  }, [
    status.playing,
    status.currentTime,
    status.duration,
    status.didJustFinish,
    next,
    store,
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
