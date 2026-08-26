import {
  introStateStore,
  PUBLIC_INTRO_VERSION,
} from "@/src/experience";
import { consumeIntroLoginPermit } from "@/src/experience/intro-login-permit";
import { useAuthStore } from "@/src/stores/auth-store";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

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
