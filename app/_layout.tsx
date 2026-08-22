import "@/src/theme";
import "@/src/i18n";
import { ActivityProvider, useActivity } from "@/src/activity";
import { QueryProvider } from "@/src/api/query-provider";
import { PlayerProvider } from "@/src/audio/player-provider";
import { BottomChrome } from "@/src/components/BottomChrome";
import { isApplicationChromeHidden } from "@/src/components/bottom-chrome-metrics";
import { ResponsiveAppShell } from "@/src/components/ResponsiveAppShell";
import { ConfirmDialogHost } from "@/src/components/ConfirmDialog";
import { ToastHost } from "@/src/components/Toast";
import { ActivityPanel } from "@/src/components/activity/ActivityPanel";
import { useAuthInit } from "@/src/hooks/use-auth";
import { LocaleProvider } from "@/src/i18n/LocaleProvider";
import { AppTourProvider, useAppTour } from "@/src/onboarding";
import { useAuthStore } from "@/src/stores/auth-store";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { ActivityIndicator, View } from "react-native";
import { useEffect, useState } from "react";
import { UnistylesGestureHandlerRootView } from "@/src/components/UnistylesGestureHandlerRootView";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { HIMU_FONTS } from "@/src/theme/fonts";
import { UnistylesRuntime } from "@/src/theme/unistyles";

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
  const { phase } = useAppTour();
  const segments = useSegments();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ResponsiveAppShell
        showRail={
          !!session &&
          phase === "idle" &&
          !isApplicationChromeHidden(segments)
        }
      >
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
          <Stack.Screen name="create-track" />
          <Stack.Screen name="train-dj/[id]" />
        </Stack.Protected>
        </Stack>
      </ResponsiveAppShell>
      <GlobalActivitySurfaces />
    </>
  );
}

function AppProviders() {
  return (
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
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(HIMU_FONTS);
  const [activatedFallbackError, setActivatedFallbackError] =
    useState<Error | null>(null);
  const { theme } = useUnistyles();
  const fontFallbackReady = !fontError || activatedFallbackError === fontError;

  useEffect(() => {
    if (!fontError) {
      setActivatedFallbackError(null);
      return;
    }

    UnistylesRuntime.setTheme(
      UnistylesRuntime.themeName === "light"
        ? "lightFontFallback"
        : "darkFontFallback",
    );
    setActivatedFallbackError(fontError);

    if (__DEV__) {
      console.error("[RootLayout] Failed to load HiMu fonts", fontError);
    }
  }, [fontError]);

  if (!fontsLoaded && (!fontError || !fontFallbackReady)) {
    return (
      <UnistylesGestureHandlerRootView style={styles.root}>
        <View
          style={styles.loader}
          testID={fontError ? "root-font-fallback-loader" : "root-font-loader"}
        >
          <ActivityIndicator color={theme.colors.primary} />
        </View>
        <StatusBar style="light" />
      </UnistylesGestureHandlerRootView>
    );
  }

  return (
    <UnistylesGestureHandlerRootView
      style={styles.root}
      testID={fontError ? "root-font-fallback" : undefined}
    >
      <AppProviders />
      <StatusBar style="light" />
    </UnistylesGestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
}));
