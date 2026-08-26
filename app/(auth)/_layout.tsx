import {
  introStateStore,
  PUBLIC_INTRO_VERSION,
  trackProductEvent,
} from "@/src/experience";
import { consumeIntroLoginPermit } from "@/src/experience/intro-login-permit";
import i18n from "@/src/i18n";
import { useAuthStore } from "@/src/stores/auth-store";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

export default function AuthLayout() {
  const session = useAuthStore((state) => state.session);
  const [introSeen, setIntroSeen] = useState<boolean | null>(() => (
    consumeIntroLoginPermit() ? true : null
  ));

  useEffect(() => {
    if (session || introSeen !== null) return;
    let active = true;
    introStateStore.isSeen(PUBLIC_INTRO_VERSION).then(
      (seen) => {
        if (active) setIntroSeen(seen);
      },
      () => {
        void trackProductEvent("auth_failed", {
          flowVersion: PUBLIC_INTRO_VERSION,
          platform: Platform.OS === "web"
            ? "web"
            : Platform.OS === "android"
              ? "android"
              : "ios",
          locale: i18n.resolvedLanguage === "es" ? "es" : "en",
          errorCategory: "unknown",
        });
        if (active) setIntroSeen(true);
      },
    );
    return () => {
      active = false;
    };
  }, [introSeen, session]);

  if (session) return <Redirect href="/(app)" />;

  if (introSeen === null) {
    return (
      <View accessibilityLabel="Loading" style={{ flex: 1 }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!introSeen) return <Redirect href="/welcome?step=1" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
