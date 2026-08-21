import { useEffect } from "react";

export const WEB_CORE_PRESENTATION_REGISTRY_KEY = "__himuWebCorePresentations";

export type WebCorePresentationMarker =
  | "himu-web-core-presentation/app-shell"
  | "himu-web-core-presentation/desktop-rail"
  | "himu-web-core-presentation/login-hero"
  | "himu-web-core-presentation/home-grid"
  | "himu-web-core-presentation/profile-layout"
  | "himu-web-core-presentation/player-stage"
  | "himu-web-core-presentation/dj-layout"
  | "himu-web-core-presentation/focus-stage"
  | "himu-web-core-presentation/vibe-dashboard"
  | "himu-web-core-presentation/track-grid";

const PRESENTATION_MARKER_PREFIX = "himu-web-core-presentation/";
const MAX_PRESENTATION_MARKERS = 32;

function isPresentationMarker(marker: unknown): marker is string {
  return typeof marker === "string" &&
    marker.startsWith(PRESENTATION_MARKER_PREFIX) &&
    marker.length > PRESENTATION_MARKER_PREFIX.length;
}

function existingPresentationMarkers(host: Record<string, unknown>) {
  const existing = host[WEB_CORE_PRESENTATION_REGISTRY_KEY];
  return Array.isArray(existing)
    ? existing.filter(isPresentationMarker).slice(-MAX_PRESENTATION_MARKERS)
    : [];
}

/**
 * Records a core presentation after it mounts. This is intentionally
 * nonvisual and platform-safe: it only writes a small, bounded marker set to
 * globalThis, which makes web presentation activation observable at runtime.
 */
export function registerWebCorePresentation(marker: WebCorePresentationMarker) {
  if (!isPresentationMarker(marker)) return;

  const host = globalThis as typeof globalThis & Record<string, unknown>;
  const registered = existingPresentationMarkers(host);
  if (!registered.includes(marker)) {
    if (registered.length === MAX_PRESENTATION_MARKERS) registered.shift();
    registered.push(marker);
  }
  host[WEB_CORE_PRESENTATION_REGISTRY_KEY] = registered;
}

export function useWebCorePresentation(marker: WebCorePresentationMarker) {
  useEffect(() => {
    registerWebCorePresentation(marker);
  }, [marker]);
}
