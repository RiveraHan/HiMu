import { supabase } from "@/src/api/supabase";
import {
  type AuthScope,
  assertCurrentMutationUser,
  captureAuthScope,
  setAuthScopeHeader,
} from "@/src/api/auth-scope";
import { useConfirmStore } from "@/src/stores/confirm-store";
import { useAuthStore } from "@/src/stores/auth-store";
import { usePlayerStore, type PlayerTrack } from "@/src/stores/player-store";
import { useToastStore } from "@/src/stores/toast-store";
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
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { AppState } from "react-native";
import { PlaybackConfirmation } from "./playback-confirmation";
import { resolveTrackPlaybackUrl } from "./private-media";

// Audius (and any future external-catalog) track ids are namespaced
// "audius:<id>" and never correspond to a row in `tracks` — skip DB-backed
// stats for them rather than let every insert/lookup fail against the
// uuid-typed `tracks.id` / `listening_events.track_id` columns.
function isExternalTrack(trackId: string): boolean {
  return trackId.startsWith("audius:");
}

// Best-effort: record that the signed-in user has listened to this track's DJ.
async function recordDjListen(trackId: string, scope: AuthScope) {
  try {
    if (isExternalTrack(trackId)) return;
    const { data } = await setAuthScopeHeader(
      supabase.from("tracks").select("dj_id").eq("id", trackId).maybeSingle(),
      scope,
    );
    if (!data?.dj_id) return;
    assertCurrentMutationUser(scope.userId);
    await setAuthScopeHeader(
      supabase.from("dj_listens").upsert(
        { user_id: scope.userId, dj_id: data.dj_id },
        { onConflict: "user_id,dj_id", ignoreDuplicates: true },
      ),
      scope,
    );
  } catch {}
}

// Best-effort: log a per-track outcome for the taste engine (spec: taste-engine).
async function recordListeningEvent(
  trackId: string,
  event: "completed" | "skipped",
  scope: AuthScope,
) {
  try {
    if (isExternalTrack(trackId)) return;
    const { error } = await setAuthScopeHeader(
      supabase
        .from("listening_events")
        .insert({ user_id: scope.userId, track_id: trackId, event }),
      scope,
    );
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
  const ownerUserIdRef = useRef(session?.user.id ?? null);
  const ownerGenerationRef = useRef(0);
  const committedUserIdRef = useRef(session?.user.id ?? null);
  const observedUserId = session?.user.id ?? null;
  const [, releaseScopeGate] = useReducer((value: number) => value + 1, 0);
  const playbackConfirmationRef = useRef(new PlaybackConfirmation(8_000));

  useEffect(() => () => playbackConfirmationRef.current.dispose(), []);

  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
    });
  }, []);

  // Stop playback and clear all per-user state on logout or direct A -> B
  // replacement. PlayerProvider intentionally remains mounted across auth
  // changes so it can observe and tear down the outgoing account itself.
  useLayoutEffect(() => {
    const previousUserId = committedUserIdRef.current;
    if (previousUserId === observedUserId) return;

    ownerUserIdRef.current = observedUserId;
    ownerGenerationRef.current += 1;

    // Discard all playback/stat state owned by the outgoing account so it can
    // neither render nor be credited after the identity transition.
    listenSecondsRef.current = 0;
    trackSecondsRef.current = 0;
    trackPlayedRef.current = 0;
    lastGenreRef.current = null;
    prevTimeRef.current = 0;
    wasPlayingRef.current = false;
    outgoingSettledRef.current = false;
    statusSequenceRef.current = 0;
    playbackConfirmationRef.current.dispose();

    player.pause();
    player.replace(null);
    store.getState().reset();

    // Tear down the media session/foreground service for the outgoing owner.
    player.clearLockScreenControls();
    lockScreenActiveRef.current = false;
    useToastStore.getState().dismiss();
    useConfirmStore.getState().resolve(false);

    committedUserIdRef.current = observedUserId;
    releaseScopeGate();
  }, [observedUserId, player, store]);

  const flush = useCallback(async (opts?: { final: boolean }) => {
    const ownerUserId = ownerUserIdRef.current;
    const ownerGeneration = ownerGenerationRef.current;
    if (
      ownerUserId === null ||
      useAuthStore.getState().session?.user.id !== ownerUserId
    ) {
      return;
    }
    const scope = captureAuthScope(ownerUserId);

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

    const { error } = await setAuthScopeHeader(
      supabase.rpc("record_listening_stats", {
        p_minutes: minutes,
        p_tracks: tracks,
        p_top_genre: lastGenreRef.current ?? undefined,
      }),
      scope,
    );

    if (
      error &&
      ownerGenerationRef.current === ownerGeneration &&
      ownerUserIdRef.current === ownerUserId &&
      useAuthStore.getState().session?.user.id === ownerUserId
    ) {
      // Retry only while the same account still owns these counters.
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
      const ownerUserId = ownerUserIdRef.current;
      if (played && ownerUserId) {
        try {
          void recordDjListen(played.id, captureAuthScope(ownerUserId));
        } catch {}
      }
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
      const recordEvent = (event: "completed" | "skipped") => {
        const ownerUserId = ownerUserIdRef.current;
        if (!ownerUserId) return;
        try {
          void recordListeningEvent(
            track.id,
            event,
            captureAuthScope(ownerUserId),
          );
        } catch {}
      };

      if (finished) {
        recordEvent("completed");
        return;
      }

      const duration = store.getState().durationSec;
      const played = trackSecondsRef.current;
      const ratio = duration > 0 ? played / duration : 0;

      if (ratio >= 0.9) recordEvent("completed");
      else if (played > 3 && ratio < 0.3) recordEvent("skipped");
      // 30–90%: ambiguous, no event.
    },
    [store],
  );

  const load: PlayerControls["load"] = useCallback(
    async (track, queue, index) => {
      const ownerUserId = ownerUserIdRef.current;
      const ownerGeneration = ownerGenerationRef.current;
      if (!ownerUserId) return false;

      let playbackUrl: string;
      try {
        const scope = captureAuthScope(ownerUserId);
        playbackUrl = await resolveTrackPlaybackUrl(
          track,
          scope,
          supabase.functions,
        );
      } catch {
        return false;
      }

      if (
        ownerGenerationRef.current !== ownerGeneration ||
        ownerUserIdRef.current !== ownerUserId ||
        useAuthStore.getState().session?.user.id !== ownerUserId
      ) {
        return false;
      }

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
      player.replace({ uri: playbackUrl });
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
    if (status.playing && store.getState().currentTrack) {
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

  if (committedUserIdRef.current !== observedUserId) return null;

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
