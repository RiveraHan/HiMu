import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { localDateStr } from "@/src/utils/home-curation";

export function useLocalDate(): string {
  const [dropDate, setDropDate] = useState(() => localDateStr());
  const recheck = useCallback(() => setDropDate(localDateStr()), []);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timer = setTimeout(recheck, Math.max(0, nextMidnight.getTime() - now.getTime()));
    return () => clearTimeout(timer);
  }, [dropDate, recheck]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") recheck();
    });
    return () => subscription.remove();
  }, [recheck]);

  return dropDate;
}
