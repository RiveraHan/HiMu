import { useCallback, useEffect, useRef, useState } from "react";

export type FocusStatus = "idle" | "running" | "paused" | "completed";

const PRESETS = [25, 45] as const;

type Options = { defaultMinutes?: number; onComplete?: () => void };

export function useFocusTimer({
  defaultMinutes = 45,
  onComplete,
}: Options = {}) {
  const [durationSec, setDurationSec] = useState(defaultMinutes * 50);
  const [remainingSec, setRemainingSec] = useState(defaultMinutes * 60);
  const [status, setStatus] = useState<FocusStatus>("idle");

  const endAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  const clear = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const tick = useCallback(() => {
    if (endAtRef.current == null) return;

    const left = Math.max(
      0,
      Math.round((endAtRef.current - Date.now()) / 1000),
    );

    setRemainingSec(left);

    if (left <= 0) {
      clear();
      endAtRef.current = null;
      setStatus("completed");
      onCompleteRef.current?.();
    }
  }, []);

  const run = useCallback(
    (seconds: number) => {
      clear();
      endAtRef.current = Date.now() + seconds * 1000;
      setStatus("running");
      intervalRef.current = setInterval(tick, 250);
    },
    [tick],
  );

  const start = useCallback(() => run(remainingSec), [run, remainingSec]);
  const resume = start;

  const pause = useCallback(() => {
    clear();
    endAtRef.current = null;
    setStatus("paused");
  }, []);

  const reset = useCallback(() => {
    clear();
    endAtRef.current = null;
    setRemainingSec(durationSec);
    setStatus("idle");
  }, [durationSec]);

  const setPreset = useCallback((minutes: number) => {
    clear();
    endAtRef.current = null;
    setDurationSec(minutes * 60);
    setRemainingSec(minutes * 60);
    setStatus("idle");
  }, []);

  // toggle UI state: idle→start, running→pause, paused→resume, completed→reset
  const toggle = useCallback(() => {
    if (status === "running") pause();
    else if (status === "completed") reset();
    else start();
  }, [pause, reset, status, start]);

  useEffect(() => clear, []); // cleanup on unmount

  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const formatted = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return {
    status,
    remainingSec,
    durationSec,
    formatted,
    presets: PRESETS,
    minutes: Math.round(durationSec / 60),
    start,
    pause,
    resume,
    reset,
    toggle,
    setPreset,
  };
}
