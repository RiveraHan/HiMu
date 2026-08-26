import {
  PublicProductIntro,
  type PublicIntroMode,
  type PublicIntroStep,
} from "@/src/components/experience/PublicProductIntro";
import {
  introStateStore,
  pendingIntentStore,
  PUBLIC_INTRO_VERSION,
  trackProductEvent,
} from "@/src/experience";
import {
  abandonIntroLoginOrigin,
  beginIntroLoginHandoff,
  cancelIntroLoginHandoff,
  registerIntroLoginOrigin,
} from "@/src/experience/intro-login-permit";
import i18n from "@/src/i18n";
import { useAuthStore } from "@/src/stores/auth-store";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const STEP_KEYS = ["promise", "dj", "result"] as const;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeStep(value: string | string[] | undefined): PublicIntroStep {
  const candidate = single(value);
  return candidate === "2" || candidate === "3"
    ? Number(candidate) as PublicIntroStep
    : 1;
}

function isCanonicalStep(value: string | string[] | undefined): boolean {
  const candidate = single(value);
  return candidate === "1" || candidate === "2" || candidate === "3";
}

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

function reportStorageFailure(): void {
  void trackProductEvent("auth_failed", {
    ...eventProperties(),
    errorCategory: "unknown",
  });
}

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{
    step?: string | string[];
    mode?: string | string[];
  }>();
  const session = useAuthStore((state) => state.session);
  const step = normalizeStep(params.step);
  const mode: PublicIntroMode = single(params.mode) === "replay"
    ? "replay"
    : "first-run";
  const startedAt = useRef(Date.now());
  const viewedSteps = useRef(new Set<PublicIntroStep>());
  const completionStarted = useRef(false);
  const mounted = useRef(true);
  const loginOrigin = useRef(Symbol("public-intro-login-origin")).current;
  const routeAuthorization = `${mode}:${session?.user.id ?? "signed-out"}`;
  const routeAuthorizationRef = useRef(routeAuthorization);
  const [isCompleting, setIsCompleting] = useState(false);
  routeAuthorizationRef.current = routeAuthorization;

  useEffect(() => {
    mounted.current = true;
    registerIntroLoginOrigin(loginOrigin);
    return () => {
      mounted.current = false;
      abandonIntroLoginOrigin(loginOrigin);
    };
  }, [loginOrigin]);

  useEffect(() => {
    if (!isCanonicalStep(params.step)) {
      router.setParams({ step: "1" });
    }
  }, [params.step]);

  useEffect(() => {
    if ((mode === "replay" && !session) || (mode === "first-run" && !!session)) {
      return;
    }
    if (viewedSteps.current.has(step)) return;
    viewedSteps.current.add(step);
    if (viewedSteps.current.size === 1) {
      void trackProductEvent("intro_viewed", eventProperties());
    }
    void trackProductEvent("intro_step_viewed", {
      ...eventProperties(),
      step: STEP_KEYS[step - 1],
    });
  }, [mode, session, step]);

  if (mode === "replay" && !session) return <Redirect href="/login" />;
  if (mode === "first-run" && session) return <Redirect href="/(app)" />;

  const completeIntro = async (withFirstTrackIntent: boolean) => {
    if (routeAuthorizationRef.current !== routeAuthorization) return;
    if (completionStarted.current) return;
    completionStarted.current = true;
    setIsCompleting(true);
    const completionAuthorization = routeAuthorization;

    if (mode === "replay") {
      if (mounted.current && routeAuthorizationRef.current === completionAuthorization) {
        router.replace("/(app)");
      }
      return;
    }

    const now = Date.now();
    const operations = withFirstTrackIntent
      ? [
          pendingIntentStore.writeFirstTrack(now),
          introStateStore.markSeen(PUBLIC_INTRO_VERSION, now),
        ]
      : [introStateStore.markSeen(PUBLIC_INTRO_VERSION, now)];
    const results = await Promise.allSettled(operations);
    if (
      !mounted.current ||
      routeAuthorizationRef.current !== completionAuthorization
    ) return;

    if (results.some(({ status }) => status === "rejected")) {
      reportStorageFailure();
    }

    void trackProductEvent("intro_completed", {
      ...eventProperties(),
      elapsedMs: Math.min(86_400_000, Math.max(0, now - startedAt.current)),
    });
    if (!beginIntroLoginHandoff(loginOrigin)) return;
    try {
      router.replace("/login");
    } catch {
      cancelIntroLoginHandoff(loginOrigin);
    }
  };

  return (
    <PublicProductIntro
      step={step}
      mode={mode}
      callbacks={{
        disabled: isCompleting,
        onBack: () => router.setParams({ step: String(step - 1) }),
        onContinue: () => router.setParams({ step: String(step + 1) }),
        onCreate: () => completeIntro(true),
        onExistingAccount: () => completeIntro(false),
      }}
    />
  );
}
