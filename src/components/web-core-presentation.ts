import { useEffect } from "react";

export const WEB_CORE_PRESENTATION_REGISTRY_KEY = "__himuWebCorePresentations";

const presentationMarkers = [
  "himu-web-core-presentation/app-shell",
  "himu-web-core-presentation/desktop-rail",
  "himu-web-core-presentation/login-hero",
  "himu-web-core-presentation/home-grid",
  "himu-web-core-presentation/profile-layout",
  "himu-web-core-presentation/player-stage",
  "himu-web-core-presentation/dj-layout",
  "himu-web-core-presentation/focus-stage",
  "himu-web-core-presentation/vibe-dashboard",
  "himu-web-core-presentation/track-grid",
] as const;

export type WebCorePresentationMarker = (typeof presentationMarkers)[number];

const knownPresentationMarkers = new Set<string>(presentationMarkers);

function existingPresentationMarkers(host: Record<string, unknown>) {
  const existing = host[WEB_CORE_PRESENTATION_REGISTRY_KEY];
  return Array.isArray(existing)
    ? existing.filter((marker): marker is WebCorePresentationMarker =>
      typeof marker === "string" && knownPresentationMarkers.has(marker),
    )
    : [];
}

/**
 * Records a core presentation after it mounts. This is intentionally
 * nonvisual and platform-safe: it only writes a small, known marker set to
 * globalThis, which makes web presentation activation observable at runtime.
 */
export function registerWebCorePresentation(marker: WebCorePresentationMarker) {
  if (!knownPresentationMarkers.has(marker)) return;

  const host = globalThis as typeof globalThis & Record<string, unknown>;
  const registered = existingPresentationMarkers(host);
  if (!registered.includes(marker)) registered.push(marker);
  host[WEB_CORE_PRESENTATION_REGISTRY_KEY] = registered;
}

export function useWebCorePresentation(marker: WebCorePresentationMarker) {
  useEffect(() => {
    registerWebCorePresentation(marker);
  }, [marker]);
}
