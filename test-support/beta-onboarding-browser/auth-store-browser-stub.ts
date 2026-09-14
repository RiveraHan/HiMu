import { useSyncExternalStore } from "react";

const ROUTER_EVENT = "himu-browser-router-change";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(ROUTER_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(ROUTER_EVENT, listener);
  };
}

function snapshot() {
  return window.location.href;
}

type BrowserAuthState = {
  session: null | { user: { id: string } };
};

export function useAuthStore<T>(selector: (state: BrowserAuthState) => T): T {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const replay = new URLSearchParams(window.location.search).get("mode") === "replay";
  return selector({
    session: replay ? { user: { id: "browser-replay-user" } } : null,
  });
}
