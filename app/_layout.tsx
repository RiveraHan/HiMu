import "@/src/i18n";
import { ActivityProvider, useActivity } from "@/src/activity";
import { QueryProvider } from "@/src/api/query-provider";
import { PlayerProvider } from "@/src/audio/player-provider";
import { BottomChrome } from "@/src/components/BottomChrome";
import { ConfirmDialogHost } from "@/src/components/ConfirmDialog";
import { ToastHost } from "@/src/components/Toast";
import { ActivityPanel } from "@/src/components/activity/ActivityPanel";
import { useAuthInit } from "@/src/hooks/use-auth";
import { LocaleProvider } from "@/src/i18n/LocaleProvider";
import { AppTourProvider, useAppTour } from "@/src/onboarding";
import { useAuthStore } from "@/src/stores/auth-store";
import "@/src/theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return <>{children}</>;
}

function GlobalActivitySurfaces() {
  const { closePanel } = useActivity();
  const { phase } = useAppTour();

  useEffect(() => {
    if (phase !== "idle") closePanel();
  }, [closePanel, phase]);

  return (
    <>
      <BottomChrome />
      <ActivityPanel />
    </>
  );
}

function NavigatorShell() {
  const { theme } = useUnistyles();
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack
        key={session?.user.id ?? "signed-out"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="player"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen name="account-settings" />
          <Stack.Screen name="preferences" />
          <Stack.Screen name="favorites" />
          <Stack.Screen name="vibe-check" />
          <Stack.Screen name="dj/[id]" />
          <Stack.Screen
            name="focus-mode"
            options={{ animation: "fade" }}
          />
          <Stack.Screen name="create-dj" />
          <Stack.Screen name="train-dj/[id]" />
        </Stack.Protected>
      </Stack>
      <GlobalActivitySurfaces />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthInitializer>
        <PlayerProvider>
          <QueryProvider>
            <LocaleProvider>
              <ActivityProvider>
                <AppTourProvider>
                  <NavigatorShell />
                </AppTourProvider>
              </ActivityProvider>
              <ToastHost />
              <ConfirmDialogHost />
            </LocaleProvider>
          </QueryProvider>
        </PlayerProvider>
      </AuthInitializer>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
}));
