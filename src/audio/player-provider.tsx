import { supabase } from "@/src/api/supabase";
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
import { AppState } from "react-native";
import { PlaybackConfirmation } from "./playback-confirmation";

// Audius (and any future external-catalog) track ids are namespaced
// "audius:<id>" and never correspond to a row in `tracks` — skip DB-backed
// stats for them rather than let every insert/lookup fail against the
// uuid-typed `tracks.id` / `listening_events.track_id` columns.
function isExternalTrack(trackId: string): boolean {
  return trackId.startsWith("audius:");
}

// Best-effort: record that the signed-in user has listened to this track's DJ.
async function recordDjListen(trackId: string) {
  try {
    if (isExternalTrack(trackId)) return;
    const uid = useAuthStore.getState().session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from("tracks")
      .select("dj_id")
      .eq("id", trackId)
      .maybeSingle();
    if (!data?.dj_id) return;
    await supabase
      .from("dj_listens")
      .upsert(
        { user_id: uid, dj_id: data.dj_id },
        { onConflict: "user_id,dj_id", ignoreDuplicates: true },
      );
  } catch {}
}

// Best-effort: log a per-track outcome for the taste engine (spec: taste-engine).
async function recordListeningEvent(
  trackId: string,
  event: "completed" | "skipped",
) {
  try {
    if (isExternalTrack(trackId)) return;
    const uid = useAuthStore.getState().session?.user?.id;
    if (!uid) return;
    const { error } = await supabase
      .from("listening_events")
      .insert({ user_id: uid, track_id: trackId, event });
    if (error) console.warn("[listening_events]", error.message);
  } catch (e) {
    console.warn("[listening_events]", e);
  }
}

// Lock-screen / media-notification metadata for the current track. Activating
// the lock screen (setActiveForLockScreen) is also what starts expo-audio's
// Android mediaPlayback foreground service — which is what keeps the JS runtime
// alive in the background so the queue can auto-advance between tracks.
function lockScreenMetadata(track: PlayerTrack) {
  return {
    title: track.title,
    artist: track.artist,
    artworkUrl: track.album_art_url ?? undefined,
  };
}

type PlayerControls = {
  load: (track: PlayerTrack, queue?: PlayerTrack[], index?: number) => Promise<boolean>;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  flushListeningStats: () => Promise<void>;
};

export const PlayerContext = createContext<PlayerControls | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  // keepAudioSessionActive keeps the iOS audio session active across the
  // silent gap between tracks. Without it, expo-audio deactivates the session
  // the instant a track ends (AudioModule.swift onPlaybackComplete), which
  // relinquishes the background-audio grant and lets iOS suspend the JS
  // runtime before our didJustFinish -> next() advance can run — so playback
  // stops instead of auto-advancing while backgrounded or the screen is locked.
  const player = useAudioPlayer(undefined, { keepAudioSessionActive: true });

  const status = useAudioPlayerStatus(player);

  const store = usePlayerStore;
  const session = useAuthStore((s) => s.session);

  const listenSecondsRef = useRef(0); // seconds listented pending flush
  const trackSecondsRef = useRef(0); // seconds played track rule 30s
  const trackPlayedRef = useRef(0);
  const lastGenreRef = useRef<string | null>(null);
  const prevTimeRef = useRef(0);
  const wasPlayingRef = useRef(false); // detect transitions play -> pause
  const outgoingSettledRef = useRef(false); // one event max per loaded track
  const lockScreenActiveRef = useRef(false); // media session started once
  const statusSequenceRef = useRef(0);
  const playbackConfirmationRef = useRef(new PlaybackConfirmation(8_000));

  useEffect(() => () => playbackConfirmationRef.current.dispose(), []);

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

    // Tear down the media session/foreground service so a logged-out app
    // isn't left holding a lock-screen notification.
    player.clearLockScreenControls();
    lockScreenActiveRef.current = false;
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
      const played = store.getState().currentTrack;
      lastGenreRef.current = played?.genre ?? lastGenreRef.current;
      if (played) void recordDjListen(played.id);
    }

    trackSecondsRef.current = 0;
  }, [store]);

  const flushListeningStats = useCallback(async () => {
    countTrackIfPlayed();
    await flush({ final: true });
  }, [countTrackIfPlayed, flush]);

  // Evaluate the outgoing track exactly once per load. Must run BEFORE
  // countTrackIfPlayed(), which resets trackSecondsRef.
  const settleOutgoingTrack = useCallback(
    (finished: boolean) => {
      if (outgoingSettledRef.current) return;

      const track = store.getState().currentTrack;
      if (!track) return;

      outgoingSettledRef.current = true;

      if (finished) {
        void recordListeningEvent(track.id, "completed");
        return;
      }

      const duration = store.getState().durationSec;
      const played = trackSecondsRef.current;
      const ratio = duration > 0 ? played / duration : 0;

      if (ratio >= 0.9) void recordListeningEvent(track.id, "completed");
      else if (played > 3 && ratio < 0.3)
        void recordListeningEvent(track.id, "skipped");
      // 30–90%: ambiguous, no event.
    },
    [store],
  );

  const load: PlayerControls["load"] = useCallback(
    (track, queue, index) => {
      settleOutgoingTrack(false); // user-initiated unless didJustFinish settled it
      countTrackIfPlayed();
      outgoingSettledRef.current = false; // the new track is now evaluable

      const q = queue ?? [track];
      const i = index ?? q.findIndex((t) => t.id === track.id);

      store.getState().setNowPlaying(track, q, Math.max(i, 0));
      const confirmation = playbackConfirmationRef.current.begin(
        track.id,
        statusSequenceRef.current,
      );
      player.replace({ uri: track.audio_url });
      player.play();

      // Activate the lock-screen / media notification. The first activation
      // also boots the Android foreground service that keeps this JS runtime
      // alive in the background, so the queue keeps auto-advancing while
      // backgrounded or screen-locked; later loads just refresh the metadata.
      const metadata = lockScreenMetadata(track);
      if (!lockScreenActiveRef.current) {
        player.setActiveForLockScreen(true, metadata);
        lockScreenActiveRef.current = true;
      } else {
        player.updateLockScreenMetadata(metadata);
      }
      return confirmation;
    },
    [player, store, countTrackIfPlayed, settleOutgoingTrack],
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
    statusSequenceRef.current += 1;
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
    playbackConfirmationRef.current.observe({
      statusSequence: statusSequenceRef.current,
      currentTrackId: store.getState().currentTrack?.id ?? null,
      isLoaded: status.isLoaded,
      playing: status.playing,
    });

    if (status.didJustFinish) {
      if (store.getState().repeatMode === "one") {
        countTrackIfPlayed(); // loops don't emit events (spec §4)
        player.seekTo(0);
        player.play();
      } else {
        settleOutgoingTrack(true); // natural end = completed, even at queue end
        next();
      }
    }
  }, [
    status.playing,
    status.isLoaded,
    status.currentTime,
    status.duration,
    status.didJustFinish,
    next,
    store,
    player,
    countTrackIfPlayed,
    settleOutgoingTrack,
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
