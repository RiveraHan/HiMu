import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import {
  pendingIntentStore,
  PUBLIC_INTRO_VERSION,
  trackProductEvent,
  useSyncIntroVersion,
  type PendingNavigationIntent,
} from "@/src/experience";
import { useCurrentUser } from "@/src/hooks/use-auth";
import i18n from "@/src/i18n";

type AuthObservation = {
  userId: string;
  intent: Promise<PendingNavigationIntent | null>;
};

function eventProperties() {
  return {
    flowVersion: PUBLIC_INTRO_VERSION,
    platform: Platform.OS === "web"
      ? "web" as const
      : Platform.OS === "android"
        ? "android" as const
        : "ios" as const,
    locale: i18n.resolvedLanguage === "es" ? "es" as const : "en" as const,
  };
}

export function PostAuthIntentRouter() {
  const userId = useCurrentUser()?.id ?? null;
  const { mutateAsync: syncIntroVersion } = useSyncIntroVersion();
  const currentUserIdRef = useRef(userId);
  const observationRef = useRef<AuthObservation | null>(null);
  currentUserIdRef.current = userId;

  useEffect(() => {
    if (!userId) {
      observationRef.current = null;
      return;
    }

    let observation = observationRef.current;
    if (observation?.userId !== userId) {
      let intentRead: Promise<PendingNavigationIntent | null>;
      try {
        intentRead = pendingIntentStore.read(Date.now());
      } catch {
        intentRead = Promise.resolve(null);
      }
      observation = {
        userId,
        intent: intentRead.catch(() => null),
      };
      observationRef.current = observation;

      void syncIntroVersion(PUBLIC_INTRO_VERSION).catch(() => undefined);
      void trackProductEvent("auth_succeeded", eventProperties());
    }

    let active = true;
    void observation.intent.then((intent) => {
      if (
        !active ||
        currentUserIdRef.current !== userId ||
        intent?.kind !== "first_track"
      ) {
        return;
      }
      router.replace("/first-track");
    });

    return () => {
      active = false;
    };
  }, [syncIntroVersion, userId]);

  return null;
}
