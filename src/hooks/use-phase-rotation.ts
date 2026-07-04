import { useEffect, useState } from "react";

// Rotates through loading-phase messages on an interval.
export function usePhaseRotation(
  phases: readonly string[],
  intervalMs = 5000,
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const id = setInterval(
      () => setIndex((i) => (i + 1) % phases.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [phases, intervalMs]);

  return phases[index];
}
