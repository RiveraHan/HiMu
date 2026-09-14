import { useEffect, useSyncExternalStore } from "react";

export type Href =
  | string
  | {
      pathname: string;
      params?: Record<string, string | number | undefined>;
    };

const ROUTER_EVENT = "himu-browser-router-change";

declare global {
  interface Window {
    __HIMU_ROUTER_PUSH_COUNT__?: number;
  }
}

window.__HIMU_ROUTER_PUSH_COUNT__ = 0;

function hrefUrl(href: Href) {
  if (typeof href === "string") return new URL(href, window.location.origin);
  const url = new URL(href.pathname, window.location.origin);
  for (const [key, value] of Object.entries(href.params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

function notify() {
  window.dispatchEvent(new Event(ROUTER_EVENT));
}

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

export const router = {
  back() {
    window.history.back();
  },
  canGoBack() {
    return window.history.length > 1;
  },
  push(href: Href) {
    const url = hrefUrl(href);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.__HIMU_ROUTER_PUSH_COUNT__ = (window.__HIMU_ROUTER_PUSH_COUNT__ ?? 0) + 1;
    notify();
  },
  replace(href: Href) {
    const url = hrefUrl(href);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    notify();
  },
  setParams(params: Record<string, string | number | undefined>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    notify();
  },
};

export function useLocalSearchParams<T>() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(window.location.search)) {
    params[key] = value;
  }
  return params as T;
}

export function Redirect({ href }: { href: Href }) {
  useEffect(() => {
    router.replace(href);
  }, [href]);
  return null;
}
