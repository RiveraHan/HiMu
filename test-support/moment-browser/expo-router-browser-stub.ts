import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
export const router = { back: () => window.history.back(), canGoBack: () => window.history.length > 1, replace: () => undefined };
export function useLocalSearchParams<T>() {
  useSyncExternalStore(subscribe, () => window.location.href, () => window.location.href);
  return { id: window.location.pathname.split("/").filter(Boolean).at(-1) } as T;
}
