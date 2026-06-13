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
  useRef,
} from "react";
import { supabase } from "@/src/api/supabase";
import { AppState } from "react-native";

type PlayerControls = {
  load: (track: PlayerTrack, queue?: PlayerTrack[], index?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  flushListeningStats: () => Promise<void>;
};

export const PlayerContext = createContext<PlayerControls | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(undefined);

  const status = useAudioPlayerStatus(player);

  const store = usePlayerStore;
  const session = useAuthStore((s) => s.session);

  const listenSecondsRef = useRef(0); // seconds listented pending flush
  const trackSecondsRef = useRef(0); // seconds played track rule 30s
  const trackPlayedRef = useRef(0);
  const lastGenreRef = useRef<string | null>(null);
  const prevTimeRef = useRef(0);
  const wasPlayingRef = useRef(false); // detect transitions play -> pause

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

    // Discard pending stats: without a session the RPC can't run, and they
    // must not be credited to the next user who signs in
    listenSecondsRef.current = 0;
    trackSecondsRef.current = 0;
    trackPlayedRef.current = 0;
    lastGenreRef.current = null;

    if (store.getState().currentTrack) {
      player.pause();
      store.getState().reset();
    }
  }, [session, player, store]);

  const flush = useCallback(async (opts?: { final: boolean }) => {
    let minutes = Math.floor(listenSecondsRef.current / 60);

    // Round up to the nearest minute if final and over 30s have passed
    if (opts?.final && listenSecondsRef.current % 60 >= 30) minutes += 1;

    const tracks = trackPlayedRef.current;

    if (minutes === 0 && tracks === 0) return;

    // Reset listen seconds and track played if final, otherwise subtract minutes from listen seconds
    listenSecondsRef.current = opts?.final
      ? 0
      : listenSecondsRef.current - minutes * 60;
    trackPlayedRef.current = 0;

    const { error } = await supabase.rpc("record_listening_stats", {
      p_minutes: minutes,
      p_tracks: tracks,
      p_top_genre: lastGenreRef.current ?? undefined,
    });

    if (error) {
      // Retry: add minutes and tracks back to listen seconds and track played
      listenSecondsRef.current += minutes * 60;
      trackPlayedRef.current += tracks;
    }
  }, []);

  useEffect(() => {
    if (wasPlayingRef.current && !status.playing) flush();
    wasPlayingRef.current = status.playing;
  }, [status.playing, flush]);

  useEffect(() => {
    const id = setInterval(() => flush(), 60_000);
    return () => clearInterval(id);
  }, [flush]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") flush();
    });
    return () => sub.remove();
  }, [flush]);

  // Count track played and update genre if 30s have passed
  const countTrackIfPlayed = useCallback(() => {
    if (trackSecondsRef.current >= 30) {
      trackPlayedRef.current += 1;
      lastGenreRef.current =
        store.getState().currentTrack?.genre ?? lastGenreRef.current;
    }

    trackSecondsRef.current = 0;
  }, [store]);

  const flushListeningStats = useCallback(async () => {
    countTrackIfPlayed();
    await flush({ final: true });
  }, [countTrackIfPlayed, flush]);

  const load: PlayerControls["load"] = useCallback(
    (track, queue, index) => {
      countTrackIfPlayed();

      const q = queue ?? [track];
      const i = index ?? q.findIndex((t) => t.id === track.id);

      store.getState().setNowPlaying(track, q, Math.max(i, 0));
      player.replace({ uri: track.audio_url });
      player.play();
    },
    [player, store, countTrackIfPlayed],
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
    // Accumulate playback time based on position changes.
    // Skips and track changes cause jumps (negative or > 2 s) that are ignored:
    // only the natural progression of playback (ticks of ~0.5 s) is counted.
    if (status.playing) {
      const delta = status.currentTime - prevTimeRef.current;
      if (delta > 0 && delta < 2) {
        listenSecondsRef.current += delta;
        trackSecondsRef.current += delta;
      }
    }

    prevTimeRef.current = status.currentTime;

    store.getState().setIsPlaying(status.playing);
    store.getState().setProgress(status.currentTime, status.duration);

    if (status.didJustFinish) {
      if (store.getState().repeatMode === "one") {
        countTrackIfPlayed();
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
    countTrackIfPlayed,
  ]);

  const value = useMemo<PlayerControls>(
    () => ({
      load,
      toggle,
      next,
      prev,
      seek,
      flushListeningStats,
    }),
    [load, toggle, next, prev, seek, flushListeningStats],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
