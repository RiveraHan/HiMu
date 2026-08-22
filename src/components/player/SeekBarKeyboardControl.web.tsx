import { useState, type KeyboardEvent } from "react";

type Props = {
  label: string;
  valueText: string;
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
};

const ARROW_STEP_SECONDS = 10;
const PAGE_STEP_SECONDS = 60;

function clamp(seconds: number, durationSec: number) {
  return Math.min(Math.max(seconds, 0), Math.max(durationSec, 0));
}

/** Typed DOM-only boundary for keyboard and ARIA slider semantics on web. */
export function SeekBarWebKeyboardControl({
  label,
  valueText,
  positionSec,
  durationSec,
  onSeek,
}: Props) {
  const [focused, setFocused] = useState(false);
  const max = Math.max(durationSec, 0);
  const now = clamp(positionSec, max);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = now + ARROW_STEP_SECONDS;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = now - ARROW_STEP_SECONDS;
        break;
      case "PageUp":
        next = now + PAGE_STEP_SECONDS;
        break;
      case "PageDown":
        next = now - PAGE_STEP_SECONDS;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = max;
        break;
    }

    if (next === null) return;
    event.preventDefault();
    onSeek(clamp(next, max));
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={valueText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 12,
        cursor: "pointer",
        outlineColor: focused ? "#5f68d8" : "transparent",
        outlineStyle: "solid",
        outlineWidth: focused ? 2 : 0,
        outlineOffset: 2,
      }}
    />
  );
}

export const SeekBarKeyboardControl = SeekBarWebKeyboardControl;
