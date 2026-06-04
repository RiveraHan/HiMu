import { useContext } from "react";
import { PlayerContext } from "./player-provider";

export function usePlayer() {
  const ctx = useContext(PlayerContext);

  if (!ctx)
    throw new Error("usePlayer should be use inside the <PlayerProvider>");

  return ctx;
}
